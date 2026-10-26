// What was done in the drive, through the routes: kept as each change is, by
// whoever made it, and read for an entry and for what is in a folder; on each
// store, and in the process for a store that keeps none.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Activity } from '@rebofiles/core';
import { type MetadataStore, byRoles, createDriveHandler, diskStorage, memoryMetadata, postgresMetadata, sqliteMetadata } from '../src';
import { bytesOf, client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-activity-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const drive = (metadata: MetadataStore) => {
  const handle = createDriveHandler({ storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }), metadata, identify, authorize: byRoles, secret: 'u', base: '/api/files' });
  return { send: (url: string, init: RequestInit) => handle(new Request(url, init)), ana: client(handle, 'ana'), bea: client(handle, 'bea') };
};
const told = (lines: Activity[]) => lines.map((a) => `${a.by} ${a.action} ${a.name}`);

const stores: [string, () => Promise<MetadataStore>][] = [
  ['in memory', async () => memoryMetadata()],
  ['on SQLite', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
  ['on Postgres', () => postgresMetadata(new PGlite())],
  // A store of only the entries: the activity kept in the process.
  ['in the process', async () => ({ ...memoryMetadata(), record: undefined, activity: undefined })],
];

describe.each(stores)('the activity, %s', (_, store) => {
  it('is what each did to an entry and in a folder, the newest first, to who may read it', async () => {
    const d = drive(await store());
    const clients = (await d.ana.ask('POST', '/api/files/folders', { name: 'Clients', parent: null })).body.entry;
    const file = (await d.ana.upload(bytesOf(10), { name: 'a.txt', parent: clients.id, type: 'text/plain' }, d.send)).body.entry;
    await d.ana.ask('PATCH', `/api/files/entries/${file.id}`, { name: 'b.txt' });
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'editor' });
    await d.bea.ask('POST', `/api/files/entries/${file.id}/trash`);

    const ofFile = (await d.ana.ask('GET', `/api/files/entries/${file.id}/activity`)).body.activity as Activity[];
    expect(told(ofFile)).toEqual(['bea trashed b.txt', 'ana renamed b.txt', 'ana uploaded a.txt']);
    expect(ofFile[1]).toMatchObject({ was: 'a.txt', parent: clients.id });
    const ofFolder = (await d.bea.ask('GET', `/api/files/entries/${clients.id}/activity?limit=2`)).body.activity as Activity[];
    expect(told(ofFolder)).toEqual(['bea trashed b.txt', 'ana shared Clients']);

    const own = (await d.bea.ask('POST', '/api/files/folders', { name: 'Mine', parent: null })).body.entry;
    expect((await d.ana.ask('GET', `/api/files/entries/${own.id}/activity`)).status).toBe(403);
  });
});
