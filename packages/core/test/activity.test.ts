import { describe, expect, it } from 'vitest';
import { activityFor, activityOf, addLink, addVersion, createFolder, deleteForever, move, moveToTrash, removeLink, rename, restore, share, unshare } from '../src';
import { ana, demoDrive, v } from './drive';

const at = '2026-10-06T09:00:00.000Z';
const said = (before: ReturnType<typeof demoDrive>, after: ReturnType<typeof demoDrive>) => activityOf(before, after, 'ana', at).map((a) => [a.action, a.name, a.was ?? a.with ?? a.from ?? '']);

describe('activity', () => {
  it('tells what an operation did from the drives before and after it', () => {
    const drive = demoDrive();
    expect(said(drive, createFolder(drive, { id: 'n', name: 'New', parent: null }, ana))).toEqual([['created', 'New', '']]);
    expect(said(drive, rename(drive, 'clients', 'Customers', ana))).toEqual([['renamed', 'Customers', 'Clients']]);
    expect(said(drive, move(drive, 'northwind', null, ana))).toEqual([['moved', 'Northwind', 'clients']]);
    const trashed = moveToTrash(drive, 'clients', ana);
    expect(said(drive, trashed)).toEqual([['trashed', 'Clients', '']]);
    expect(said(trashed, restore(trashed, 'clients', ana))).toEqual([['restored', 'Clients', '']]);
    // Deleted with all inside it: one line, for the top of it.
    expect(said(trashed, deleteForever(trashed, 'clients').drive)).toEqual([['deleted', 'Clients', '']]);
    const shared = share(drive, 'clients', 'bea', 'viewer', ana);
    expect(said(drive, shared)).toEqual([['shared', 'Clients', 'bea']]);
    expect(said(shared, share(shared, 'clients', 'bea', 'editor', ana))).toEqual([['shared', 'Clients', 'bea']]);
    expect(said(shared, share(shared, 'clients', 'bea', 'viewer', ana))).toEqual([]);
    expect(said(shared, unshare(shared, 'clients', 'bea'))).toEqual([['unshared', 'Clients', 'bea']]);
    const linked = addLink(drive, 'clients', { id: 'l', expires: '2026-12-01T00:00:00.000Z' }, ana);
    expect(said(drive, linked).map(([action]) => action)).toEqual(['linked']);
    expect(said(linked, removeLink(linked, 'clients', 'l')).map(([action]) => action)).toEqual(['unlinked']);
  });

  it('tells a new version, and finds what was done in a folder', () => {
    const drive = demoDrive();
    const file = [...drive.entries.values()].find((e) => e.kind === 'file')!;
    const next = addVersion(drive, file.id, v(5), ana);
    const lines = activityOf(drive, next, 'ana', at);
    expect(lines.map((a) => a.action)).toEqual(['version']);
    expect(activityFor(lines, file.parent!)).toHaveLength(1);
    expect(activityFor(lines, 'elsewhere')).toEqual([]);
  });
});
