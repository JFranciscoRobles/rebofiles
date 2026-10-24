import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Entry } from '@rebofiles/core';
import { type DriveServerOptions, PART_SIZE, createDriveHandler, diskStorage, memoryMetadata, s3Storage, sqliteMetadata } from '../src';
import { type Handler, bytesOf, client, memoryS3 } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const names = (entries: Entry[]) => entries.map((entry) => entry.name);
// Compared as bytes: a failed toEqual of megabytes prints them all.
const same = (a: Uint8Array | undefined, b: Uint8Array) => a !== undefined && Buffer.from(a).equals(Buffer.from(b));

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

function onDisk(extra: Partial<DriveServerOptions> = {}): Handler {
  return createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 'disk secret' }),
    metadata: memoryMetadata(),
    identify,
    authorize: () => true,
    secret: 'upload secret',
    base: '/api/files',
    ...extra,
  });
}

describe('the routes, on the disk', () => {
  it('makes folders, uploads into them, lists and reads back the bytes', async () => {
    const handle = onDisk();
    const { ask, upload } = client(handle);
    const clients = (await ask('POST', '/api/files/folders', { name: 'Clients', parent: null })).body.entry;
    const bytes = bytesOf(48_000);
    const uploaded = await upload(bytes, { name: 'contract.docx', parent: clients.id, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, (url, init) =>
      handle(new Request(url, init)),
    );
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.entry).toMatchObject({ name: 'contract.docx', parent: clients.id, owner: 'ana', kind: 'file' });

    const listed = await ask('GET', `/api/files/entries?folder=${clients.id}`);
    expect(names(listed.body.entries)).toEqual(['contract.docx']);
    expect(names(listed.body.path as Entry[])).toEqual(['Clients']);

    const { url } = (await ask('GET', `/api/files/entries/${uploaded.body.entry.id}/download`)).body;
    const read = await handle(new Request(`http://drive.test${url}`));
    expect(read.headers.get('content-disposition')).toContain("filename*=UTF-8''contract.docx");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(bytes);
  });

  it('uploads a file larger than a part in parts, and a second one with the same name as "(2)"', async () => {
    const handle = onDisk();
    const { upload } = client(handle);
    const bytes = bytesOf(PART_SIZE + 1234);
    const send = (url: string, init: RequestInit) => handle(new Request(url, init));
    const first = await upload(bytes, { name: 'video.mp4', parent: null }, send);
    const second = await upload(bytesOf(10), { name: 'video.mp4', parent: null }, send);
    expect(first.body.entry.kind === 'file' && first.body.entry.versions[0].size).toBe(PART_SIZE + 1234);
    expect(second.body.entry.name).toBe('video (2).mp4');
  });

  it('refuses a part of another length than the one signed', async () => {
    const handle = onDisk();
    const { ask } = client(handle);
    const start = await ask('POST', '/api/files/uploads', { name: 'a.txt', parent: null, size: 10 });
    const [part] = start.body.parts as { url: string }[];
    const answer = await handle(new Request(`http://drive.test${part.url}`, { method: 'PUT', body: bytesOf(11) }));
    expect(answer.status).toBe(400);
  });

  it('keeps versions, and restores an old one without sending its bytes again', async () => {
    const handle = onDisk();
    const { ask, upload } = client(handle);
    const send = (url: string, init: RequestInit) => handle(new Request(url, init));
    const first = (await upload(bytesOf(100, 1), { name: 'notes.txt', parent: null, type: 'text/plain' }, send)).body.entry;
    const second = (await upload(bytesOf(200, 2), { file: first.id, type: 'text/plain' }, send)).body.entry;
    if (second.kind !== 'file' || first.kind !== 'file') throw new Error('not files');
    expect(second.versions).toHaveLength(2);
    const restored = (await ask('POST', `/api/files/entries/${first.id}/versions/${first.versions[0].id}/restore`)).body.entry;
    if (restored.kind !== 'file') throw new Error('not a file');
    expect(restored.versions[0]).toMatchObject({ key: first.versions[0].key, size: 100, restoredFrom: first.versions[0].id });
  });

  it('renames and moves, refusing a taken name with 409 unless asked to keep both', async () => {
    const handle = onDisk();
    const { ask } = client(handle);
    const a = (await ask('POST', '/api/files/folders', { name: 'A', parent: null })).body.entry;
    const b = (await ask('POST', '/api/files/folders', { name: 'B', parent: null })).body.entry;
    expect((await ask('PATCH', `/api/files/entries/${b.id}`, { name: 'a' })).status).toBe(409);
    expect((await ask('PATCH', `/api/files/entries/${b.id}`, { name: 'a', ifTaken: 'keep-both' })).body.entry.name).toBe('a (2)');
    expect((await ask('PATCH', `/api/files/entries/${a.id}`, { parent: a.id })).body).toMatchObject({ error: 'into-itself' });
    expect((await ask('PATCH', `/api/files/entries/${b.id}`, { parent: a.id })).body.entry.parent).toBe(a.id);
  });

  it('puts in the trash, restores, and deletes the bytes when it is emptied', async () => {
    const disk = join(folder, 'trash-case');
    const handle = onDisk({ storage: diskStorage({ folder: disk, secret: 's' }) });
    const { ask, upload } = client(handle);
    const send = (url: string, init: RequestInit) => handle(new Request(url, init));
    const file = (await upload(bytesOf(10), { name: 'old.txt', parent: null }, send)).body.entry;
    await ask('POST', `/api/files/entries/${file.id}/trash`);
    expect(names((await ask('GET', '/api/files/entries')).body.entries)).toEqual([]);
    expect(names((await ask('GET', '/api/files/trash')).body.entries)).toEqual(['old.txt']);
    expect(names((await ask('GET', '/api/files/search?q=OLD&trashed=1')).body.entries)).toEqual(['old.txt']);
    await ask('POST', `/api/files/entries/${file.id}/restore`);
    expect(names((await ask('GET', '/api/files/entries')).body.entries)).toEqual(['old.txt']);
    expect((await ask('DELETE', `/api/files/entries/${file.id}`)).status).toBe(409);
    await ask('POST', `/api/files/entries/${file.id}/trash`);
    expect((await ask('POST', '/api/files/trash/empty')).body.removed).toEqual([file.id]);
    expect(await readdir(join(disk, file.id))).toEqual([]);
  });
});

