// Where files are read from: many addresses at once for a grid, each said
// with until when it is good; those to show a file the same all the hour and
// kept by the browser, those to download it good for a quarter of an hour.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata, s3Storage } from '../src';
import { bytesOf, client, memoryS3 } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-addresses-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
  vi.useRealTimers();
});

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
type Address = { url: string; expires: string; width?: number };

describe('addresses', () => {
  const s3 = memoryS3();
  const handle = createDriveHandler({
    storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
    metadata: memoryMetadata(),
    identify,
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
  });
  const ana = client(handle, 'ana');
  const bea = client(handle, 'bea');

  it('of many files at once, each until when it is good, leaving out what may not be read and what is not a file', async () => {
    const one = (await ana.upload(bytesOf(10), { name: 'one.png', parent: null, type: 'image/png' }, s3.fetch)).body.entry;
    const two = (await ana.upload(bytesOf(20), { name: 'two.png', parent: null, type: 'image/png' }, s3.fetch)).body.entry;
    const folderOf = (await ana.ask('POST', '/api/files/folders', { name: 'Photos', parent: null })).body.entry;
    const { urls } = (await ana.ask('POST', '/api/files/urls', { ids: [one.id, two.id, folderOf.id, 'nothing'], inline: true })).body as unknown as { urls: Record<string, Address> };
    expect(Object.keys(urls).sort()).toEqual([one.id, two.id].sort());
    expect(Date.parse(urls[one.id].expires)).toBeGreaterThan(Date.now() + 60 * 60_000 - 1000);
    // Bea may read neither.
    expect((await bea.ask('POST', '/api/files/urls', { ids: [one.id, two.id] })).body).toEqual({ urls: {} });
    expect((await ana.ask('POST', '/api/files/urls', { ids: Array.from({ length: 501 }, (_, i) => `x${i}`) })).status).toBe(400);
  });

  it('to show a file, the same all the hour and kept by the browser; to download it, good for a quarter of an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T10:05:00Z'));
    const file = (await ana.upload(bytesOf(10), { name: 'kept.png', parent: null, type: 'image/png' }, s3.fetch)).body.entry;
    const shown = async () => (await ana.ask('GET', `/api/files/entries/${file.id}/download?inline=1`)).body as unknown as Address;
    const first = await shown();
    vi.setSystemTime(new Date('2026-10-26T10:55:00Z'));
    const later = await shown();
    expect(later.url).toBe(first.url);
    expect(later.expires).toBe('2026-10-26T12:00:00.000Z');
    const signed = new URL(first.url).searchParams;
    expect([signed.get('X-Amz-Date'), signed.get('X-Amz-Expires'), signed.get('response-cache-control')]).toEqual(['20261026T100000Z', '7200', 'private, max-age=7200']);
    vi.setSystemTime(new Date('2026-10-26T11:01:00Z'));
    expect((await shown()).url).not.toBe(first.url);

    const download = (await ana.ask('GET', `/api/files/entries/${file.id}/download`)).body as unknown as Address;
    expect(new URL(download.url).searchParams.get('X-Amz-Expires')).toBe('900');
    expect(new URL(download.url).searchParams.has('response-cache-control')).toBe(false);
    expect(download.expires).toBe('2026-10-26T11:16:00.000Z');
    vi.useRealTimers();
  });

  it('on the disk too: the same address all the hour, served to be kept', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T10:05:00Z'));
    const disk = createDriveHandler({ storage: diskStorage({ folder: join(folder, 'disk'), secret: 's' }), metadata: memoryMetadata(), identify, authorize: byRoles, secret: 'u', base: '/api/files' });
    const { ask, upload } = client(disk, 'ana');
    const send = (url: string, init: RequestInit) => disk(new Request(url.startsWith('/') ? `http://drive.test${url}` : url, init));
    const file = (await upload(bytesOf(10), { name: 'a.png', parent: null, type: 'image/png' }, send)).body.entry;
    const first = ((await ask('GET', `/api/files/entries/${file.id}/download?inline=1`)).body as unknown as Address).url;
    vi.setSystemTime(new Date('2026-10-26T10:40:00Z'));
    expect(((await ask('GET', `/api/files/entries/${file.id}/download?inline=1`)).body as unknown as Address).url).toBe(first);
    const answer = await send(first, {});
    expect(answer.headers.get('cache-control')).toBe('private, max-age=7200');
    const download = ((await ask('GET', `/api/files/entries/${file.id}/download`)).body as unknown as Address).url;
    expect((await send(download, {})).headers.get('cache-control')).toBeNull();
    vi.useRealTimers();
  });
});

describe('what an archive holds', () => {
  it('each file and each folder with what is in it, what may not be read left out', async () => {
    const s3 = memoryS3();
    const handle = createDriveHandler({
      storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
      metadata: memoryMetadata(),
      identify,
      authorize: byRoles,
      secret: 'u',
      base: '/api/files',
    });
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const contracts = (await ana.ask('POST', '/api/files/folders', { name: 'Contracts', parent: null })).body.entry;
    await ana.ask('POST', '/api/files/folders', { name: '2026', parent: contracts.id });
    const deal = (await ana.upload(bytesOf(30), { name: 'deal.txt', parent: contracts.id, type: 'text/plain' }, s3.fetch)).body.entry;
    const packed = (await ana.ask('POST', '/api/files/zip', { ids: [contracts.id] })).body as unknown as { files: { id: string; path: string; size: number }[]; folders: string[] };
    expect(packed.folders).toEqual(['Contracts/', 'Contracts/2026/']);
    expect(packed.files).toEqual([expect.objectContaining({ id: deal.id, path: 'Contracts/deal.txt', size: 30, type: 'text/plain' })]);
    // Bea may read none of it.
    expect((await bea.ask('POST', '/api/files/zip', { ids: [contracts.id, deal.id] })).body).toEqual({ files: [], folders: [] });
  });
});

describe('an archive through a link', () => {
  it('holds what the link reads, and nothing outside it, whoever asks', async () => {
    const s3 = memoryS3();
    const handle = createDriveHandler({
      storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
      metadata: memoryMetadata(),
      identify,
      authorize: byRoles,
      secret: 'u',
      base: '/api/files',
    });
    const ana = client(handle, 'ana');
    const shared = (await ana.ask('POST', '/api/files/folders', { name: 'Shared', parent: null })).body.entry;
    const inside = (await ana.upload(bytesOf(12), { name: 'in.txt', parent: shared.id, type: 'text/plain' }, s3.fetch)).body.entry;
    const outside = (await ana.upload(bytesOf(12), { name: 'secret.txt', parent: null, type: 'text/plain' }, s3.fetch)).body.entry;
    const { token } = (await ana.ask('POST', `/api/files/entries/${shared.id}/links`, { days: 7 })).body as unknown as { token: string };
    // No one signed in.
    const someone = (path: string) => handle(new Request(`http://drive.test/api/files/links/${encodeURIComponent(token)}${path}`)).then(async (r) => ({ status: r.status, body: await r.json() }));
    expect((await someone('/zip')).body).toEqual({ folders: ['Shared/'], files: [expect.objectContaining({ id: inside.id, path: 'Shared/in.txt' })] });
    expect((await someone(`/zip?ids=${outside.id}`)).status).toBe(404);
    const { urls } = (await someone(`/urls?ids=${inside.id},${outside.id}`)).body as { urls: Record<string, unknown> };
    expect(Object.keys(urls)).toEqual([inside.id]);
  });
});
