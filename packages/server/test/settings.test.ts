// The settings of a drive, changed by whoever may configure it, and each
// person's own over them; and the smaller pictures of an image, kept with its
// version, read at a size, and gone with it.

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@rebofiles/core';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata, sqliteMetadata } from '../src';
import { type Handler, bytesOf, client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-settings-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

// Ana is the one who may configure the drive.
const identify = (request: Request) => {
  const id = request.headers.get('x-user');
  return id ? { id, admin: id === 'ana' } : null;
};

function drive(extra: { at?: string; metadata?: Parameters<typeof createDriveHandler>[0]['metadata'] } = {}): Handler {
  return createDriveHandler({
    storage: diskStorage({ folder: extra.at ?? join(folder, String(Math.random())), secret: 's' }),
    metadata: extra.metadata ?? memoryMetadata(),
    identify,
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
  });
}

describe('the settings', () => {
  it('are the defaults until changed, and only someone who may configure changes the drive’s', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    expect((await bea.ask('GET', '/api/files/settings')).body).toEqual({
      drive: DEFAULT_SETTINGS,
      mine: {},
      settings: DEFAULT_SETTINGS,
      canConfigure: false,
      saved: false,
      you: 'bea',
      can: { remind: false, expiring: true, people: false },
    });
    expect((await ana.ask('GET', '/api/files/settings')).body.canConfigure).toBe(true);

    expect((await bea.ask('PUT', '/api/files/settings', { language: 'es' })).status).toBe(403);
    const changed = await ana.ask('PUT', '/api/files/settings', { language: 'es', brand: '#1D4ED8', images: { sizes: [2000, 100, 400, 900], format: 'original' } });
    expect(changed.body.drive).toEqual({
      language: 'es',
      theme: 'light',
      brand: '#1d4ed8',
      company: null,
      images: { sizes: [100, 400, 900, 2000], format: 'original', quality: 0.82, enabled: true },
      quota: null,
      trashDays: null,
      retentionDays: null,
      requestTemplates: [],
    });
    // A change is over what was there: what is left out stays.
    expect(((await ana.ask('PUT', '/api/files/settings', { theme: 'auto' })).body.drive as { language: string }).language).toBe('es');

    const refused = await ana.ask('PUT', '/api/files/settings', { images: { sizes: [1, 2] } });
    expect([refused.status, refused.body.error]).toEqual([400, 'invalid-settings']);
  });

  it('are each person’s own over the drive’s', async () => {
    const handle = drive();
    await client(handle, 'ana').ask('PUT', '/api/files/settings', { language: 'es', theme: 'dark' });
    const bea = client(handle, 'bea');
    expect((await bea.ask('PUT', '/api/files/settings/mine', { language: 'en', brand: '#000000' })).body.mine).toEqual({ language: 'en' });
    const seen = (await bea.ask('GET', '/api/files/settings')).body as unknown as { settings: { language: string; theme: string }; mine: object };
    expect([seen.settings.language, seen.settings.theme, seen.mine]).toEqual(['en', 'dark', { language: 'en' }]);
    expect(((await client(handle, 'ana').ask('GET', '/api/files/settings')).body.settings as { language: string }).language).toBe('es');
    expect((await bea.ask('PUT', '/api/files/settings/mine', { theme: 'blue' })).status).toBe(400);
  });

  it('are kept by the store, across processes', async () => {
    const path = join(folder, 'settings.sqlite');
    const at = join(folder, 'kept');
    await client(drive({ at, metadata: await sqliteMetadata(path) }), 'ana').ask('PUT', '/api/files/settings', { brand: '#aa3300' });
    await client(drive({ at, metadata: await sqliteMetadata(path) }), 'bea').ask('PUT', '/api/files/settings/mine', { theme: 'dark' });
    const seen = (await client(drive({ at, metadata: await sqliteMetadata(path) }), 'bea').ask('GET', '/api/files/settings')).body as unknown as { settings: { brand: string; theme: string } };
    expect([seen.settings.brand, seen.settings.theme]).toEqual(['#aa3300', 'dark']);
  });
});

