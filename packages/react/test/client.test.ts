// The client against the routes themselves, with the bytes on the disk: what
// the page asks, as it asks it, without a browser.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveHandler, diskStorage, everyone, memoryMetadata, PART_SIZE, s3Storage } from '@rebofiles/server';
import { memoryS3 } from '../../server/test/helpers';
import { RequestError, createDriveClient } from '../src/client';
import { formatDate, formatSize } from '../src/i18n';
import { kindOf } from '../src/kinds';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-client-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

function connect() {
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    ...everyone('ana'),
    secret: 'u',
    base: '/api/files',
  });
  const origin = 'http://drive.test';
  return createDriveClient({ base: `${origin}/api/files`, fetch: (input, init) => handle(new Request(new URL(String(input), origin), init)) });
}

describe('the client', () => {
  it('makes folders, uploads into them in parts with progress, and lists them', async () => {
    const drive = connect();
    const clients = await drive.createFolder('Clients', null);
    const bytes = new Uint8Array(PART_SIZE + 10).fill(7);
    const seen: number[] = [];
    const file = await drive.upload(new File([bytes], 'video.mp4', { type: 'video/mp4' }), { parent: clients.id, onProgress: ({ sent }) => seen.push(sent) });
    expect(file).toMatchObject({ name: 'video.mp4', parent: clients.id, type: 'video/mp4' });
    expect(seen.at(-1)).toBe(bytes.length);
    const listing = await drive.list(clients.id);
    expect(listing.entries.map((e) => e.name)).toEqual(['video.mp4']);
    expect(listing.path.map((e) => e.name)).toEqual(['Clients']);
  });

  it('uploads a new version of a file and restores the first', async () => {
    const drive = connect();
    const first = await drive.upload(new File(['one'], 'notes.txt', { type: 'text/plain' }));
    const second = await drive.upload(new File(['two, longer'], 'notes.txt', { type: 'text/plain' }), { file: first.id });
    expect(second.versions).toHaveLength(2);
    const back = await drive.restoreVersion(first.id, first.versions[0].id);
    expect(back.versions[0].size).toBe(3);
  });

  it('says what the server refused, with its code', async () => {
    const drive = connect();
    await drive.createFolder('A', null);
    const b = await drive.createFolder('B', null);
    const error = await drive.rename(b.id, 'a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({ status: 409, code: 'name-taken' });
  });

  it('goes through the trash and empties it', async () => {
    const drive = connect();
    const file = await drive.upload(new File(['x'], 'old.txt'));
    await drive.moveToTrash(file.id);
    expect((await drive.trash()).map((e) => e.name)).toEqual(['old.txt']);
    expect(await drive.search('old', { trashed: true })).toHaveLength(1);
    expect(await drive.emptyTrash()).toEqual([file.id]);
  });

  it('gives an address to read a file from', async () => {
    const drive = connect();
    const file = await drive.upload(new File(['hello'], 'hello.txt', { type: 'text/plain' }));
    // Relative to the base, which is a whole address here.
    expect(await drive.url(file.id, { inline: true })).toMatch(/^http:\/\/drive\.test\/api\/files\/bytes\?token=/);
  });
});

describe('the client against a bucket', () => {
  it('sends each part with the headers the bucket signed, the type of a small file among them', async () => {
    const s3 = memoryS3();
    const handle = createDriveHandler({
      storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
      metadata: memoryMetadata(),
      ...everyone('ana'),
      secret: 'u',
      base: '/api/files',
    });
    const origin = 'http://drive.test';
    const drive = createDriveClient({
      base: `${origin}/api/files`,
      fetch: (input, init) => (String(input).startsWith(origin) ? handle(new Request(String(input), init)) : s3.fetch(input, init)),
    });
    const small = await drive.upload(new File(['a note'], 'note.txt', { type: 'text/plain' }));
    const untyped = await drive.upload(new File(['?'], 'blob'));
    const large = await drive.upload(new File([new Uint8Array(PART_SIZE + 10)], 'big.bin'));
    expect([small, untyped, large].map((file) => s3.objects.get(file.versions[0].key)?.length)).toEqual([6, 1, PART_SIZE + 10]);
  });
});

describe('what the drive shows', () => {
  it('says sizes and dates as a person reads them', () => {
    expect(formatSize(48_000, 'en')).toBe('48 KB');
    expect(formatSize(1_234_567, 'en')).toBe('1.2 MB');
    expect(formatSize(12, 'es')).toBe('12 B');
    expect(formatDate('2026-10-24T09:43:00', 'en', new Date('2026-10-24T18:00:00'))).toMatch(/9:43/);
    expect(formatDate('2025-03-02T09:00:00', 'en', new Date('2026-10-24T18:00:00'))).toMatch(/2025/);
  });

  it('knows each kind of file by its name or its type', () => {
    const file = (name: string, type = '') => ({ kind: 'file', name, type }) as Parameters<typeof kindOf>[0];
    expect(kindOf(file('contract.docx'))).toBe('docx');
    expect(kindOf(file('scan', 'application/pdf'))).toBe('pdf');
    expect(kindOf(file('budget.xlsx'))).toBe('sheet');
    expect(kindOf(file('photo.JPG'))).toBe('image');
    expect(kindOf(file('notes.md'))).toBe('text');
    expect(kindOf(file('archive.zip', 'application/zip'))).toBe('other');
  });
});

describe('the client against a server on the network', () => {
  it('sends to and reads from the addresses a disk storage makes, relative to a whole base, with the real fetch', async () => {
    const { createServer } = await import('node:http');
    const { nodeHandler } = await import('@rebofiles/server');
    const handle = createDriveHandler({ storage: diskStorage({ folder: join(folder, 'net'), secret: 's' }), metadata: memoryMetadata(), ...everyone('ana'), secret: 'u', base: '/api/files' });
    const server = createServer(nodeHandler(handle));
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const { port } = server.address() as { port: number };
      const drive = createDriveClient({ base: `http://127.0.0.1:${port}/api/files` });
      const file = await drive.upload(new File(['over the network'], 'net.txt', { type: 'text/plain' }));
      const url = await drive.url(file.id);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/files\/bytes\?token=/);
      expect(await (await fetch(url)).text()).toBe('over the network');
    } finally {
      server.close();
    }
  });
});
