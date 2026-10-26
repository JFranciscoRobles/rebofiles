import { describe, expect, it } from 'vitest';
import { EVERYONE, accessOf, addFile, addLink, allows, createFolder, emptyTrash, linked, move, moveToTrash, removeLink, rename, restore, share, sharedWith, trash, unshare } from '../src';
import { ana, demoDrive, luis, v } from './drive';

const bea = { by: 'bea', at: '2026-10-03T09:00:00.000Z' };

describe('the top of the drive', () => {
  it('is each owner’s: a name someone else has there is free, and not told', () => {
    const drive = createFolder(demoDrive(), { id: 'mine', name: 'Clients', parent: null }, luis);
    expect(drive.entries.get('mine')?.name).toBe('Clients');
    // Ana's own second "Clients" is still made free.
    expect(createFolder(drive, { id: 'again', name: 'clients', parent: null }, ana).entries.get('again')?.name).toBe('clients (2)');
    expect(() => rename(drive, 'photos', 'Clients', ana)).toThrow('There is already a "Clients" there');
    expect(rename(drive, 'mine', 'Photos', luis).entries.get('mine')?.name).toBe('Photos');
  });

  it('takes an entry moved or restored to it among the names of its owner', () => {
    let drive = createFolder(demoDrive(), { id: 'l', name: 'Northwind', parent: null }, luis);
    drive = move(drive, 'northwind', null, ana);
    expect(drive.entries.get('northwind')?.name).toBe('Northwind');
    drive = moveToTrash(drive, 'l', luis);
    drive = createFolder(drive, { id: 'l2', name: 'Northwind', parent: null }, luis);
    expect(restore(drive, 'l', luis).entries.get('l')?.name).toBe('Northwind (2)');
  });
});

describe('who may do what', () => {
  it('gives the owner everything, and nothing to anyone else until it is shared', () => {
    const drive = demoDrive();
    expect(accessOf(drive, 'contract', 'ana')).toBe('owner');
    expect(accessOf(drive, 'contract', 'luis')).toBeNull();
    expect(allows(null, 'read')).toBe(false);
  });

  it('shares a folder with what is inside it, the greater role winning', () => {
    let drive = share(demoDrive(), 'clients', 'luis', 'viewer', ana);
    expect(accessOf(drive, 'contract', 'luis')).toBe('viewer');
    expect(accessOf(drive, 'photos', 'luis')).toBeNull();
    drive = share(drive, 'northwind', 'luis', 'editor', ana);
    expect(accessOf(drive, 'contract', 'luis')).toBe('editor');
    expect(accessOf(drive, 'clients', 'luis')).toBe('viewer');
    // Given again, a share is changed, not added.
    drive = share(drive, 'clients', 'luis', 'commenter', ana);
    expect(drive.entries.get('clients')?.shares).toMatchObject([{ with: 'luis', role: 'commenter', by: 'ana' }]);
  });

  it('says what each role may do', () => {
    expect(['list', 'read', 'download'].every((a) => allows('viewer', a as never))).toBe(true);
    expect(allows('viewer', 'comment')).toBe(false);
    expect(allows('commenter', 'comment')).toBe(true);
    expect(allows('commenter', 'upload')).toBe(false);
    expect(['create', 'upload', 'rename', 'move', 'trash', 'restore'].every((a) => allows('editor', a as never))).toBe(true);
    expect(allows('editor', 'delete')).toBe(false);
    expect(allows('editor', 'share')).toBe(false);
    expect(allows('owner', 'share')).toBe(true);
  });

  it('makes the owner of a folder the owner of what others put in it', () => {
    let drive = share(demoDrive(), 'clients', 'luis', 'editor', ana);
    drive = addFile(drive, { id: 'quote', name: 'quote.pdf', parent: 'northwind', type: 'application/pdf', version: v() }, luis);
    expect(drive.entries.get('quote')?.owner).toBe('luis');
    expect(accessOf(drive, 'quote', 'ana')).toBe('owner');
    expect(accessOf(drive, 'quote', 'luis')).toBe('owner');
  });

  it('shares with everyone signed in', () => {
    const drive = share(demoDrive(), 'photos', EVERYONE, 'viewer', ana);
    expect(accessOf(drive, 'logo', 'anyone')).toBe('viewer');
  });

  it('stops sharing, keeping what comes from a folder above', () => {
    let drive = share(share(demoDrive(), 'clients', 'luis', 'viewer', ana), 'northwind', 'luis', 'editor', ana);
    drive = unshare(drive, 'northwind', 'luis');
    expect(accessOf(drive, 'contract', 'luis')).toBe('viewer');
    expect(drive.entries.get('northwind')?.shares).toBeUndefined();
    expect(unshare(drive, 'northwind', 'luis')).toBe(drive);
  });

  it('refuses to share with no one, with the owner, in the trash, or as a role that is not one', () => {
    const drive = demoDrive();
    expect(() => share(drive, 'clients', ' ', 'viewer', ana)).toThrow('Say who');
    expect(() => share(drive, 'clients', 'ana', 'viewer', ana)).toThrow('ana owns Clients');
    expect(() => share(drive, 'clients', 'luis', 'owner' as never, ana)).toThrow('is not a role');
    expect(() => share(moveToTrash(drive, 'clients', ana), 'northwind', 'luis', 'viewer', ana)).toThrow('in the trash');
  });
});

