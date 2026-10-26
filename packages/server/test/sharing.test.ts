// Sharing through the routes, as two people would: Ana's drive, and Bea, who
// is given some of it. Who may do what is `byRoles`, from the drive itself.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Entry } from '@rebofiles/core';
import { type DriveServerOptions, byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';
import { bytesOf, client } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const names = (entries: Entry[]) => entries.map((entry) => entry.name);

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-sharing-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

function drive(extra: Partial<DriveServerOptions> = {}) {
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    identify,
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    ...extra,
  });
  const send = (url: string, init: RequestInit) => handle(new Request(url, init));
  return { handle, send, ana: client(handle, 'ana'), bea: client(handle, 'bea') };
}

/** Ana's Clients, with Northwind in it and a contract in that. */
async function anasClients(d: ReturnType<typeof drive>) {
  const clients = (await d.ana.ask('POST', '/api/files/folders', { name: 'Clients', parent: null })).body.entry;
  const northwind = (await d.ana.ask('POST', '/api/files/folders', { name: 'Northwind', parent: clients.id })).body.entry;
  const contract = (await d.ana.upload(bytesOf(100), { name: 'contract.txt', parent: northwind.id, type: 'text/plain' }, d.send)).body.entry;
  await d.ana.ask('POST', '/api/files/folders', { name: 'Private', parent: null });
  return { clients, northwind, contract };
}

