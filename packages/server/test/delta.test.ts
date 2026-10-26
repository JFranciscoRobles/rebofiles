// A new version of a large file changed a little: only the parts that changed
// are sent, the rest copied in the storage from the version before, in a
// bucket and on the disk; and what is read back is the new file, whole.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { PART_SIZE, type Storage, createDriveHandler, diskStorage, memoryMetadata, s3Storage } from '../src';
import { memoryS3 } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-delta-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const bytes = (size: number, seed: number) => Uint8Array.from({ length: size }, (_, i) => (i * 7 + seed) % 253);

describe.each([
  ['in a bucket', () => memoryS3()],
  ['on the disk', () => null],
])('a version changed a little, %s', (_, bucket) => {
  it('sends only the part that changed, and reads back the new bytes whole', async () => {
    const s3 = bucket();
    const storage: Storage = s3
      ? s3Storage({ endpoint: 'http://s3.test', bucket: 'bucket', accessKeyId: 'k', secretAccessKey: 's', fetch: s3.fetch })
      : diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' });
    const handle = createDriveHandler({ storage, metadata: memoryMetadata(), identify: () => ({ id: 'ana' }), authorize: () => true, secret: 'u', base: '/api/files' });
    // Every PUT of bytes, to the bucket or to the server's own addresses, counted by its length.
    const putBytes: number[] = [];
    const send = (async (url: string | URL | Request, init: RequestInit = {}) => {
      const address = String(url);
      if (init.method === 'PUT' && init.body && !address.includes('/settings')) putBytes.push((init.body as Blob).size ?? 0);
      return address.startsWith('http://s3.test') ? s3!.fetch(address, init) : handle(new Request(address, init));
    }) as typeof fetch;
    const client = createDriveClient({ base: 'http://drive.test/api/files', fetch: send, remember: null });

    const first = bytes(3 * PART_SIZE + 1000, 1);
    const file = await client.upload(new File([first], 'video.mov'), { partHashes: true });
    expect(file.versions[0].parts?.hashes).toHaveLength(4);
    expect(putBytes.reduce((a, b) => a + b, 0)).toBe(first.length);

    // The second part changed, its length the same.
    const second = first.slice();
    for (let i = PART_SIZE + 10; i < PART_SIZE + 5000; i++) second[i] = 0;
    putBytes.length = 0;
    const progress: number[] = [];
    const next = await client.upload(new File([second], 'video.mov'), { file: file.id, partHashes: true, onProgress: ({ sent }) => progress.push(sent) });
    expect(putBytes).toEqual([PART_SIZE]);
    expect(progress[0]).toBe(second.length - PART_SIZE);
    expect(next.versions).toHaveLength(2);
    const read = new Uint8Array(await (await send(await client.url(file.id))).arrayBuffer());
    expect(Buffer.from(read).equals(Buffer.from(second))).toBe(true);
    // The version before is as it was.
    const old = new Uint8Array(await (await send(await client.url(file.id, { version: (next as FileEntry).versions[1].id }))).arrayBuffer());
    expect(Buffer.from(old).equals(Buffer.from(first))).toBe(true);

    // Longer at its end: the parts before the last are the same, the last two sent.
    const longer = new Uint8Array(second.length + PART_SIZE);
    longer.set(second);
    putBytes.length = 0;
    await client.upload(new File([longer], 'video.mov'), { file: file.id, partHashes: true });
    expect(putBytes.reduce((a, b) => a + b, 0)).toBe(longer.length - 3 * PART_SIZE);
    const again = new Uint8Array(await (await send(await client.url(file.id))).arrayBuffer());
    expect(Buffer.from(again).equals(Buffer.from(longer))).toBe(true);
  }, 60_000);
});
