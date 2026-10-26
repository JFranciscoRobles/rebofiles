// The drive held in memory between requests, by the revision of its store:
// loaded again only once it changed, by this process or another, so a
// listing does not read every entry, and no process sees an old drive.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Entry } from '@rebofiles/core';
import { type MetadataStore, createDriveHandler, diskStorage, everyone, memoryMetadata, postgresMetadata, sqliteMetadata } from '../src';
import { client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-held-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** A store that counts how often the drive is read whole from it, held whole: without the queries that answer a piece at a time. */
function counted(store: MetadataStore) {
  const seen = { loads: 0 };
  return { seen, store: { ...store, scoped: undefined, load: () => (seen.loads++, store.load()) } as MetadataStore };
}
const handler = (metadata: MetadataStore) =>
  createDriveHandler({ storage: diskStorage({ folder: join(folder, 'files'), secret: 's' }), metadata, ...everyone('ana'), secret: 'u', base: '/api/files' });
const names = (entries: Entry[]) => entries.map((entry) => entry.name).sort();

describe('the drive held in memory', () => {
  it('is read whole once while nothing changes, and again after a change', async () => {
    const { seen, store } = counted(memoryMetadata());
    const ana = client(handler(store));
    await ana.ask('POST', '/api/files/folders', { name: 'Contracts', parent: null });
    const after = seen.loads;
    for (let i = 0; i < 20; i++) await ana.ask('GET', '/api/files/entries');
    await ana.ask('GET', '/api/files/search?q=contracts');
    expect(seen.loads).toBe(after);
    // A change made here is held as it was saved: nothing to read again for it.
    await ana.ask('POST', '/api/files/folders', { name: 'Invoices', parent: null });
    expect(names((await ana.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Contracts', 'Invoices']);
    expect(seen.loads).toBe(after);
  });

  it('on SQLite, sees at once what another process wrote to the same file', async () => {
    const path = join(folder, 'two.sqlite');
    const one = client(handler(await sqliteMetadata(path)));
    const two = client(handler(await sqliteMetadata(path)));
    await one.ask('POST', '/api/files/folders', { name: 'From one', parent: null });
    expect(names((await two.ask('GET', '/api/files/entries')).body.entries)).toEqual(['From one']);
    await two.ask('POST', '/api/files/folders', { name: 'From two', parent: null });
    expect(names((await one.ask('GET', '/api/files/entries')).body.entries)).toEqual(['From one', 'From two']);
  });

  it('on Postgres too, the revision going up in the statement that writes', async () => {
    const db = new PGlite();
    const one = client(handler(await postgresMetadata(db)));
    const two = client(handler(await postgresMetadata(db)));
    const made = (await one.ask('POST', '/api/files/folders', { name: 'Shared', parent: null })).body.entry;
    expect(names((await two.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Shared']);
    await two.ask('PATCH', `/api/files/entries/${made.id}`, { name: 'Renamed' });
    expect(names((await one.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Renamed']);
    expect((await db.query<{ n: number }>('SELECT n FROM rebofiles_entries_revision')).rows[0].n).toBe(2);
  });

  it('is never read whole from a store that answers a piece at a time', async () => {
    const memory = memoryMetadata();
    let loads = 0;
    const ana = client(handler({ ...memory, load: () => (loads++, memory.load()) }));
    const made = (await ana.ask('POST', '/api/files/folders', { name: 'Contracts', parent: null })).body.entry;
    await ana.ask('GET', '/api/files/entries');
    await ana.ask('PATCH', `/api/files/entries/${made.id}`, { name: 'Contracts 2026' });
    await ana.ask('GET', '/api/files/search?q=2026');
    expect(loads).toBe(0);
  });

  it('is read on every request from a store with no revision, as before', async () => {
    const { revision: _, ...plain } = memoryMetadata();
    const { seen, store } = counted(plain);
    const ana = client(handler(store));
    await ana.ask('GET', '/api/files/entries');
    await ana.ask('GET', '/api/files/entries');
    expect(seen.loads).toBe(2);
  });
});
