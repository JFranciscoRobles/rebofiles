// The client against the routes themselves, with the bytes on the disk: what
// the page asks, as it asks it, without a browser.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { byRoles, createDriveHandler, diskStorage, everyone, memoryMetadata, PART_SIZE, s3Storage } from '@rebofiles/server';
import { memoryS3 } from '../../server/test/helpers';
import { RequestError, createDriveClient, createLinkClient } from '../src/client';
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

describe('the client, sharing', () => {
  function two() {
    const handle = createDriveHandler({
      storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
      metadata: memoryMetadata(),
      identify: (request) => ({ id: request.headers.get('x-user') ?? 'ana' }),
      authorize: byRoles,
      secret: 'u',
      base: '/api/files',
    });
    const origin = 'http://drive.test';
    const fetch = (input: RequestInfo | URL, init?: RequestInit) => handle(new Request(new URL(String(input), origin), init));
    const as = (who: string) => createDriveClient({ base: `${origin}/api/files`, headers: () => ({ 'x-user': who }), fetch });
    return { ana: as('ana'), bea: as('bea'), link: (token: string) => createLinkClient({ base: `${origin}/api/files`, token, fetch }) };
  }

  it('shares a folder, and the other sees it in Shared with me and may leave it', async () => {
    const { ana, bea } = two();
    const clients = await ana.createFolder('Clients', null);
    const shared = await ana.share(clients.id, 'bea', 'viewer');
    expect(shared.shares).toMatchObject([{ with: 'bea', role: 'viewer' }]);
    expect((await bea.shared()).map((e) => e.name)).toEqual(['Clients']);
    await bea.unshare(clients.id, 'bea');
    expect(await bea.shared()).toEqual([]);
  });

  it('makes a link, reads through it without signing in, and takes it back', async () => {
    const { ana, link } = two();
    const clients = await ana.createFolder('Clients', null);
    await ana.upload(new File(['through the link'], 'note.txt', { type: 'text/plain' }), { parent: clients.id });
    const { entry, token } = await ana.createLink(clients.id, 3);
    expect(await ana.linkToken(clients.id, entry.links![0].id)).toBe(token);

    const reader = link(token);
    const listing = await reader.list();
    expect(listing.root.name).toBe('Clients');
    expect(listing.entries.map((e) => e.name)).toEqual(['note.txt']);
    expect(await reader.url(listing.entries[0].id)).toMatch(/^http:\/\/drive\.test\/api\/files\/bytes\?token=/);

    await ana.removeLink(clients.id, entry.links![0].id);
    expect(await reader.list().catch((e: unknown) => e)).toMatchObject({ status: 404, code: 'no-link' });
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

  /** A drive on a bucket whose parts may be refused, as `refuse` says, and a client for it: a new one each call, as after the page is opened again. */
  function flaky(refuse: (part: number) => boolean) {
    const s3 = memoryS3();
    const handle = createDriveHandler({
      storage: s3Storage({ endpoint: 'https://s3.test', bucket: 'bucket', accessKeyId: 'id', secretAccessKey: 'secret', fetch: s3.fetch }),
      metadata: memoryMetadata(),
      ...everyone('ana'),
      secret: 'u',
      base: '/api/files',
    });
    const origin = 'http://drive.test';
    const asked: string[] = [];
    const sentParts: number[] = [];
    const saved = new Map<string, string>();
    const open = (attempts = 5) =>
      createDriveClient({
        base: `${origin}/api/files`,
        parallel: 1,
        retry: { attempts, delay: 0 },
        // Where the page keeps it between visits: localStorage, in a browser.
        remember: { get: (key) => saved.get(key), set: (key, token) => saved.set(key, token), delete: (key) => saved.delete(key) },
        fetch: (input, init) => {
          if (String(input).startsWith(origin)) {
            asked.push(new URL(String(input)).pathname.replace('/api/files', ''));
            return handle(new Request(String(input), init));
          }
          const part = Number(new URL(String(input)).searchParams.get('partNumber'));
          // Refused as a bucket does when an address is out of date, or not let through, as when the connection is cut.
          if (part && refuse(part)) return Promise.resolve(new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }));
          if (part) sentParts.push(part);
          return s3.fetch(input, init);
        },
      });
    return { s3, asked, sentParts, saved, open };
  }

  it('tries a part again when it fails, asking what arrived, and sends only what did not', async () => {
    let refused = 0;
    const { s3, asked, sentParts, open } = flaky((part) => part === 2 && refused++ < 2);
    const bytes = new Uint8Array(3 * PART_SIZE).map((_, i) => i % 251);
    const entry = await open().upload(new File([bytes], 'big.bin'));
    expect(Buffer.from(s3.objects.get(entry.versions[0].key)!).equals(Buffer.from(bytes))).toBe(true);
    expect(asked.filter((path) => path === '/uploads/resume')).toHaveLength(2);
    expect(sentParts).toEqual([1, 2, 3]);
  });

  it('keeps what arrived when it cannot go on, and goes on with it when the same file is uploaded again', async () => {
    let cut = true;
    const { s3, asked, sentParts, saved, open } = flaky((part) => part === 2 && cut);
    const file = new File([new Uint8Array(3 * PART_SIZE)], 'big.bin', { lastModified: 1 });
    const progress: number[] = [];
    const error = await open(2)
      .upload(file)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 403, code: 'upload' });
    // Not given up: the part that arrived waits in the bucket, and the page remembers the upload.
    expect(s3.uploads.size).toBe(1);
    expect(saved.size).toBe(1);

    cut = false;
    const entry = await open().upload(file, { onProgress: ({ sent }) => progress.push(sent) });
    expect(s3.objects.get(entry.versions[0].key)?.length).toBe(3 * PART_SIZE);
    expect(asked.filter((path) => path === '/uploads')).toHaveLength(1);
    expect(sentParts).toEqual([1, 2, 3]);
    // What had arrived counted from the start, as gone.
    expect(progress[0]).toBe(PART_SIZE);
    expect(saved.size).toBe(0);
    // Another file of the same name is another upload.
    await open().upload(new File([new Uint8Array(3)], 'big.bin', { lastModified: 2 }));
    expect(asked.filter((path) => path === '/uploads')).toHaveLength(2);
  });

  it('gives up an upload stopped by the person, and leaves nothing of it in the bucket', async () => {
    const stop = new AbortController();
    const { s3, saved, sentParts, open } = flaky((part) => {
      if (part === 2) stop.abort();
      return part === 2;
    });
    const error = await open()
      .upload(new File([new Uint8Array(3 * PART_SIZE)], 'big.bin'), { signal: stop.signal })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(s3.uploads.size).toBe(0);
    expect(saved.size).toBe(0);
    expect(sentParts).toEqual([1]);
  });

  it('starts again when what it remembered is out of date', async () => {
    const { asked, saved, open } = flaky(() => false);
    const file = new File(['notes'], 'notes.txt', { lastModified: 1 });
    const client = open();
    await client.upload(file);
    for (const key of [...saved.keys(), JSON.stringify(['http://drive.test/api/files', null, 'notes.txt', 5, 1, 'application/octet-stream'])]) saved.set(key, 'not a token');
    const entry = await client.upload(file);
    expect(entry.name).toBe('notes (2).txt');
    expect(asked.filter((path) => path === '/uploads/resume')).toHaveLength(1);
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