describe('sharing, through the routes', () => {
  it('shows each one their own top, and what was shared with them in Shared with me', async () => {
    const d = drive();
    const { clients } = await anasClients(d);
    await d.bea.ask('POST', '/api/files/folders', { name: 'Clients', parent: null });
    expect(names((await d.bea.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Clients']);
    expect((await d.bea.ask('GET', '/api/files/shared')).body.entries).toEqual([]);

    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' });
    expect(names((await d.bea.ask('GET', '/api/files/shared')).body.entries)).toEqual(['Clients']);
    // Still only hers at her top: Ana's is in Shared with me, and the name is hers too without "(2)".
    expect(names((await d.bea.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Clients']);
    expect(names((await d.ana.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Clients', 'Private']);
  });

  it('lets a viewer look, read and download inside, and nothing more', async () => {
    const d = drive();
    const { clients, northwind, contract } = await anasClients(d);
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' });

    const listed = await d.bea.ask('GET', `/api/files/entries?folder=${northwind.id}`);
    expect(names(listed.body.entries)).toEqual(['contract.txt']);
    expect(names(listed.body.path as Entry[])).toEqual(['Clients', 'Northwind']);
    expect((await d.bea.ask('GET', `/api/files/entries/${contract.id}/download`)).status).toBe(200);

    expect((await d.bea.ask('POST', '/api/files/folders', { name: 'Mine', parent: northwind.id })).status).toBe(403);
    expect((await d.bea.ask('PATCH', `/api/files/entries/${contract.id}`, { name: 'x.txt' })).status).toBe(403);
    expect((await d.bea.ask('POST', `/api/files/entries/${contract.id}/trash`)).status).toBe(403);
    expect((await d.bea.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'cris', role: 'viewer' })).status).toBe(403);
    expect((await d.bea.ask('GET', `/api/files/search?q=private`)).body.entries).toEqual([]);
  });

  it('says where an entry is only from where it was shared', async () => {
    const d = drive();
    const { northwind, contract } = await anasClients(d);
    await d.ana.ask('POST', `/api/files/entries/${northwind.id}/shares`, { with: 'bea', role: 'viewer' });
    expect(names((await d.bea.ask('GET', `/api/files/entries/${contract.id}`)).body.path as unknown as Entry[])).toEqual(['Northwind']);
    expect((await d.bea.ask('GET', `/api/files/entries/${northwind.id}`)).body.path).toEqual([]);
  });

  it('lets an editor put files in and change them, but not delete what is not theirs', async () => {
    const d = drive();
    const { clients, northwind, contract } = await anasClients(d);
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'editor' });

    const quote = (await d.bea.upload(bytesOf(10), { name: 'quote.txt', parent: northwind.id, type: 'text/plain' }, d.send)).body.entry;
    expect(quote).toMatchObject({ owner: 'bea', parent: northwind.id });
    expect(names((await d.ana.ask('GET', `/api/files/entries?folder=${northwind.id}`)).body.entries)).toEqual(['contract.txt', 'quote.txt']);
    expect((await d.bea.ask('PATCH', `/api/files/entries/${contract.id}`, { name: 'contract v2.txt' })).status).toBe(200);

    await d.bea.ask('POST', `/api/files/entries/${contract.id}/trash`);
    await d.bea.ask('POST', `/api/files/entries/${quote.id}/trash`);
    // Hers to delete for good, as she owns it; Ana's not.
    expect((await d.bea.ask('DELETE', `/api/files/entries/${quote.id}`)).status).toBe(200);
    expect((await d.bea.ask('DELETE', `/api/files/entries/${contract.id}`)).status).toBe(403);
    expect((await d.ana.ask('DELETE', `/api/files/entries/${contract.id}`)).status).toBe(200);
  });

  it('shows in one’s trash what one owns or threw away, not what others threw away where one may look', async () => {
    const d = drive();
    const { clients, contract } = await anasClients(d);
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' });
    await d.ana.ask('POST', `/api/files/entries/${contract.id}/trash`);
    expect(names((await d.ana.ask('GET', '/api/files/trash')).body.entries)).toEqual(['contract.txt']);
    expect((await d.bea.ask('GET', '/api/files/trash')).body.entries).toEqual([]);
  });

  it('lets someone leave what was shared with them, and only who may share take it from others', async () => {
    const d = drive();
    const { clients } = await anasClients(d);
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' });
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'cris', role: 'viewer' });
    expect((await d.bea.ask('DELETE', `/api/files/entries/${clients.id}/shares/cris`)).status).toBe(403);
    expect((await d.bea.ask('DELETE', `/api/files/entries/${clients.id}/shares/bea`)).status).toBe(200);
    expect((await d.bea.ask('GET', '/api/files/shared')).body.entries).toEqual([]);
    expect((await d.bea.ask('GET', `/api/files/entries?folder=${clients.id}`)).status).toBe(403);
  });

  it('shows everything one may read at the top, for one drive of a whole team', async () => {
    const d = drive({ top: 'everyone', authorize: () => true });
    await anasClients(d);
    expect(names((await d.bea.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Clients', 'Private']);
  });
});

describe('links, through the routes', () => {
  /** What a link reads, asked as someone who is not signed in. */
  const anonymous = (d: ReturnType<typeof drive>, path: string) =>
    d.handle(new Request(`http://drive.test/api/files${path}`)).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> & { entries: Entry[]; url: string } }));

  it('read a folder and what is in it without signing in, and nothing outside it', async () => {
    const d = drive();
    const { clients, northwind, contract } = await anasClients(d);
    const made = await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { days: 7 });
    const token = encodeURIComponent(made.body.token as string);
    expect(made.body.entry.links).toMatchObject([{ role: 'viewer', by: 'ana' }]);

    expect(names((await anonymous(d, `/links/${token}`)).body.entries)).toEqual(['Northwind']);
    expect(names((await anonymous(d, `/links/${token}?folder=${northwind.id}`)).body.entries)).toEqual(['contract.txt']);
    const { url } = (await anonymous(d, `/links/${token}/download?id=${contract.id}`)).body;
    expect(await (await d.handle(new Request(`http://drive.test${url}`))).text()).toHaveLength(100);

    const elsewhere = (await d.ana.ask('GET', '/api/files/entries')).body.entries.find((e) => e.name === 'Private')!;
    expect((await anonymous(d, `/links/${token}?folder=${elsewhere.id}`)).status).toBe(404);
  });

  it('give the same address again, and stop working when taken back or changed', async () => {
    const d = drive();
    const { clients } = await anasClients(d);
    const made = await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, {});
    const link = made.body.entry.links![0];
    expect((await d.ana.ask('GET', `/api/files/entries/${clients.id}/links/${link.id}`)).body.token).toBe(made.body.token);
    expect((await d.bea.ask('GET', `/api/files/entries/${clients.id}/links/${link.id}`)).status).toBe(403);

    const token = made.body.token as string;
    expect((await anonymous(d, `/links/${encodeURIComponent(`${token}x`)}`)).status).toBe(404);
    await d.ana.ask('DELETE', `/api/files/entries/${clients.id}/links/${link.id}`);
    expect((await anonymous(d, `/links/${encodeURIComponent(token)}`)).status).toBe(404);
  });

  it('last from a day to ninety', async () => {
    const d = drive();
    const { clients } = await anasClients(d);
    expect((await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { days: 91 })).status).toBe(400);
    expect((await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { days: 0 })).status).toBe(400);
  });

  it('are not taken for another token of the server', async () => {
    const d = drive();
    const asked = await d.ana.ask('POST', '/api/files/uploads', { name: 'a.txt', parent: null, size: 1 });
    expect((await anonymous(d, `/links/${encodeURIComponent(asked.body.token as string)}`)).status).toBe(404);
  });
});

describe('byRoles', () => {
  it('lets anyone look at the top and put things there, and nothing else there', () => {
    const empty = { entries: new Map() };
    expect(byRoles({ id: 'bea' }, 'list', null, empty)).toBe(true);
    expect(byRoles({ id: 'bea' }, 'upload', null, empty)).toBe(true);
    expect(byRoles({ id: 'bea' }, 'delete', null, empty)).toBe(false);
  });
});
