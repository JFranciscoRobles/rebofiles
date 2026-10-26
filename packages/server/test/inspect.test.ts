import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileEntry } from '@rebofiles/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DriveServerOptions, Refused, checkType, clamav, createDriveHandler, diskStorage, inspectAll, memoryMetadata, s3Storage, typeOfBytes } from '../src';
import { type Handler, bytesOf, client, memoryS3 } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
const PDF = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj');
const EICAR = new TextEncoder().encode('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-inspect-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

function onDisk(extra: Partial<DriveServerOptions> = {}) {
  const at = join(folder, String(Math.random()));
  const handle = createDriveHandler({ storage: diskStorage({ folder: at, secret: 'disk' }), metadata: memoryMetadata(), identify, authorize: () => true, secret: 'up', base: '/api/files', ...extra });
  return { handle, at };
}
const send = (handle: Handler) => (url: string, init: RequestInit) => handle(new Request(url, init));
/** Every file under a folder, its parts left halfway among them. */
const filesIn = async (dir: string): Promise<string[]> => (await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])).filter((e) => e.isFile()).map((e) => e.name);

describe('what a file is by its bytes', () => {
  it('knows pictures, documents, archives, sound, video and programs, and says nothing of a text', () => {
    expect(typeOfBytes(PNG)).toBe('image/png');
    expect(typeOfBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(typeOfBytes(PDF)).toBe('application/pdf');
    expect(typeOfBytes(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe('application/zip');
    expect(typeOfBytes(new TextEncoder().encode('\0\0\0\x18ftypmp42'))).toBe('video/mp4');
    expect(typeOfBytes(new TextEncoder().encode('\0\0\0\x14ftypqt  '))).toBe('video/quicktime');
    expect(typeOfBytes(new TextEncoder().encode('ID3\x04'))).toBe('audio/mpeg');
    expect(typeOfBytes(EXE)).toBe('application/x-msdownload');
    expect(typeOfBytes(Uint8Array.from([0x7f, 0x45, 0x4c, 0x46]))).toBe('application/x-elf');
    expect(typeOfBytes(Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe]))).toBe('application/x-mach-binary');
    expect(typeOfBytes(new TextEncoder().encode('name,amount\nAna,3'))).toBeNull();
  });
});

describe('before an upload', () => {
  it('asks beforeUpload with what the page said, and refuses as it says', async () => {
    const asked: unknown[] = [];
    const { handle } = onDisk({
      beforeUpload: (upload) => {
        asked.push({ purpose: upload.purpose, name: upload.name, type: upload.type, size: upload.size, user: upload.user.id, parent: upload.parent?.name ?? null });
        if (upload.type.startsWith('video/')) throw new Refused(415, 'no-videos', 'No videos here.');
        if (upload.size > 1000) return false;
      },
    });
    const { ask, upload } = client(handle);
    const docs = (await ask('POST', '/api/files/folders', { name: 'Docs', parent: null })).body.entry;
    const kept = await upload(bytesOf(10), { name: 'a.txt', parent: docs.id, type: 'text/plain' }, send(handle));
    expect(kept.status).toBe(200);
    expect(await ask('POST', '/api/files/uploads', { name: 'film.mp4', type: 'video/mp4', size: 10 })).toMatchObject({ status: 415, body: { error: 'no-videos', message: 'No videos here.' } });
    expect(await ask('POST', '/api/files/uploads', { file: kept.body.entry.id, type: 'text/plain', size: 5000 })).toMatchObject({ status: 403, body: { error: 'upload-refused' } });
    expect(asked).toEqual([
      { purpose: 'file', name: 'a.txt', type: 'text/plain', size: 10, user: 'ana', parent: 'Docs' },
      { purpose: 'file', name: 'film.mp4', type: 'video/mp4', size: 10, user: 'ana', parent: null },
      { purpose: 'version', name: 'a.txt', type: 'text/plain', size: 5000, user: 'ana', parent: 'Docs' },
    ]);
  });
});

describe('once the bytes arrived', () => {
  it('refuses a program called a picture, and takes its bytes away, on the disk', async () => {
    const { handle, at } = onDisk({ inspect: checkType() });
    const { ask, upload } = client(handle);
    const refused = await upload(EXE, { name: 'photo.png', type: 'image/png' }, send(handle));
    expect(refused).toMatchObject({ status: 422, body: { error: 'program-refused' } });
    expect((await ask('GET', '/api/files/entries')).body.entries).toEqual([]);
    expect(await filesIn(at)).toEqual([]);
    expect(await upload(PDF, { name: 'invoice.png', type: 'image/png' }, send(handle))).toMatchObject({ status: 422, body: { error: 'type-mismatch' } });
    // What its name says, and a text, which has no bytes to tell it by.
    expect((await upload(PNG, { name: 'photo.png', type: 'image/png' }, send(handle))).status).toBe(200);
    expect((await upload(new TextEncoder().encode('hello'), { name: 'notes.txt', type: 'text/plain' }, send(handle))).status).toBe(200);
    expect((await ask('GET', '/api/files/entries')).body.entries.map((e) => e.name).sort()).toEqual(['notes.txt', 'photo.png']);
  });

  it('refuses a new version as a new file, keeping the versions before it, in a bucket', async () => {
    const s3 = memoryS3();
    const handle = createDriveHandler({
      storage: s3Storage({ endpoint: 'http://s3.test', bucket: 'bucket', accessKeyId: 'k', secretAccessKey: 's', fetch: s3.fetch }),
      metadata: memoryMetadata(),
      identify,
      authorize: () => true,
      secret: 'up',
      base: '/api/files',
      inspect: checkType({ only: ['application/pdf'] }),
    });
    const { ask, upload } = client(handle, 'ana', 'http://drive.test');
    const kept = await upload(PDF, { name: 'contract.pdf', type: 'application/pdf' }, s3.fetch);
    expect(kept.status).toBe(200);
    // Read by a range: only the first bytes of it.
    expect(s3.seen.some(({ method, url }) => method === 'GET' && url.pathname.endsWith((kept.body.entry as FileEntry).versions[0].key))).toBe(true);
    const objects = s3.objects.size;
    expect(await upload(PNG, { file: kept.body.entry.id, type: 'application/pdf' }, s3.fetch)).toMatchObject({ status: 422, body: { error: 'type-refused' } });
    expect(s3.objects.size).toBe(objects);
    expect(((await ask('GET', `/api/files/entries/${kept.body.entry.id}`)).body.entry as FileEntry).versions).toHaveLength(1);
  });

  it('takes what inspect says false of, and refuses as unseen what it fails on', async () => {
    let fail = false;
    const { handle, at } = onDisk({
      inspect: inspectAll(checkType(), async (upload) => {
        if (fail) throw new Error('the scanner is down');
        return (await upload.read()).length !== 3;
      }),
    });
    const { upload } = client(handle);
    expect(await upload(bytesOf(3), { name: 'three.bin' }, send(handle))).toMatchObject({ status: 422, body: { error: 'refused-content' } });
    fail = true;
    expect(await upload(bytesOf(4), { name: 'four.bin' }, send(handle))).toMatchObject({ status: 503, body: { error: 'not-inspected' } });
    expect(await filesIn(at)).toEqual([]);
  });
});

describe('ClamAV', () => {
  /** A clamd that knows one virus, EICAR's test file, as the real one does; and says how much it was sent. */
  let clamd: Server;
  let port = 0;
  beforeAll(async () => {
    clamd = createServer((socket) => {
      let got = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        got = Buffer.concat([got, chunk]);
        const command = 'zINSTREAM\0';
        if (got.length < command.length || got.subarray(0, command.length).toString() !== command) return;
        // The pieces, each its length before it, until one of none.
        const bytes: Buffer[] = [];
        for (let at = command.length; at + 4 <= got.length; ) {
          const length = got.readUInt32BE(at);
          if (length === 0) {
            const all = Buffer.concat(bytes).toString('latin1');
            socket.end(all.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'stream: Win.Test.EICAR_HDB-1 FOUND\0' : 'stream: OK\0');
            return;
          }
          if (at + 4 + length > got.length) return;
          bytes.push(got.subarray(at + 4, at + 4 + length));
          at += 4 + length;
        }
      });
    });
    await new Promise<void>((done) => clamd.listen(0, '127.0.0.1', done));
    port = (clamd.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((done) => clamd.close(() => done())));

  it('refuses a file with a virus, lets a clean one in, in pieces, and refuses all while clamd is down', async () => {
    const { handle, at } = onDisk({ inspect: clamav({ port }) });
    const { ask, upload } = client(handle);
    expect(await upload(EICAR, { name: 'eicar.com', type: 'text/plain' }, send(handle))).toMatchObject({ status: 422, body: { error: 'virus-found' } });
    expect((await upload(bytesOf(2_500_000), { name: 'clean.bin' }, send(handle))).status).toBe(200);
    expect((await ask('GET', '/api/files/entries')).body.entries.map((e) => e.name)).toEqual(['clean.bin']);
    const down = onDisk({ inspect: clamav({ port: 1, timeout: 2000 }) });
    expect(await client(down.handle).upload(bytesOf(10), { name: 'x.bin' }, send(down.handle))).toMatchObject({ status: 503, body: { error: 'not-scanned' } });
    expect(await filesIn(down.at)).toEqual([]);
    expect((await filesIn(at)).length).toBe(1);
  });
});

describe('uploads left halfway', () => {
  it('are swept from a bucket once past the life of their tokens, under its prefix only', async () => {
    const s3 = memoryS3();
    const storage = s3Storage({ endpoint: 'http://s3.test', bucket: 'bucket', accessKeyId: 'k', secretAccessKey: 's', prefix: 'drive/', fetch: s3.fetch });
    await storage.startUpload('old', 'application/octet-stream', 20 * 1024 * 1024, '');
    await storage.startUpload('new', 'application/octet-stream', 20 * 1024 * 1024, '');
    s3.started.set('u9', { key: 'others/theirs', at: new Date(0) });
    s3.uploads.set('u9', new Map());
    for (const [, upload] of s3.started) if (upload.key === 'drive/old') upload.at = new Date(Date.now() - 3 * 86_400_000);
    expect(await storage.sweepUploads!(new Date(Date.now() - 86_400_000))).toBe(1);
    expect([...s3.uploads.keys()].sort()).toEqual(['u2', 'u9']);
  });

  it('are swept from the disk, their parts and what was being put together', async () => {
    const at = join(folder, 'sweep');
    const storage = diskStorage({ folder: at, secret: 'disk' });
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(at, 'a'), { recursive: true });
    for (const name of ['a/1.part1', 'a/1.part2', 'a/2.uploading', 'a/3.part1', 'a/kept']) await writeFile(join(at, name), 'x');
    const old = new Date(Date.now() - 3 * 86_400_000);
    for (const name of ['a/1.part1', 'a/1.part2', 'a/2.uploading', 'a/kept']) await utimes(join(at, name), old, old);
    expect(await storage.sweepUploads!(new Date(Date.now() - 86_400_000))).toBe(2);
    expect((await filesIn(at)).sort()).toEqual(['3.part1', 'kept']);
  });
});
