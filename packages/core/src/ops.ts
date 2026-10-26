// Changing a drive. Each operation returns a new `Drive` and throws a
// `DriveError` when it cannot be done, leaving the one given as it was.
//
// A name given by a person (rename, move) is refused when it is taken, unless
// `ifTaken: 'keep-both'`; a name that comes with something new (a folder, an
// upload, a restore from the trash) is made free with "(2)".

import { DriveError } from './errors';
import type { Context, Drive, Entry, EntryId, FileEntry, FolderEntry, Version } from './model';
import { checkName, takenBy, uniqueName } from './names';
import { getEntry, getFolder, isTrashed, isWithin, subtree, trash } from './tree';

export interface NameOptions {
  /** What to do when the name is taken in the folder: refuse with 'name-taken' (the default), or add "(2)". */
  ifTaken?: 'refuse' | 'keep-both';
}

const put = (drive: Drive, ...entries: Entry[]): Drive => {
  const next = new Map(drive.entries);
  for (const entry of entries) next.set(entry.id, entry);
  return { entries: next };
};

/** The folder something goes into: null, or a folder outside the trash. */
function target(drive: Drive, parent: EntryId | null): void {
  if (parent === null) return;
  getFolder(drive, parent);
  if (isTrashed(drive, parent)) throw new DriveError('in-trash', 'That folder is in the trash');
}

/** `owner` is whose the entry is: at the top, only their names count. */
function free(drive: Drive, parent: EntryId | null, name: string, except: EntryId | undefined, owner: string, options: NameOptions): string {
  checkName(name);
  if (!takenBy(drive, parent, name, except, owner)) return name;
  if (options.ifTaken === 'keep-both') return uniqueName(drive, parent, name, except, owner);
  throw new DriveError('name-taken', `There is already a "${name}" there`);
}

function fresh(drive: Drive, id: EntryId): void {
  if (drive.entries.has(id)) throw new DriveError('duplicate-id', `There is already an entry ${id}`);
}

export interface NewFolder {
  id: EntryId;
  name: string;
  parent: EntryId | null;
}

export function createFolder(drive: Drive, folder: NewFolder, context: Context): Drive {
  fresh(drive, folder.id);
  target(drive, folder.parent);
  const entry: FolderEntry = {
    kind: 'folder',
    id: folder.id,
    name: free(drive, folder.parent, folder.name, undefined, context.by, { ifTaken: 'keep-both' }),
    parent: folder.parent,
    owner: context.by,
    created: context.at,
    modified: context.at,
    modifiedBy: context.by,
  };
  return put(drive, entry);
}

export interface NewFile extends NewFolder {
  type: string;
  /** Its first version: where the bytes were put, and how many. */
  version: { id: string; key: string; size: number };
}

/** A file uploaded. Its name is made free with "(2)", as a second upload of the same file should not replace the first. */
export function addFile(drive: Drive, file: NewFile, context: Context): Drive {
  fresh(drive, file.id);
  target(drive, file.parent);
  const entry: FileEntry = {
    kind: 'file',
    id: file.id,
    name: free(drive, file.parent, file.name, undefined, context.by, { ifTaken: 'keep-both' }),
    parent: file.parent,
    owner: context.by,
    created: context.at,
    modified: context.at,
    modifiedBy: context.by,
    type: file.type,
    versions: [{ ...file.version, at: context.at, by: context.by }],
  };
  return put(drive, entry);
}

export function rename(drive: Drive, id: EntryId, name: string, context: Context, options: NameOptions = {}): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (name === entry.name) return drive;
  return put(drive, { ...entry, name: free(drive, entry.parent, name, id, entry.owner, options), modified: context.at, modifiedBy: context.by });
}

