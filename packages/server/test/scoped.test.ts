// The drive a piece at a time: what SQLite and Postgres answer to each query
// is what the drive held whole answers, after the same changes through the
// routes; a store of rows written before the columns is filled once; and a
// drive of two hundred thousand entries is listed without being read whole.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as core from '@rebofiles/core';
import type { Entry } from '@rebofiles/core';
import { type MetadataStore, createDriveHandler, diskStorage, postgresMetadata, sqliteMetadata } from '../src';
import { scopedOver } from '../src/metadata';
import { bytesOf, client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-scoped-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const ids = (entries: Entry[] | undefined) => (entries ?? []).map((entry) => entry.id).sort();

/** A drive of some of everything, made through the routes as two people would. */
async function filled(metadata: MetadataStore) {
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata,
    identify: (request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null),
    authorize: () => true,
    secret: 'u',
    base: '/api/files',
  });
  const send = (url: string, init: RequestInit) => handle(new Request(url, init));
  const ana = client(handle, 'ana');
  const bea = client(handle, 'bea');
  const clients = (await ana.ask('POST', '/api/files/folders', { name: 'Clients', parent: null })).body.entry;
  const north = (await ana.ask('POST', '/api/files/folders', { name: 'Northwind Año', parent: clients.id })).body.entry;
  const deep = (await ana.ask('POST', '/api/files/folders', { name: 'Deep', parent: north.id })).body.entry;
  const contract = (await ana.upload(bytesOf(10), { name: 'contrato_100%.txt', parent: deep.id, sha256: 'a'.repeat(64) }, send)).body.entry;
  await ana.upload(bytesOf(11), { name: 'notes.txt', parent: null }, send);
  await bea.upload(bytesOf(12), { name: 'beas.txt', parent: clients.id }, send);
  await ana.ask('POST', `/api/files/entries/${north.id}/shares`, { with: 'bea', role: 'editor' });
  await ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'group:sales', role: 'viewer' });
  await ana.ask('POST', `/api/files/entries/${contract.id}/links`, {});
  const old = (await ana.ask('POST', '/api/files/folders', { name: 'Old', parent: null })).body.entry;
  await ana.ask('POST', '/api/files/folders', { name: 'Inside old', parent: old.id });
  await ana.ask('POST', `/api/files/entries/${old.id}/trash`);
  await bea.ask('POST', `/api/files/entries/${contract.id}/trash`);
  await bea.ask('POST', `/api/files/entries/${contract.id}/restore`);
  await ana.ask('PATCH', `/api/files/entries/${deep.id}`, { parent: clients.id, name: 'Deeper' });
  await ana.ask('PATCH', `/api/files/entries/${contract.id}`, { fields: { client: 'northwind', 'case.no': '2026-114' } });
  await ana.ask('PATCH', `/api/files/entries/${north.id}`, { fields: { client: 'northwind' } });
  return { clients, north, deep, contract, old };
}