describe('who may do what', () => {
  it('answers 401 to no one, and 403 where authorize says no', async () => {
    const handle = onDisk({ authorize: (user, action) => user.id === 'ana' || action === 'list' });
    expect((await client(handle, '').ask('GET', '/api/files/entries')).status).toBe(401);
    expect((await client(handle, 'luis').ask('GET', '/api/files/entries')).status).toBe(200);
    expect((await client(handle, 'luis').ask('POST', '/api/files/folders', { name: 'X', parent: null })).status).toBe(403);
  });

  it('lists only what the person may read', async () => {
    const handle = onDisk({ authorize: (user, action, entry) => action !== 'read' || user.id === 'ana' || entry?.name !== 'Private' });
    await client(handle).ask('POST', '/api/files/folders', { name: 'Private', parent: null });
    await client(handle).ask('POST', '/api/files/folders', { name: 'Public', parent: null });
    expect(names((await client(handle, 'luis').ask('GET', '/api/files/entries')).body.entries)).toEqual(['Public']);
    expect(names((await client(handle, 'luis').ask('GET', '/api/files/search?q=p')).body.entries)).toEqual(['Public']);
  });

  it('refuses to finish an upload another person started', async () => {
    const handle = onDisk();
    const start = await client(handle).ask('POST', '/api/files/uploads', { name: 'a.txt', parent: null, size: 0 });
    expect((await client(handle, 'luis').ask('POST', '/api/files/uploads/finish', { token: start.body.token, parts: [] })).status).toBe(403);
  });

  it('refuses a file larger than the limit before anything is sent', async () => {
    const handle = onDisk({ maxSize: 100 });
    expect((await client(handle).ask('POST', '/api/files/uploads', { name: 'big.bin', parent: null, size: 101 })).status).toBe(413);
  });
});

