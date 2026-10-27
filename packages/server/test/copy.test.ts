// A copy of a file: its bytes copied in the storage, under a key of its own,
// so deleting either leaves the other whole; beside it, "(2)" in its name, or
// at one's own top for a file shared to read; its pictures and its text with
// it; and the space it takes counted.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveClient } from '@rebofiles/drive';
import { type Storage, byRoles, createDriveHandler, diskStorage, memoryMetadata, s3Storage } from '../src';
import { memoryS3 } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-copy-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe.each([
  ['in a bucket', () => memoryS3()],
  ['on the disk', () => null],
])('a copy of a file, %s', (_, bucket) => {
  const drive = (extra: { quota?: number } = {}) => {
    const s3 = bucket();
    const storage: Storage = s3
      ? s3Storage({ endpoint: 'http://s3.test', bucket: 'bucket', accessKeyId: 'k', secretAccessKey: 's', fetch: s3.fetch })
      : diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' });
    const handle = createDriveHandler({
      storage,
      metadata: memoryMetadata(),
      identify: (request) => ({ id: request.headers.get('x-user') ?? 'ana' }),
      authorize: byRoles,
      secret: 'u',
      base: '/api/files',
      ...(extra.quota ? { settings: { quota: extra.quota } } : {}),
    });
    const as = (who: string) =>
      createDriveClient({
        base: 'http://drive.test/api/files',
        headers: () => ({ 'x-user': who }),
        fetch: (input, init) => (String(input).startsWith('http://drive.test/') ? handle(new Request(String(input), init)) : s3!.fetch(input, init)),
        remember: null,
      });
    return { as };
  };
  it('is a file of its own, beside it, with its text, and stays when the first is deleted', async () => {
    const { as } = drive();
    const ana = as('ana');
    const first = await ana.upload(new File(['the quarterly plan'], 'plan.txt', { type: 'text/plain' }), { text: async (blob) => blob.text() });
    const copy = await ana.copy(first.id);
    expect(copy.name).toBe('plan (2).txt');
    expect(copy.id).not.toBe(first.id);
    expect(copy.versions[0].key).not.toBe(first.versions[0].key);
    expect((await ana.searchText('quarterly')).map((found) => found.entry.name).sort()).toEqual(['plan (2).txt', 'plan.txt']);
    await ana.moveToTrash(first.id);
    await ana.deleteForever(first.id);
    const listed = (await ana.list(null)).entries.map((entry) => entry.name);
    expect(listed).toEqual(['plan (2).txt']);
  });

  it('of a file shared to read goes to one’s own top, is one’s own, and counts against one’s space', async () => {
    const { as } = drive({ quota: 1024 * 1024 });
    const ana = as('ana');
    const bea = as('bea');
    const box = await ana.createFolder('Shared', null);
    const file = await ana.upload(new File([new Uint8Array(300_000)], 'notes.bin'), { parent: box.id });
    await ana.share(box.id, 'bea', 'viewer');
    // Into a folder one may only read: refused.
    await expect(bea.copy(file.id, box.id)).rejects.toMatchObject({ status: 403 });
    const copy = await bea.copy(file.id);
    expect(copy.parent).toBeNull();
    expect(copy.owner).toBe('bea');
    await bea.copy(file.id);
    await bea.copy(file.id);
    await expect(bea.copy(file.id)).rejects.toMatchObject({ code: 'over-quota' });
  });
});