describe('one’s trash', () => {
  it('is what one owns or put there, and only that is emptied', () => {
    let drive = share(demoDrive(), 'clients', 'luis', 'editor', ana);
    drive = moveToTrash(drive, 'contract', luis);
    drive = moveToTrash(drive, 'photos', ana);
    drive = addFile(drive, { id: 'mine', name: 'mine.txt', parent: null, type: 'text/plain', version: v() }, luis);
    drive = moveToTrash(drive, 'mine', luis);
    expect(
      trash(drive, 'luis')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['contract', 'mine']);
    expect(
      trash(drive, 'ana')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['contract', 'photos']);
    const emptied = emptyTrash(drive, 'luis');
    expect(emptied.removed.sort()).toEqual(['contract', 'mine']);
    expect(trash(emptied.drive).map((e) => e.id)).toEqual(['photos']);
  });
});

describe('shared with me', () => {
  it('lists where something was shared, not what is inside it nor what is reached through a folder above', () => {
    let drive = share(demoDrive(), 'clients', 'luis', 'viewer', ana);
    drive = share(drive, 'northwind', 'luis', 'editor', ana);
    drive = share(drive, 'logo', 'luis', 'viewer', bea);
    expect(sharedWith(drive, 'luis').map((e) => e.id)).toEqual(['logo', 'clients']);
    expect(sharedWith(drive, 'ana')).toEqual([]);
    expect(sharedWith(moveToTrash(drive, 'clients', ana), 'luis').map((e) => e.id)).toEqual(['logo']);
  });
});

describe('links', () => {
  const now = '2026-10-05T00:00:00.000Z';

  it('read an entry until they expire or are taken away', () => {
    let drive = addLink(demoDrive(), 'clients', { id: 'l1', expires: '2026-10-10T00:00:00.000Z' }, ana);
    expect(linked(drive, 'l1', now)?.id).toBe('clients');
    expect(linked(drive, 'l1', '2026-10-11T00:00:00.000Z')).toBeNull();
    expect(linked(moveToTrash(drive, 'clients', ana), 'l1', now)).toBeNull();
    drive = removeLink(drive, 'clients', 'l1');
    expect(linked(drive, 'l1', now)).toBeNull();
    expect(drive.entries.get('clients')?.links).toBeUndefined();
  });

  it('must expire after they are made', () => {
    expect(() => addLink(demoDrive(), 'clients', { id: 'l', expires: ana.at }, ana)).toThrow('expire after');
  });
});