export function move(drive: Drive, id: EntryId, to: EntryId | null, context: Context, options: NameOptions = {}): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (to === entry.parent) return drive;
  target(drive, to);
  if (to !== null && isWithin(drive, to, id)) throw new DriveError('into-itself', `${entry.name} cannot go inside itself`);
  return put(drive, { ...entry, parent: to, name: free(drive, to, entry.name, id, entry.owner, options), modified: context.at, modifiedBy: context.by });
}

/** Into the trash, with what is inside it. It keeps its folder, to go back to it. */
export function moveToTrash(drive: Drive, id: EntryId, context: Context): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is already in the trash`);
  return put(drive, { ...entry, trashed: { at: context.at, by: context.by } });
}

/**
 * Out of the trash, to the folder it was in, or to the top when that folder
 * is gone or in the trash itself. Its name is made free with "(2)" when
 * another took it meanwhile.
 */
export function restore(drive: Drive, id: EntryId, context: Context): Drive {
  const entry = getEntry(drive, id);
  if (!entry.trashed) throw new DriveError('not-in-trash', `${entry.name} is not in the trash`);
  const parent = entry.parent !== null && drive.entries.get(entry.parent)?.kind === 'folder' && !isTrashed(drive, entry.parent) ? entry.parent : null;
  const { trashed: _, ...rest } = entry;
  return put(drive, { ...rest, parent, name: uniqueName(drive, parent, entry.name, id, entry.owner), modified: context.at, modifiedBy: context.by } as Entry);
}

export interface Removed {
  drive: Drive;
  /** The entries taken out, the one asked for first. */
  removed: EntryId[];
  /** The storage keys no version keeps any more: what the application deletes from the bucket. */
  keys: string[];
}

/** Gone for good, with what is inside it. Only from the trash: deleting is putting there first. */
export function deleteForever(drive: Drive, id: EntryId): Removed {
  const entry = getEntry(drive, id);
  if (!entry.trashed) throw new DriveError('not-in-trash', `${entry.name} is not in the trash`);
  return remove(drive, subtree(drive, id));
}

/** What has been in the trash since before `before` (ISO 8601) gone for good, with what is in it: the trash emptying itself. */
export function purgeTrash(drive: Drive, before: string): Removed {
  return remove(
    drive,
    trash(drive)
      .filter((entry) => entry.trashed!.at < before)
      .flatMap((entry) => subtree(drive, entry.id)),
  );
}

/**
 * The bytes kept for what `owner` owns, in the trash too: every version and every smaller picture of it, each key
 * once, as a version brought back shares the bytes of the one it was.
 */
export function usageOf(drive: Drive, owner: string): number {
  const keys = new Map<string, number>();
  for (const entry of drive.entries.values())
    if (entry.kind === 'file' && entry.owner === owner)
      for (const version of entry.versions) {
        keys.set(version.key, version.size);
        for (const rendition of version.renditions ?? []) keys.set(rendition.key, rendition.bytes);
      }
  let total = 0;
  for (const bytes of keys.values()) total += bytes;
  return total;
}

/** Everything in the trash gone for good; with `user`, what is in their trash (see `trash`). */
export function emptyTrash(drive: Drive, user?: string): Removed {
  return remove(
    drive,
    trash(drive, user).flatMap((entry) => subtree(drive, entry.id)),
  );
}

function remove(drive: Drive, entries: Entry[]): Removed {
  const next = new Map(drive.entries);
  for (const entry of entries) next.delete(entry.id);
  // A key still used by a version of a file left in the drive stays, as restoring a version reuses its key.
  const kept = new Set<string>();
  const keysOf = (version: Version) => [version.key, ...(version.renditions ?? []).map((r) => r.key)];
  for (const entry of next.values()) if (entry.kind === 'file') for (const version of entry.versions) for (const key of keysOf(version)) kept.add(key);
  const keys = new Set<string>();
  for (const entry of entries) if (entry.kind === 'file') for (const version of entry.versions) for (const key of keysOf(version)) if (!kept.has(key)) keys.add(key);
  return { drive: { entries: next }, removed: entries.map((entry) => entry.id), keys: [...keys] };
}
