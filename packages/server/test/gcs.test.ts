// Google Cloud Storage through its XML API, which speaks S3: signed as S3 is,
// at storage.googleapis.com; each key deleted by itself, as that API takes no
// list of them; and every part of a new version sent, as it copies none.

import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { PART_SIZE, createDriveHandler, gcsStorage, memoryMetadata } from '../src';
import { memoryS3 } from './helpers';

const bytes = (size: number, seed: number) => Uint8Array.from({ length: size }, (_, i) => (i * 7 + seed) % 253);

describe('Google Cloud Storage', () => {
  it('takes uploads as S3 does, sends every part of a new version, and deletes each key by itself', async () => {
    const bucket = memoryS3();
    const storage = gcsStorage({ bucket: 'bucket', accessKeyId: 'GOOG1EXAMPLE', secretAccessKey: 'secret', endpoint: 'https://storage.test', fetch: bucket.fetch });
    expect(storage.label).toBe('gs://bucket');
    expect(storage.copyPart).toBeUndefined();
    const handle = createDriveHandler({ storage, metadata: memoryMetadata(), identify: () => ({ id: 'ana' }), authorize: () => true, secret: 'u', base: '/api/files' });
    const client = createDriveClient({
      base: 'http://drive.test/api/files',
      fetch: (input, init) => (String(input).startsWith('http://drive.test/') ? handle(new Request(String(input), init)) : bucket.fetch(input, init)),
      remember: null,
    });
    const first = bytes(PART_SIZE * 2, 1);
    const file = await client.upload(new File([first], 'big.bin'), { partHashes: true });
    const second = first.slice();
    second[10] ^= 0xff;
    bucket.seen.length = 0;
    await client.upload(new File([second], 'big.bin'), { file: file.id, partHashes: true });
    // Both parts sent: none copied in the bucket.
    expect(bucket.seen.filter((one) => one.method === 'PUT' && one.url.searchParams.has('partNumber'))).toHaveLength(2);
    // Signed as S3 is, at the address given.
    expect(bucket.seen[0].url.origin).toBe('https://storage.test');
    expect(bucket.seen[0].url.searchParams.get('X-Amz-Credential')).toMatch(/^GOOG1EXAMPLE\//);

    bucket.seen.length = 0;
    await client.moveToTrash(file.id);
    await client.deleteForever(file.id);
    expect(bucket.seen.some((one) => one.method === 'POST' && one.url.searchParams.has('delete'))).toBe(false);
    expect(bucket.seen.filter((one) => one.method === 'DELETE')).toHaveLength(2);
    expect(bucket.objects.size).toBe(0);
    expect(((await client.list(null)).entries as FileEntry[]).length).toBe(0);
  });
});
