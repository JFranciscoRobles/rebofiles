// Files put through a link of a folder: a link that lets them in besides, and
// a request for files, which sees nothing of what is there. What arrives is
// the folder owner's, says who sent it, counts against their space, and they
// are told; a link only to read takes none, and one that takes them does
// nothing else.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveClient, createLinkClient } from '@rebofiles/drive';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-requests-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

function drive(settings?: { quota: number }) {
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' }),
    metadata: memoryMetadata(),
    identify: (request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null),
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    ...(settings ? { settings } : {}),
  });
  const route: typeof fetch = (input, init) => handle(new Request(new URL(String(input), 'http://drive.test').toString(), init));
  const ana = createDriveClient({ base: 'http://drive.test/api/files', headers: () => ({ 'x-user': 'ana' }), fetch: route, remember: null });
  const guest = (token: string, from?: string) => createLinkClient({ base: 'http://drive.test/api/files', token, fetch: route, from: () => from });
  return { ana, guest };
}

describe('files put through a link', () => {
  it('arrive in the folder, the owner’s, saying who sent them, and the owner is told', async () => {
    const { ana, guest } = drive();
    const box = await ana.createFolder('From clients', null);
    const { token } = await ana.createLink(box.id, 7, { uploads: 'also' });
    const sent = await guest(token, 'Carla Ruiz').upload(new File(['my papers'], 'papers.txt', { type: 'text/plain' }));
    expect(sent).toMatchObject({ name: 'papers.txt', parent: box.id, owner: 'ana', fields: { from: 'Carla Ruiz' } });
    // A link that lets them in besides lists them.
    expect((await guest(token).list()).entries.map((entry) => entry.name)).toEqual(['papers.txt']);
    expect((await guest(token).list()).link).toEqual({ uploads: 'also' });
    const { notifications } = await ana.notifications();
    expect(notifications[0]).toMatchObject({ kind: 'received', name: 'papers.txt', by: 'Carla Ruiz', entry: sent.id });
    expect((await ana.usage()).used).toBe(9);
  });

  it('as a request for files, see nothing of what is there', async () => {
    const { ana, guest } = drive();
    const box = await ana.createFolder('Inbox', null);
    await ana.upload(new File(['private'], 'mine.txt'), { parent: box.id });
    const { token } = await ana.createLink(box.id, 7, { uploads: 'only' });
    await guest(token).upload(new File(['hello'], 'theirs.txt'));
    const listed = await guest(token).list();
    expect(listed.entries).toEqual([]);
    expect(listed.link).toEqual({ uploads: 'only' });
    const mine = (await ana.list(box.id)).entries.find((entry) => entry.name === 'mine.txt')!;
    await expect(guest(token).url(mine.id)).rejects.toMatchObject({ status: 403 });
    await expect(guest(token).pack()).rejects.toMatchObject({ status: 403 });
    expect((await ana.list(box.id)).entries.map((entry) => entry.name).sort()).toEqual(['mine.txt', 'theirs.txt']);
  });

  it('are refused by a link only to read, and by one of a file; and count against the owner’s space', async () => {
    const { ana, guest } = drive({ quota: 1024 * 1024 });
    const box = await ana.createFolder('Read', null);
    const { token } = await ana.createLink(box.id, 7);
    await expect(guest(token).upload(new File(['x'], 'x.txt'))).rejects.toMatchObject({ status: 403 });
    const file = await ana.upload(new File(['f'], 'f.txt'));
    await expect(ana.createLink(file.id, 7, { uploads: 'also' })).rejects.toMatchObject({ code: 'invalid-share' });
    const drop = await ana.createLink(box.id, 7, { uploads: 'only' });
    await guest(drop.token).upload(new File([new Uint8Array(700_000)], 'big.bin'));
    await expect(guest(drop.token).upload(new File([new Uint8Array(700_000)], 'bigger.bin'))).rejects.toMatchObject({ code: 'over-quota' });
  });
});
