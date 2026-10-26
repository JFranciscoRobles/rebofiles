import { describe, expect, it } from 'vitest';
import * as core from '@rebofiles/core';
import { rename } from '@rebofiles/core';
import { RequestError } from '../src/client';
import { createMemoryClient } from '../src/memory';

describe('the drive kept in the page', () => {
  it('does what the server does, with the same refusals', async () => {
    const drive = createMemoryClient({ user: 'ana', uploadStep: 0 });
    const clients = await drive.createFolder('Clients', null);
    const file = await drive.upload(new File(['hello'], 'hello.txt', { type: 'text/plain' }), { parent: clients.id });
    expect((await drive.list(clients.id)).entries.map((e) => e.name)).toEqual(['hello.txt']);
    expect(file.owner).toBe('ana');
    const again = await drive.upload(new File(['x'], 'hello.txt'), { parent: clients.id });
    expect(again.name).toBe('hello (2).txt');
    const error = await drive.rename(again.id, 'HELLO.txt').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({ status: 409, code: 'name-taken' });
  });

  it('reports an upload as it goes, in steps', async () => {
    const drive = createMemoryClient({ uploadStep: 1 });
    const seen: number[] = [];
    await drive.upload(new File([new Uint8Array(1000)], 'a.bin'), { onProgress: ({ sent }) => seen.push(sent) });
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(1000);
    expect(seen.length).toBeGreaterThan(5);
  });

  it('keeps the bytes of each version and forgets them when deleted for good', async () => {
    const blobs = new Map<string, Blob>();
    const drive = createMemoryClient({ blobs, uploadStep: 0 });
    const first = await drive.upload(new File(['one'], 'v.txt'));
    await drive.upload(new File(['two'], 'v.txt'), { file: first.id });
    expect(blobs.size).toBe(2);
    await drive.moveToTrash(first.id);
    await drive.emptyTrash();
    expect(blobs.size).toBe(0);
  });

  it('takes a change made by someone else, as an assistant', async () => {
    const drive = createMemoryClient({ uploadStep: 0 });
    const file = await drive.upload(new File(['x'], 'contract-final(2).docx'));
    drive.apply((current, context) => rename(current, file.id, 'contract-northwind.docx', context), 'Claude');
    expect((await drive.entry(file.id)).entry).toMatchObject({ name: 'contract-northwind.docx', modifiedBy: 'Claude' });
    expect(drive.drive.entries.size).toBe(1);
  });

  it('keeps the top to the user’s own unless it is one drive for everyone, and shares as the server does', async () => {
    let drive = core.createFolder(core.emptyDrive(), { id: 'a', name: 'Ana’s', parent: null }, { by: 'ana', at: '2026-10-01T00:00:00Z' });
    drive = core.share(drive, 'a', 'me', 'viewer', { by: 'ana', at: '2026-10-01T00:00:00Z' });
    expect((await createMemoryClient({ drive, uploadStep: 0 }).list(null)).entries).toEqual([]);
    expect((await createMemoryClient({ drive, uploadStep: 0, top: 'everyone' }).list(null)).entries.map((e) => e.name)).toEqual(['Ana’s']);
    const mine = createMemoryClient({ drive, uploadStep: 0 });
    expect((await mine.shared()).map((e) => e.name)).toEqual(['Ana’s']);
    const own = await mine.createFolder('Mine', null);
    const { token } = await mine.createLink(own.id);
    expect(await mine.linkToken(own.id, token)).toBe(token);
  });
});
