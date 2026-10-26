// Files found by what is written in them: the text a page read, kept with the
// version it is of, found without case or accents, with a piece of it; only
// what one may read, out of the trash, as it is now. On each store.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { type MetadataStore, byRoles, createDriveHandler, diskStorage, memoryMetadata, postgresMetadata, sqliteMetadata } from '../src';
import { bytesOf, client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-text-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const drive = (metadata: MetadataStore) => {
  const handle = createDriveHandler({ storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }), metadata, identify, authorize: byRoles, secret: 'u', base: '/api/files' });
  return { send: (url: string, init: RequestInit) => handle(new Request(url, init)), ana: client(handle, 'ana'), bea: client(handle, 'bea') };
};
type Found = { results: { entry: FileEntry; snippet: string }[] };

const stores: [string, () => Promise<MetadataStore>][] = [
  ['in memory', async () => memoryMetadata()],
  ['on SQLite', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
  ['on Postgres', () => postgresMetadata(new PGlite())],
  ['in the process', async () => ({ ...memoryMetadata(), keepText: undefined, findText: undefined })],
];

describe.each(stores)('text, %s', (_, store) => {
  it('finds a file by what is written in it, as it is now, for who may read it', async () => {
    const d = drive(await store());
    const file = (await d.ana.upload(bytesOf(10), { name: 'minutes.txt', parent: null, type: 'text/plain' }, d.send)).body.entry as FileEntry;
    const said = 'At the meeting we agreed to call Acmé about the contract on Monday.';
    expect((await d.ana.ask('PUT', `/api/files/entries/${file.id}/text`, { version: 'old', text: said })).status).toBe(409);
    expect((await d.bea.ask('PUT', `/api/files/entries/${file.id}/text`, { version: file.versions[0].id, text: said })).status).toBe(403);
    expect((await d.ana.ask('PUT', `/api/files/entries/${file.id}/text`, { version: file.versions[0].id, text: said })).status).toBe(200);

    const found = (await d.ana.ask('GET', '/api/files/search/text?q=ACME%20contrac')).body as unknown as Found;
    expect(found.results.map((r) => r.entry.name)).toEqual(['minutes.txt']);
    expect(found.results[0].snippet).toContain('call Acmé about the contract');
    expect(((await d.ana.ask('GET', '/api/files/search/text?q=acme%20tuesday')).body as unknown as Found).results).toEqual([]);
    expect(((await d.bea.ask('GET', '/api/files/search/text?q=acme')).body as unknown as Found).results).toEqual([]);

    // A new version without text of its own: the old text is not its.
    await d.ana.upload(bytesOf(12), { file: file.id, type: 'text/plain' }, d.send);
    expect(((await d.ana.ask('GET', '/api/files/search/text?q=acme')).body as unknown as Found).results).toEqual([]);
  });
});
