// The metadata on Postgres. Through the routes, on PGlite, which is Postgres
// itself in the process, so `npm test` needs no database. Two processes on one
// database need a real one: REBOFILES_TEST_POSTGRES=postgres://… runs that too.

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import type { Entry } from '@rebofiles/core';
import { createDriveHandler, diskStorage, postgresMetadata } from '../src';
import { client } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const names = (entries: Entry[]) => entries.map((entry) => entry.name).sort();
const options = { storage: diskStorage({ folder: '/tmp/rebofiles-postgres-unused', secret: 's' }), identify, authorize: () => true, secret: 'x', base: '/api/files' };

describe('metadata on Postgres', () => {
  it('keeps the drive, and writes only what changed', async () => {
    const db = new PGlite();
    const one = client(createDriveHandler({ ...options, metadata: await postgresMetadata(db) }));
    const made = (await one.ask('POST', '/api/files/folders', { name: 'Kept', parent: null })).body.entry;
    const inside = (await one.ask('POST', '/api/files/folders', { name: 'Inside', parent: made.id })).body.entry;
    await one.ask('PATCH', `/api/files/entries/${made.id}`, { name: 'Kept again' });

    // Another handler on the same database, as after a restart.
    const two = client(createDriveHandler({ ...options, metadata: await postgresMetadata(db) }));
    expect(names((await two.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Kept again']);
    expect(names((await two.ask('GET', `/api/files/entries?folder=${made.id}`)).body.entries)).toEqual(['Inside']);
    const row = await db.query<{ parent: string; entry: Entry }>('SELECT parent, entry FROM rebofiles_entries WHERE id = $1', [inside.id]);
    expect(row.rows[0]).toMatchObject({ parent: made.id, entry: { name: 'Inside', kind: 'folder' } });

    await two.ask('POST', `/api/files/entries/${made.id}/trash`);
    await two.ask('DELETE', `/api/files/entries/${made.id}`);
    expect((await db.query('SELECT id FROM rebofiles_entries')).rows).toEqual([]);
  });

  it('keeps the settings beside the entries', async () => {
    const db = new PGlite();
    const first = await postgresMetadata(db);
    await first.setSetting!('drive', { brand: '#123456' });
    await first.setSetting!('drive', { brand: '#654321' });
    const again = await postgresMetadata(db);
    expect(await again.getSetting!('drive')).toEqual({ brand: '#654321' });
    expect(await again.getSetting!('person:bea')).toBeUndefined();
  });

  it('takes a table of its own, and refuses a name that is not one', async () => {
    const db = new PGlite();
    const drive = client(createDriveHandler({ ...options, metadata: await postgresMetadata(db, { table: 'acme_files' }) }));
    await drive.ask('POST', '/api/files/folders', { name: 'Acme', parent: null });
    expect((await db.query('SELECT count(*)::int AS n FROM acme_files')).rows).toEqual([{ n: 1 }]);
    await expect(postgresMetadata(db, { table: 'x; DROP TABLE acme_files' })).rejects.toThrow('cannot be the name of a table');
  });

  it('reads an entry that comes as text, as some drivers give jsonb', async () => {
    const db = new PGlite();
    const folder = { kind: 'folder', id: 'f', name: 'As text', parent: null, owner: 'ana', created: '2026-10-25T00:00:00Z', modified: '2026-10-25T00:00:00Z', modifiedBy: 'ana' };
    const store = await postgresMetadata({ query: async (text, values) => (text.startsWith('SELECT entry') ? { rows: [{ entry: JSON.stringify(folder) }] } : db.query(text, values)) });
    expect((await store.load()).entries.get('f')?.name).toBe('As text');
  });
});

describe.skipIf(!process.env.REBOFILES_TEST_POSTGRES)('two processes on one Postgres', () => {
  it('never gives two folders made at once the same name', async () => {
    const { default: pg } = await import('pg');
    const url = process.env.REBOFILES_TEST_POSTGRES!;
    const table = `rebofiles_test_${Date.now()}`;
    // Two pools, as two servers have.
    const pools = [new pg.Pool({ connectionString: url, max: 5 }), new pg.Pool({ connectionString: url, max: 5 })];
    try {
      const drives = await Promise.all(pools.map(async (pool) => client(createDriveHandler({ ...options, metadata: await postgresMetadata(pool, { table }) }))));
      const tries = await Promise.all(Array.from({ length: 20 }, (_, i) => drives[i % 2].ask('POST', '/api/files/folders', { name: 'Same', parent: null })));
      // Something new with a name taken is made free with "(2)": each must have found the drive the one before left.
      expect(tries.map((answer) => answer.status)).toEqual(Array(20).fill(200));
      const made = (await pools[0].query(`SELECT entry->>'name' AS name FROM ${table}`)).rows.map((row) => row.name);
      expect(new Set(made).size).toBe(20);
    } finally {
      await pools[0].query(`DROP TABLE IF EXISTS ${table}`);
      await Promise.all(pools.map((pool) => pool.end()));
    }
  });
});
