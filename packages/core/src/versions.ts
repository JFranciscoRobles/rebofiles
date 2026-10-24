// Versions of a file: a new one on each save, and an old one brought back as
// a new version, so that nothing is lost by restoring.

import { DriveError } from './errors';
import type { Context, Drive, EntryId, FileEntry, Version } from './model';
import { getFile, isTrashed } from './tree';

function live(drive: Drive, id: EntryId): FileEntry {
  const file = getFile(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${file.name} is in the trash`);
  return file;
}

const withFile = (drive: Drive, file: FileEntry): Drive => ({ entries: new Map(drive.entries).set(file.id, file) });

/** The file saved again: its new bytes become the version it is now. */
export function addVersion(drive: Drive, id: EntryId, version: { id: string; key: string; size: number; note?: string }, context: Context): Drive {
  const file = live(drive, id);
  if (file.versions.some((v) => v.id === version.id)) throw new DriveError('duplicate-id', `There is already a version ${version.id}`);
  const next: Version = { ...version, at: context.at, by: context.by };
  return withFile(drive, { ...file, versions: [next, ...file.versions], modified: context.at, modifiedBy: context.by });
}

/** An old version brought back, as a new version with the same bytes: the storage is not written. */
export function restoreVersion(drive: Drive, id: EntryId, versionId: string, newId: string, context: Context): Drive {
  const file = live(drive, id);
  const old = file.versions.find((v) => v.id === versionId);
  if (!old) throw new DriveError('no-version', `${file.name} has no version ${versionId}`);
  if (old === file.versions[0]) return drive;
  if (file.versions.some((v) => v.id === newId)) throw new DriveError('duplicate-id', `There is already a version ${newId}`);
  const next: Version = { id: newId, key: old.key, size: old.size, at: context.at, by: context.by, restoredFrom: old.id };
  return withFile(drive, { ...file, versions: [next, ...file.versions], modified: context.at, modifiedBy: context.by });
}

/** A version's number as a person counts them: the first one uploaded is 1. */
export const versionNumber = (file: FileEntry, versionId: string): number => {
  const index = file.versions.findIndex((v) => v.id === versionId);
  return index < 0 ? 0 : file.versions.length - index;
};
