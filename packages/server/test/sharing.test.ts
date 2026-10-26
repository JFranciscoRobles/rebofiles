// Sharing through the routes, as two people would: Ana's drive, and Bea, who
// is given some of it. Who may do what is `byRoles`, from the drive itself.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Entry, FileEntry } from '@rebofiles/core';
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

  it('empties one’s own trash, whatever others have in theirs', async () => {
    const d = drive();
    const { contract } = await anasClients(d);
    const mine = (await d.bea.ask('POST', '/api/files/folders', { name: 'Old', parent: null })).body.entry;
    await d.ana.ask('POST', `/api/files/entries/${contract.id}/trash`);
    await d.bea.ask('POST', `/api/files/entries/${mine.id}/trash`);
    expect((await d.bea.ask('POST', '/api/files/trash/empty')).body.removed).toEqual([mine.id]);
    expect(names((await d.ana.ask('GET', '/api/files/trash')).body.entries)).toEqual(['contract.txt']);
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

  it('counts what is new in Shared with me until they look, and tells the application of each share', async () => {
    const told: string[] = [];
    let at = Date.parse('2026-03-01T10:00:00Z');
    const d = drive({ now: () => new Date(at), onShare: ({ entry, with: who, role, by, first }) => void told.push(`${by.id}>${who}:${entry.name}:${role}:${first}`) });
    const { clients, northwind } = await anasClients(d);
    expect((await d.bea.ask('GET', '/api/files/shared/new')).body.count).toBe(0);
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' });
    await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'editor' });
    await new Promise((done) => setTimeout(done, 0));
    expect(told).toEqual(['ana>bea:Clients:viewer:true', 'ana>bea:Clients:editor:false']);
    expect((await d.bea.ask('GET', '/api/files/shared/new')).body.count).toBe(1);

    at += 60_000;
    await d.bea.ask('POST', '/api/files/shared/seen');
    expect((await d.bea.ask('GET', '/api/files/shared/new')).body.count).toBe(0);
    at += 60_000;
    const other = (await d.ana.ask('POST', '/api/files/folders', { name: 'Other', parent: null })).body.entry;
    await d.ana.ask('POST', `/api/files/entries/${other.id}/shares`, { with: 'bea', role: 'viewer' });
    expect((await d.bea.ask('GET', '/api/files/shared/new')).body.count).toBe(1);
    // One shared inside what they have already is not new at the top: it is not there.
    await d.ana.ask('POST', `/api/files/entries/${northwind.id}/shares`, { with: 'bea', role: 'editor' });
    expect((await d.bea.ask('GET', '/api/files/shared/new')).body.count).toBe(1);
  });

  it('answers a share even when telling of it fails', async () => {
    const d = drive({ onShare: () => Promise.reject(new Error('no mail today')) });
    const { clients } = await anasClients(d);
    const errors: unknown[] = [];
    const log = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    try {
      expect((await d.ana.ask('POST', `/api/files/entries/${clients.id}/shares`, { with: 'bea', role: 'viewer' })).status).toBe(200);
      await new Promise((done) => setTimeout(done, 0));
    } finally {
      console.error = log;
    }
    expect(errors).toHaveLength(1);
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

  it('with a password, ask for it at every request and keep only what scrypt makes of it', async () => {
    const d = drive();
    const { clients, contract } = await anasClients(d);
    expect((await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { password: 'abc' })).status).toBe(400);
    const made = await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { password: 'open sesame' });
    expect(made.body.entry.links).toMatchObject([{ locked: true }]);
    expect(JSON.stringify(made.body)).not.toContain('open sesame');
    const path = `http://drive.test/api/files/links/${encodeURIComponent(made.body.token as string)}`;
    const asking = (password?: string, rest = '') => d.handle(new Request(path + rest, password ? { headers: { 'x-link-password': password } } : undefined));

    const none = await asking();
    expect([none.status, ((await none.json()) as { error: string }).error]).toEqual([401, 'link-password']);
    const wrong = await asking('open barley');
    expect([wrong.status, ((await wrong.json()) as { error: string }).error]).toEqual([401, 'link-password-wrong']);
    expect((await asking(undefined, `/download?id=${contract.id}`)).status).toBe(401);
    expect(names(((await (await asking('open sesame')).json()) as { entries: Entry[] }).entries)).toEqual(['Northwind']);
    expect((await asking('open sesame', `/download?id=${contract.id}`)).status).toBe(200);
  });

  it('of one use, work for the download that takes it, a while longer, and then no more', async () => {
    // Near the clock's own time, as the token of a link is checked against it.
    let at = Date.now();
    const d = drive({ now: () => new Date(at) });
    const { clients, contract } = await anasClients(d);
    const made = await d.ana.ask('POST', `/api/files/entries/${clients.id}/links`, { once: true });
    const token = encodeURIComponent(made.body.token as string);
    // Looking, and seeing a file in the page, take nothing.
    expect((await anonymous(d, `/links/${token}`)).status).toBe(200);
    expect((await anonymous(d, `/links/${token}/download?id=${contract.id}&inline=1`)).status).toBe(200);
    expect((await d.ana.ask('GET', `/api/files/entries/${clients.id}`)).body.entry.links![0]).not.toHaveProperty('used');

    // An archive takes it; the addresses of its files come after, and still do.
    expect((await anonymous(d, `/links/${token}/zip`)).status).toBe(200);
    at += 60_000;
    expect((await anonymous(d, `/links/${token}/urls?ids=${contract.id}`)).status).toBe(200);
    expect((await d.ana.ask('GET', `/api/files/entries/${clients.id}`)).body.entry.links![0]).toMatchObject({ uses: 1, used: 1 });
    at += 15 * 60_000;
    expect((await anonymous(d, `/links/${token}`)).status).toBe(404);
  });

  it('are not taken for another token of the server', async () => {
    const d = drive();
    const asked = await d.ana.ask('POST', '/api/files/uploads', { name: 'a.txt', parent: null, size: 1 });
    expect((await anonymous(d, `/links/${encodeURIComponent(asked.body.token as string)}`)).status).toBe(404);
  });
});

