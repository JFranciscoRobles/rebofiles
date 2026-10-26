// A folder of the disk and a drive kept the same, through the server's routes
// as the desktop would go through them: what is made, changed, moved and taken
// away on each side, what changed on both, and a disk that is not there.

import { mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { createDriveHandler, diskStorage, memoryMetadata } from '@rebofiles/server';
import { EmptyFolderRefused, type SyncState, loadState, nodeFolder, syncOnce, watchSync } from '../src';

let base = '';
beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), 'rebofiles-sync-'));
});
afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

/** A drive behind its routes, a client of it as Ana, and an empty folder of the disk. */
async function setUp() {
  const at = join(base, String(Math.random()));
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(at, 'bucket'), secret: 's' }),
    metadata: memoryMetadata(),
    identify: () => ({ id: 'ana' }),
    authorize: () => true,
    secret: 'u',
    base: '/api/files',
  });
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => handle(new Request(String(url), init))) as typeof globalThis.fetch;
  const client = createDriveClient({ base: 'http://drive.test/api/files', fetch, remember: null });
  const disk = join(at, 'disk');
  await mkdir(disk, { recursive: true });
  let state: SyncState | undefined;
  const run = async (extra: { allowEmpty?: boolean } = {}) => {
    const done = await syncOnce({ client, local: nodeFolder(disk), state, fetch, now: () => new Date('2026-10-26T14:05:00Z'), ...extra });
    state = done.state;
    return done.actions.map((a) => `${a.do} ${a.path}${'to' in a ? ` → ${a.to}` : ''}${'kept' in a ? ` + ${a.kept}` : ''}${'error' in a ? `: ${a.error}` : ''}`);
  };
  const put = async (path: string, text: string) => {
    await mkdir(join(disk, path, '..'), { recursive: true });
    await writeFile(join(disk, path), text);
  };
  const text = (path: string) => readFile(join(disk, path), 'utf8');
  const tree = async () => (await readdir(disk, { recursive: true })).filter((p) => !p.startsWith('.rebofiles')).sort();
  const names = async (folder: string | null = null) => (await client.list(folder)).entries.map((e) => e.name).sort();
  const bytes = async (file: FileEntry) => (await fetch(await client.url(file.id))).text();
  return { client, fetch, disk, run, put, text, tree, names, bytes, upload: (name: string, body: string, parent: string | null = null) => client.upload(new File([body], name), { parent }) };
}