describe.each([
  ['SQLite', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
  ['Postgres', () => postgresMetadata(new PGlite())],
])('the queries of %s', (_, open) => {
  it('answer as the drive held whole answers', async () => {
    const store = await open();
    const made = await filled(store);
    const q = store.scoped!;
    const whole = scopedOver(() => drive);
    const drive = await store.load();
    const both = async <A extends unknown[]>(name: keyof typeof q, ...args: A) => {
      const call = (of: typeof q) => (of[name] as unknown as (...a: A) => Promise<Entry[] | Entry | undefined>)(...args);
      const [mine, held] = await Promise.all([call(q), call(whole)]);
      return [Array.isArray(mine) ? ids(mine) : mine?.id, Array.isArray(held) ? ids(held) : held?.id];
    };
    const same = async <A extends unknown[]>(name: keyof typeof q, ...args: A) => {
      const [mine, held] = await both(name, ...args);
      expect(mine, `${String(name)}(${JSON.stringify(args)})`).toEqual(held);
      return mine;
    };
    expect(await same('entries', [made.contract.id, made.deep.id, 'nothing'])).toHaveLength(2);
    expect(await same('ancestors', [made.contract.id])).toHaveLength(2);
    expect(await same('children', [made.clients.id, null], ['ana'])).toHaveLength(6);
    await same('children', [null]);
    expect(await same('subtrees', [made.clients.id])).toHaveLength(5);
    expect(await same('recent', 'ana', 10)).toHaveLength(2);
    await same('recent', 'bea', 10);
    expect(await same('trashed', { user: 'ana' })).toHaveLength(1);
    await same('trashed', { before: '2999-01-01T00:00:00.000Z' });
    expect(await same('sharedWith', ['bea', '*', 'group:sales'])).toHaveLength(2);
    // Without case or accents, and a % taken as it is.
    expect(await same('named', ['ano'], 10)).toHaveLength(1);
    expect(await same('named', ['100%'], 10)).toHaveLength(1);
    expect(await same('named', ['100_'], 10)).toHaveLength(0);
    expect(await same('withHashes', ['a'.repeat(64)])).toHaveLength(1);
    await same('owned', 'bea');
    const link = (drive.entries.get(made.contract.id) as Entry).links![0].id;
    expect(await same('withLink', link)).toBe(made.contract.id);
    expect(await same('withLink', 'no such link')).toBeUndefined();
    expect(await same('withField', 'client', 'northwind', 10)).toHaveLength(2);
    expect(await same('withField', 'case.no', '2026-114', 10)).toHaveLength(1);
    expect(await same('withField', 'client', 'acme', 10)).toHaveLength(0);
  });
});

describe('rows written before the columns', () => {
  it('are filled once when the store opens, and found by them', async () => {
    const path = join(folder, 'old.sqlite');
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE rebofiles_entries (id TEXT PRIMARY KEY, parent TEXT, entry TEXT NOT NULL)');
    const at = { by: 'ana', at: '2026-01-01T00:00:00.000Z' };
    let drive = core.createFolder(core.emptyDrive(), { id: 'f', name: 'Ciudad Año', parent: null }, at);
    drive = core.share(drive, 'f', 'bea', 'viewer', at);
    for (const entry of drive.entries.values()) db.prepare('INSERT INTO rebofiles_entries VALUES (?, ?, ?)').run(entry.id, entry.parent, JSON.stringify(entry));
    db.close();
    const store = await sqliteMetadata(path);
    expect(ids(await store.scoped!.named(['ano'], 10))).toEqual(['f']);
    expect(ids(await store.scoped!.sharedWith(['bea']))).toEqual(['f']);
    expect(ids(await store.scoped!.owned('ana'))).toEqual(['f']);
  });
});

describe('a drive of two hundred thousand entries', () => {
  it('lists a folder, finds by name and moves a file, without being read whole', async () => {
    const store = await sqliteMetadata(join(folder, 'large.sqlite'));
    const at = { by: 'ana', at: '2026-01-01T00:00:00.000Z' };
    // A hundred people's folders, each of two thousand files, written straight to the store.
    const put: Entry[] = [];
    for (let p = 0; p < 100; p++) {
      const owner = `person${p}`;
      put.push({ kind: 'folder', id: `top${p}`, name: `Folder ${p}`, parent: null, owner, created: at.at, modified: at.at, modifiedBy: owner });
      for (let f = 0; f < 2000; f++)
        put.push({
          kind: 'file',
          id: `f${p}-${f}`,
          name: `Report ${p}-${f}.pdf`,
          parent: `top${p}`,
          owner,
          type: 'application/pdf',
          created: at.at,
          modified: at.at,
          modifiedBy: owner,
          versions: [{ id: `v${p}-${f}`, key: `f${p}-${f}/v`, size: 1000, at: at.at, by: owner }],
        });
    }
    await store.save({ put, removed: [] });
    let loads = 0;
    const handle = createDriveHandler({
      storage: diskStorage({ folder: join(folder, 'large-files'), secret: 's' }),
      metadata: { ...store, load: () => (loads++, store.load()) },
      identify: (request) => ({ id: request.headers.get('x-user') ?? 'person7' }),
      authorize: (user, action, entry) => action !== 'configure' && (entry === null || entry.owner === user.id),
      secret: 'u',
      base: '/api/files',
    });
    const person = client(handle, 'person7');
    const timed = async <T>(work: () => Promise<T>) => {
      const started = performance.now();
      const done = await work();
      return { done, ms: performance.now() - started };
    };
    const top = await timed(() => person.ask('GET', '/api/files/entries'));
    expect(top.done.body.entries.map((e) => e.name)).toEqual(['Folder 7']);
    const listed = await timed(() => person.ask('GET', '/api/files/entries?folder=top7'));
    expect(listed.done.body.entries).toHaveLength(2000);
    const found = await timed(() => person.ask('GET', '/api/files/search?q=report 7-1999'));
    expect(found.done.body.entries.map((e) => e.name)).toEqual(['Report 7-1999.pdf']);
    const archive = (await person.ask('POST', '/api/files/folders', { name: 'Archive', parent: null })).body.entry;
    const moved = await timed(() => person.ask('PATCH', '/api/files/entries/f7-5', { parent: archive.id }));
    expect(moved.done.body.entry.parent).toBe(archive.id);
    expect(loads).toBe(0);
    // Generous, for a busy machine: held whole, each of these read two hundred thousand rows first.
    for (const { ms } of [top, listed, found, moved]) expect(ms).toBeLessThan(1500);
    console.log(`200,000 entries: top ${top.ms.toFixed(0)} ms, a folder of 2,000 ${listed.ms.toFixed(0)} ms, a search ${found.ms.toFixed(0)} ms, a move ${moved.ms.toFixed(0)} ms`);
  }, 120_000);
});
