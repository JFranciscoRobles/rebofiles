// Reading a drive: what is in a folder, where an entry is, what is in the trash.

import { DriveError } from './errors';
import type { Drive, Entry, EntryId, FileEntry, FolderEntry } from './model';

export function getEntry(drive: Drive, id: EntryId): Entry {
  const entry = drive.entries.get(id);
  if (!entry) throw new DriveError('not-found', `No entry ${id}`);
  return entry;
}

export function getFile(drive: Drive, id: EntryId): FileEntry {
  const entry = getEntry(drive, id);
  if (entry.kind !== 'file') throw new DriveError('not-a-file', `${entry.name} is a folder`);
  return entry;
}

export function getFolder(drive: Drive, id: EntryId): FolderEntry {
  const entry = getEntry(drive, id);
  if (entry.kind !== 'folder') throw new DriveError('not-a-folder', `${entry.name} is not a folder`);
  return entry;
}

/** Folders first, then files, each by name as a person sorts them: "2" before "10". */
export const byName = (a: Entry, b: Entry): number => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

/** What is in a folder (null for the top), outside the trash, sorted. */
export function children(drive: Drive, parent: EntryId | null): Entry[] {
  if (parent !== null) getFolder(drive, parent);
  const found: Entry[] = [];
  for (const entry of drive.entries.values()) if (entry.parent === parent && !entry.trashed) found.push(entry);
  return found.sort(byName);
}

/** The folders from the top down to the one an entry is in, without the entry: what a breadcrumb shows. */
export function ancestors(drive: Drive, id: EntryId): FolderEntry[] {
  const path: FolderEntry[] = [];
  let parent = getEntry(drive, id).parent;
  while (parent !== null) {
    const folder = getFolder(drive, parent);
    path.unshift(folder);
    parent = folder.parent;
  }
  return path;
}

/** Whether `id` is `folder` or anywhere inside it. */
export function isWithin(drive: Drive, id: EntryId, folder: EntryId): boolean {
  for (let at: EntryId | null = id; at !== null; at = getEntry(drive, at).parent) if (at === folder) return true;
  return false;
}

/** In the trash itself, or inside a folder that is. */
export function isTrashed(drive: Drive, id: EntryId): boolean {
  for (let at: EntryId | null = id; at !== null; ) {
    const entry = getEntry(drive, at);
    if (entry.trashed) return true;
    at = entry.parent;
  }
  return false;
}

/**
 * What was put in the trash, the latest first; what is inside a trashed folder goes with it and is not listed.
 * With `user`, their trash: what they own or put there, not what others threw away where they may look.
 */
export function trash(drive: Drive, user?: string): Entry[] {
  const found: Entry[] = [];
  for (const entry of drive.entries.values()) if (entry.trashed && (user === undefined || entry.owner === user || entry.trashed.by === user)) found.push(entry);
  return found.sort((a, b) => (a.trashed!.at < b.trashed!.at ? 1 : a.trashed!.at > b.trashed!.at ? -1 : byName(a, b)));
}

/** The files changed last, outside the trash, the latest first. */
export function recent(drive: Drive, limit = 50): FileEntry[] {
  const found: FileEntry[] = [];
  for (const entry of drive.entries.values()) if (entry.kind === 'file' && !isTrashed(drive, entry.id)) found.push(entry);
  return found.sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : byName(a, b))).slice(0, limit);
}

/** An entry and everything under it, the entry first. */
export function subtree(drive: Drive, id: EntryId): Entry[] {
  const under = new Map<EntryId, Entry[]>();
  for (const entry of drive.entries.values()) if (entry.parent !== null) (under.get(entry.parent) ?? under.set(entry.parent, []).get(entry.parent)!).push(entry);
  const found = [getEntry(drive, id)];
  for (let i = 0; i < found.length; i++) found.push(...(under.get(found[i].id) ?? []));
  return found;
}