describe('the sync', () => {
  it('takes the drive to an empty folder, and what is made on the disk to the drive', async () => {
    const d = await setUp();
    const clients = await d.client.createFolder('Clients', null);
    await d.upload('contract.txt', 'signed', clients.id);
    await d.upload('notes.txt', 'top');
    expect(await d.run()).toEqual(['mkdir-local Clients', 'download notes.txt', 'download Clients/contract.txt']);
    expect(await d.tree()).toEqual(['Clients', 'Clients/contract.txt', 'notes.txt']);
    expect(await d.text('Clients/contract.txt')).toBe('signed');
    expect(await d.run()).toEqual([]);

    await d.put('Clients/Northwind/brief.txt', 'a brief');
    await d.put('todo.txt', 'buy milk');
    expect(await d.run()).toEqual(['upload todo.txt', 'mkdir-remote Clients/Northwind', 'upload Clients/Northwind/brief.txt']);
    const northwind = (await d.client.list(clients.id)).entries.find((e) => e.name === 'Northwind')!;
    expect(await d.names(northwind.id)).toEqual(['brief.txt']);
    expect(await d.names()).toEqual(['Clients', 'notes.txt', 'todo.txt']);
    expect(await d.run()).toEqual([]);
  });

  it('sends a change of either side to the other, and keeps both when both changed', async () => {
    const d = await setUp();
    const file = await d.upload('plan.txt', 'one');
    await d.run();
    // In the drive: a new version, taken to the disk.
    await d.client.upload(new File(['two'], 'plan.txt'), { file: file.id });
    expect(await d.run()).toEqual(['download plan.txt']);
    expect(await d.text('plan.txt')).toBe('two');
    // On the disk: sent as a new version of the same file.
    await d.put('plan.txt', 'three!');
    expect(await d.run()).toEqual(['upload plan.txt']);
    const now = (await d.client.entry(file.id)).entry as FileEntry;
    expect(now.versions).toHaveLength(3);
    expect(await d.bytes(now)).toBe('three!');
    // On both: the drive's at its name, the disk's beside it, in the drive too.
    await d.client.upload(new File(['theirs'], 'plan.txt'), { file: file.id });
    await d.put('plan.txt', 'mine, longer');
    expect(await d.run()).toEqual(['conflict plan.txt + plan (conflict 2026-10-26 14.05).txt', 'upload plan (conflict 2026-10-26 14.05).txt', 'download plan.txt']);
    expect(await d.text('plan.txt')).toBe('theirs');
    expect(await d.text('plan (conflict 2026-10-26 14.05).txt')).toBe('mine, longer');
    expect(await d.names()).toEqual(['plan (conflict 2026-10-26 14.05).txt', 'plan.txt']);
    expect(await d.run()).toEqual([]);
  });

  it('follows a folder renamed and a file moved in the drive, and a file renamed on the disk', async () => {
    const d = await setUp();
    const a = await d.client.createFolder('A', null);
    const b = await d.client.createFolder('B', null);
    const deep = await d.upload('deep.txt', 'deep', a.id);
    const loose = await d.upload('loose.txt', 'loose');
    await d.run();
    await d.client.rename(a.id, 'Archive');
    await d.client.move(loose.id, b.id);
    expect(await d.run()).toEqual(['move-local A → Archive', 'move-local loose.txt → B/loose.txt']);
    expect(await d.tree()).toEqual(['Archive', 'Archive/deep.txt', 'B', 'B/loose.txt']);
    expect(await d.run()).toEqual([]);

    // On the disk: the same file, its size and time, by another name and in another folder. The same entry, its versions with it.
    await rename(join(d.disk, 'Archive/deep.txt'), join(d.disk, 'B/deeper.txt'));
    expect(await d.run()).toEqual(['move-remote Archive/deep.txt → B/deeper.txt']);
    expect((await d.client.entry(deep.id)).entry).toMatchObject({ name: 'deeper.txt', parent: b.id });
    expect(await d.run()).toEqual([]);
  });

  it('takes from one side what is gone from the other: into the drive’s trash, or aside on the disk', async () => {
    const d = await setUp();
    const old = await d.client.createFolder('Old', null);
    await d.upload('a.txt', 'a', old.id);
    const b = await d.upload('b.txt', 'b');
    await d.upload('c.txt', 'c');
    await d.run();
    await unlink(join(d.disk, 'c.txt'));
    await rm(join(d.disk, 'Old'), { recursive: true });
    await d.client.moveToTrash(b.id);
    expect((await d.run()).sort()).toEqual(['remove-local b.txt', 'trash-remote Old', 'trash-remote c.txt']);
    expect(await d.names()).toEqual([]);
    expect((await d.client.trash()).map((e) => e.name).sort()).toEqual(['Old', 'b.txt', 'c.txt']);
    expect(await d.tree()).toEqual([]);
    // Aside, not gone.
    const removed = await readdir(join(d.disk, '.rebofiles', 'removed'), { recursive: true });
    expect(removed.some((p) => p.endsWith('b.txt'))).toBe(true);
  });

  it('sends again what changed on one side while the other took it away', async () => {
    const d = await setUp();
    const kept = await d.upload('kept.txt', 'one');
    await d.run();
    await d.client.moveToTrash(kept.id);
    await d.put('kept.txt', 'changed meanwhile');
    expect(await d.run()).toEqual(['upload kept.txt']);
    expect(await d.names()).toEqual(['kept.txt']);
  });

  it('does nothing to a drive when the folder of the disk is empty and was not', async () => {
    const d = await setUp();
    await d.upload('a.txt', 'a');
    await d.run();
    await rm(join(d.disk, 'a.txt'));
    await expect(d.run()).rejects.toBeInstanceOf(EmptyFolderRefused);
    expect(await d.names()).toEqual(['a.txt']);
    expect(await d.run({ allowEmpty: true })).toEqual(['trash-remote a.txt']);
  });

  it('leaves out the files of the systems and its own folder', async () => {
    const d = await setUp();
    await d.put('.DS_Store', 'x');
    await d.put('~$report.docx', 'lock');
    await d.put('report.docx', 'r');
    expect(await d.run()).toEqual(['upload report.docx']);
    expect(await d.names()).toEqual(['report.docx']);
    // A folder and a file of one name on each side: the drive's is kept at the name.
    await d.client.createFolder('Same', null);
    await d.put('same', 'a file on the disk');
    expect(await d.run()).toEqual(['conflict Same + same (conflict 2026-10-26 14.05)', 'upload same (conflict 2026-10-26 14.05)']);
    expect(await d.names()).toEqual(['report.docx', 'Same', 'same (conflict 2026-10-26 14.05)'].sort());
    expect(await d.text('same (conflict 2026-10-26 14.05)')).toBe('a file on the disk');
  });
});

describe('a sync that goes on', () => {
  it('runs when the drive tells a change, and when a file of the disk changes, and keeps its state', async () => {
    const d = await setUp();
    const runs: string[][] = [];
    const sync = watchSync({ client: d.client, folder: d.disk, fetch: d.fetch, onIdle: (actions) => runs.push(actions.map((a) => `${a.do} ${a.path}`)) });
    await sync.done;
    await d.upload('from-the-drive.txt', 'hi');
    for (let i = 0; i < 100 && !runs.flat().includes('download from-the-drive.txt'); i++) await new Promise((done) => setTimeout(done, 50));
    expect(await d.text('from-the-drive.txt')).toBe('hi');
    await d.put('from-the-disk.txt', 'hello');
    for (let i = 0; i < 100 && !runs.flat().includes('upload from-the-disk.txt'); i++) await new Promise((done) => setTimeout(done, 50));
    expect(await d.names()).toEqual(['from-the-disk.txt', 'from-the-drive.txt']);
    sync.stop();
    expect(Object.keys((await loadState(d.disk))!.entries).sort()).toEqual(['from-the-disk.txt', 'from-the-drive.txt']);
  }, 20_000);
});
