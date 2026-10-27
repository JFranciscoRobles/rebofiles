// The application's own fields of an entry: set and taken away by who may
// rename it, refused when they are not names and texts, and found by, of what
// the one asking may read.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';
import { client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-fields-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const drive = () =>
  createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    identify: (request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null),
    authorize: byRoles,
    secret: 's',
    base: '/api/files',
  });

describe('fields of an entry', () => {
  it('are set, changed and taken away, and found by', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const folder = (await ana.ask('POST', '/api/files/folders', { name: 'Acme', parent: null })).body.entry;
    let entry = (await ana.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { client: 'acme', stage: 'won' } })).body.entry;
    expect(entry.fields).toEqual({ client: 'acme', stage: 'won' });
    entry = (await ana.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { stage: null, owner: 'ana' } })).body.entry;
    expect(entry.fields).toEqual({ client: 'acme', owner: 'ana' });
    const found = (await ana.ask('GET', '/api/files/fields?name=client&value=acme')).body.entries;
    expect(found.map((one: { id: string }) => one.id)).toEqual([folder.id]);
    expect((await ana.ask('GET', '/api/files/fields?name=client&value=other')).body.entries).toEqual([]);
  });

  it('are refused when they are not names and texts, and set only by who may rename', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const folder = (await ana.ask('POST', '/api/files/folders', { name: 'Acme', parent: null })).body.entry;
    expect((await ana.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { 'a b': 'x' } })).status).toBe(400);
    expect((await ana.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { ok: 7 } })).body.error).toBe('invalid-field');
    expect((await ana.ask('GET', '/api/files/fields?name=a%20b&value=x')).status).toBe(400);
    await ana.ask('POST', `/api/files/entries/${folder.id}/shares`, { with: 'bea', role: 'viewer' });
    expect((await bea.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { client: 'acme' } })).status).toBe(403);
    // Found only by who may read it.
    await ana.ask('PATCH', `/api/files/entries/${folder.id}`, { fields: { client: 'acme' } });
    expect((await client(handle, 'carl').ask('GET', '/api/files/fields?name=client&value=acme')).body.entries).toEqual([]);
    expect((await bea.ask('GET', '/api/files/fields?name=client&value=acme')).body.entries).toHaveLength(1);
  });
});