describe('the smaller pictures of an image', () => {
  async function withPhoto() {
    const at = join(folder, String(Math.random()));
    const handle = drive({ at });
    const ana = client(handle, 'ana');
    const send = (url: string, init: RequestInit) => handle(new Request(url.startsWith('/') ? `http://drive.test${url}` : url, init));
    const photo = (await ana.upload(bytesOf(5000), { name: 'house.png', parent: null, type: 'image/png' }, send)).body.entry;
    if (photo.kind !== 'file') throw new Error('not a file');
    /** A smaller picture of the photo's current version, sent as the browser sends it. */
    const smaller = async (size: number, width: number, height: number, type = 'image/jpeg') => {
      const start = await ana.ask('POST', '/api/files/uploads', { rendition: { file: photo.id, version: photo.versions[0].id, size, width, height }, type, size: 100 });
      if (start.status !== 200) return start;
      const [part] = start.body.parts as unknown as { url: string }[];
      await send(part.url, { method: 'PUT', body: bytesOf(100, size) as Uint8Array<ArrayBuffer> });
      return ana.ask('POST', '/api/files/uploads/finish', { token: start.body.token, parts: [{ number: 1, etag: '"1"' }] });
    };
    return { handle, ana, photo, smaller, at, send };
  }

  it('are kept with the version, and read at a size; the original stays for what is larger', async () => {
    const { ana, photo, smaller, send } = await withPhoto();
    for (const [size, w, h] of [
      [160, 160, 120],
      [480, 480, 360],
      [1024, 1024, 768],
    ])
      expect((await smaller(size, w, h)).status).toBe(200);
    const { entry } = (await ana.ask('GET', `/api/files/entries/${photo.id}`)).body;
    if (entry.kind !== 'file') throw new Error('not a file');
    expect(entry.versions[0].renditions!.map((r) => [r.size, r.width, r.type])).toEqual([
      [160, 160, 'image/jpeg'],
      [480, 480, 'image/jpeg'],
      [1024, 1024, 'image/jpeg'],
    ]);
    expect(entry.modified).toBe(photo.modified);

    const at = async (size: number) => (await ana.ask('GET', `/api/files/entries/${photo.id}/download?size=${size}`)).body as unknown as { url: string; width?: number };
    const read = async (url: string) => {
      const answer = await send(url, {});
      return [answer.headers.get('content-type'), answer.headers.get('content-disposition'), (await answer.arrayBuffer()).byteLength];
    };
    expect((await at(300)).width).toBe(480);
    expect(await read((await at(300)).url)).toEqual(['image/jpeg', expect.stringContaining('filename="house.jpg"'), 100]);
    // None that large: the original.
    expect(await read((await at(1500)).url)).toEqual(['image/png', expect.stringContaining('filename="house.png"'), 5000]);
  });

  it('are refused at a size the drive does not make, larger than said, or of what is not a picture', async () => {
    const { smaller } = await withPhoto();
    expect((await smaller(300, 300, 200)).body.error).toBe('bad-size');
    expect((await smaller(160, 200, 100)).body.error).toBe('bad-size');
    expect((await smaller(160, 160, 100, 'text/plain')).body.error).toBe('not-a-picture');
  });

  it('come back with a version restored, and go with the file deleted for good', async () => {
    const { ana, photo, smaller, at, send } = await withPhoto();
    await smaller(160, 160, 120);
    // A second version, then the first brought back: with its smaller pictures.
    await ana.upload(bytesOf(10), { file: photo.id, type: 'image/png' }, send);
    const restored = (await ana.ask('POST', `/api/files/entries/${photo.id}/versions/${photo.versions[0].id}/restore`)).body.entry;
    if (restored.kind !== 'file') throw new Error('not a file');
    expect(restored.versions[0].renditions?.map((r) => r.size)).toEqual([160]);

    await ana.ask('POST', `/api/files/entries/${photo.id}/trash`);
    await ana.ask('DELETE', `/api/files/entries/${photo.id}`);
    expect(await readdir(join(at, photo.id)).catch(() => [])).toEqual([]);
  });
});

describe('the space each person keeps', () => {
  it('is said, and an upload past the quota is refused before anything is sent', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const send = (url: string, init: RequestInit) => handle(new Request(url.startsWith('/') ? `http://drive.test${url}` : url, init));
    await ana.ask('PUT', '/api/files/settings', { quota: 2 * 1024 * 1024 });
    await ana.upload(bytesOf(1024 * 1024), { name: 'one.bin', parent: null }, send);
    expect((await ana.ask('GET', '/api/files/usage')).body).toEqual({ used: 1024 * 1024, quota: 2 * 1024 * 1024 });
    const refused = await ana.ask('POST', '/api/files/uploads', { name: 'two.bin', parent: null, size: 1.5 * 1024 * 1024 });
    expect([refused.status, refused.body.error]).toEqual([413, 'over-quota']);
    expect(refused.body.message).toContain('1 MB of 2 MB are used');
    // Bea's space is her own.
    expect((await client(handle, 'bea').ask('GET', '/api/files/usage')).body).toEqual({ used: 0, quota: 2 * 1024 * 1024 });
  });
});

describe('the trash emptying itself', () => {
  it('deletes for good what has been there longer than the settings say, bytes and all', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const at = join(folder, String(Math.random()));
      const handle = drive({ at });
      const ana = client(handle, 'ana');
      const send = (url: string, init: RequestInit) => handle(new Request(url.startsWith('/') ? `http://drive.test${url}` : url, init));
      await ana.ask('PUT', '/api/files/settings', { trashDays: 30 });
      const old = (await ana.upload(bytesOf(10), { name: 'old.txt', parent: null }, send)).body.entry;
      const fresh = (await ana.upload(bytesOf(10), { name: 'fresh.txt', parent: null }, send)).body.entry;
      await ana.ask('POST', `/api/files/entries/${old.id}/trash`);
      vi.setSystemTime(new Date('2026-01-25T00:00:00Z'));
      await ana.ask('POST', `/api/files/entries/${fresh.id}/trash`);
      vi.setSystemTime(new Date('2026-02-05T00:00:00Z'));
      const names = (await ana.ask('GET', '/api/files/trash')).body.entries.map((entry: { name: string }) => entry.name);
      expect(names).toEqual(['fresh.txt']);
      expect(await readdir(join(at, old.id)).catch(() => [])).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