describe('the same file again', () => {
  const hash = 'a'.repeat(64);
  it('is found by the SHA-256 kept with its version, among what one may read, outside the trash', async () => {
    const d = drive();
    const { clients } = await anasClients(d);
    const file = (await d.ana.upload(bytesOf(10), { name: 'x.txt', parent: clients.id, type: 'text/plain', sha256: hash }, d.send)).body.entry;
    expect((file as FileEntry).versions[0].sha256).toBe(hash);
    // A hash that is not one is not kept.
    expect(((await d.ana.upload(bytesOf(10), { name: 'y.txt', parent: null, sha256: 'nope' }, d.send)).body.entry as FileEntry).versions[0]).not.toHaveProperty('sha256');

    const found = (await d.ana.ask('POST', '/api/files/duplicates', { hashes: [hash, 'b'.repeat(64), 'bad'] })).body.found as Record<string, Entry[]>;
    expect(Object.keys(found)).toEqual([hash]);
    expect(found[hash].map((e) => e.name)).toEqual(['x.txt']);
    expect((await d.bea.ask('POST', '/api/files/duplicates', { hashes: [hash] })).body.found).toEqual({});
    await d.ana.ask('POST', `/api/files/entries/${file.id}/trash`);
    expect((await d.ana.ask('POST', '/api/files/duplicates', { hashes: [hash] })).body.found).toEqual({});
  });
});

describe('how an entry looks', () => {
  it('a folder takes a colour from who may rename it, and a picture its placeholder from who may upload to it', async () => {
    const d = drive();
    const { clients, contract } = await anasClients(d);
    expect((await d.ana.ask('PATCH', `/api/files/entries/${clients.id}`, { color: 'purple' })).body.entry).toMatchObject({ color: 'purple' });
    expect((await d.ana.ask('PATCH', `/api/files/entries/${clients.id}`, { color: 'chartreuse' })).status).toBe(400);
    expect((await d.bea.ask('PATCH', `/api/files/entries/${clients.id}`, { color: 'red' })).status).toBe(403);
    expect((await d.ana.ask('PATCH', `/api/files/entries/${clients.id}`, { color: null })).body.entry).not.toHaveProperty('color');

    const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
    const version = (contract as FileEntry).versions[0].id;
    const put = (who: typeof d.ana, placeholder: string) => who.ask('PUT', `/api/files/entries/${contract.id}/placeholder`, { version, placeholder });
    expect(((await put(d.ana, tiny)).body.entry as FileEntry).versions[0].placeholder).toBe(tiny);
    expect((await put(d.ana, 'javascript:alert(1)')).status).toBe(400);
    expect((await put(d.bea, tiny)).status).toBe(403);
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

describe('sharing with a group', () => {
  it('reaches whoever identify says is in it: in Shared with me, to read and, as an editor, to upload', async () => {
    const handle = createDriveHandler({
      storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
      metadata: memoryMetadata(),
      identify: (request) => {
        const id = request.headers.get('x-user');
        return id ? { id, groups: id === 'bea' ? ['ventas'] : [] } : null;
      },
      authorize: byRoles,
      secret: 'u',
      base: '/api/files',
    });
    const send = (url: string, init: RequestInit) => handle(new Request(url, init));
    const ana = client(handle, 'ana');
    const sales = (await ana.ask('POST', '/api/files/folders', { name: 'Sales', parent: null })).body.entry;
    expect((await ana.ask('POST', `/api/files/entries/${sales.id}/shares`, { with: 'group:ventas', role: 'editor' })).status).toBe(200);
    const bea = client(handle, 'bea');
    expect(names((await bea.ask('GET', '/api/files/shared')).body.entries)).toEqual(['Sales']);
    expect((await bea.upload(bytesOf(4), { name: 'q4.txt', parent: sales.id }, send)).status).toBe(200);
    const carl = client(handle, 'carl');
    expect((await carl.ask('GET', '/api/files/shared')).body.entries).toEqual([]);
    expect((await carl.ask('GET', `/api/files/entries?folder=${sales.id}`)).status).toBe(403);
  });
});