describe('the routes, on S3', () => {
  const s3 = memoryS3();
  const handle = createDriveHandler({
    storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
    metadata: memoryMetadata(),
    identify,
    authorize: () => true,
    secret: 'upload secret',
    base: '/api/files',
  });
  const { ask, upload } = client(handle);

  it('sends a small file straight to the bucket in one PUT, its length signed', async () => {
    const uploaded = await upload(bytesOf(48_000), { name: 'receipt.docx', parent: null }, s3.fetch);
    const entry = uploaded.body.entry;
    if (entry.kind !== 'file') throw new Error('not a file');
    expect(same(s3.objects.get(entry.versions[0].key), bytesOf(48_000))).toBe(true);
    expect(entry.versions[0].key).toBe(`${entry.id}/${entry.versions[0].id}`);
  });

  it('sends a large one in parts and puts them together', async () => {
    const bytes = bytesOf(2 * PART_SIZE + 5);
    const start = await ask('POST', '/api/files/uploads', { name: 'big.bin', parent: null, size: bytes.length });
    expect((start.body.parts as unknown[]).length).toBe(3);
    const uploaded = await upload(bytes, { name: 'big.bin', parent: null }, s3.fetch);
    const entry = uploaded.body.entry;
    if (entry.kind !== 'file') throw new Error('not a file');
    expect(same(s3.objects.get(entry.versions[0].key), bytes)).toBe(true);
  });

  it('refuses an upload whose bytes did not all arrive, and takes them out of the bucket', async () => {
    const start = await ask('POST', '/api/files/uploads', { name: 'cut.txt', parent: null, size: 10 });
    const [part] = start.body.parts as { url: string }[];
    // A part cut short: the fake bucket does not check the signed length, as S3 would.
    await s3.fetch(part.url, { method: 'PUT', body: bytesOf(5) });
    const finished = await ask('POST', '/api/files/uploads/finish', { token: start.body.token, parts: [{ number: 1, etag: '"one"' }] });
    expect(finished.status).toBe(500);
    expect(names((await ask('GET', '/api/files/search?q=cut')).body.entries)).toEqual([]);
  });

  it('signs a download as an attachment with the name of the file', async () => {
    const entry = (await ask('GET', '/api/files/search?q=receipt')).body.entries[0];
    const { url } = (await ask('GET', `/api/files/entries/${entry.id}/download`)).body;
    expect(new URL(url).searchParams.get('response-content-disposition')).toContain('receipt.docx');
    expect(new URL(url).searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deletes from the bucket what is deleted for good', async () => {
    const entry = (await ask('GET', '/api/files/search?q=receipt')).body.entries[0];
    if (entry.kind !== 'file') throw new Error('not a file');
    await ask('POST', `/api/files/entries/${entry.id}/trash`);
    await ask('DELETE', `/api/files/entries/${entry.id}`);
    expect(s3.objects.has(entry.versions[0].key)).toBe(false);
  });
});

describe('metadata in SQLite', () => {
  it('keeps the drive across processes', async () => {
    const path = join(folder, 'drive.sqlite');
    const options = { storage: diskStorage({ folder: join(folder, 'sqlite'), secret: 's' }), identify, authorize: () => true, secret: 'x', base: '/api/files' };
    const one = client(createDriveHandler({ ...options, metadata: await sqliteMetadata(path) }));
    const made = (await one.ask('POST', '/api/files/folders', { name: 'Kept', parent: null })).body.entry;
    await one.ask('POST', '/api/files/folders', { name: 'Inside', parent: made.id });
    await one.ask('PATCH', `/api/files/entries/${made.id}`, { name: 'Kept again' });
    const two = client(createDriveHandler({ ...options, metadata: await sqliteMetadata(path) }));
    expect(names((await two.ask('GET', '/api/files/entries')).body.entries)).toEqual(['Kept again']);
    expect(names((await two.ask('GET', `/api/files/entries?folder=${made.id}`)).body.entries)).toEqual(['Inside']);
  });
});
