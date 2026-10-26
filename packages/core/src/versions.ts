// Versions of a file: a new one on each save, and an old one brought back as
// a new version, so that nothing is lost by restoring.

import { DriveError } from './errors';
import type { Context, Drive, EntryId, FileEntry, Rendition, Version } from './model';
import { getFile, isTrashed } from './tree';

function live(drive: Drive, id: EntryId): FileEntry {
  const file = getFile(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${file.name} is in the trash`);
  return file;
}

const withFile = (drive: Drive, file: FileEntry): Drive => ({ entries: new Map(drive.entries).set(file.id, file) });

/** The file saved again: its new bytes become the version it is now. */
export function addVersion(drive: Drive, id: EntryId, version: { id: string; key: string; size: number; note?: string; sha256?: string }, context: Context): Drive {
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
  const next: Version = {
    id: newId,
    key: old.key,
    size: old.size,
    at: context.at,
    by: context.by,
    restoredFrom: old.id,
    ...(old.sha256 ? { sha256: old.sha256 } : {}),
    ...(old.placeholder ? { placeholder: old.placeholder } : {}),
    ...(old.renditions ? { renditions: old.renditions } : {}),
  };
  return withFile(drive, { ...file, versions: [next, ...file.versions], modified: context.at, modifiedBy: context.by });
}

/** A version's number as a person counts them: the first one uploaded is 1. */
export const versionNumber = (file: FileEntry, versionId: string): number => {
  const index = file.versions.findIndex((v) => v.id === versionId);
  return index < 0 ? 0 : file.versions.length - index;
};

/**
 * A smaller picture of a version, made after it was uploaded; one for the same size takes the place of the last.
 * Not a change a person sees: the file keeps when and by whom it was changed.
 */
export function addRendition(drive: Drive, id: EntryId, versionId: string, rendition: Rendition): Drive {
  const file = getFile(drive, id);
  const version = file.versions.find((v) => v.id === versionId);
  if (!version) throw new DriveError('no-version', `${file.name} has no version ${versionId}`);
  const renditions = [...(version.renditions ?? []).filter((r) => r.size !== rendition.size), rendition].sort((a, b) => a.size - b.size);
  return withFile(drive, { ...file, versions: file.versions.map((v) => (v === version ? { ...v, renditions } : v)) });
}

/** What a placeholder may be: a small picture, as a data: URL of a JPEG, a PNG or a WebP. */
export const PLACEHOLDER = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** The most characters of one: a tiny picture, not a picture. */
export const PLACEHOLDER_MOST = 4000;

/** A version of a picture given its placeholder, the tiny picture shown blurred while it comes. */
export function setPlaceholder(drive: Drive, id: EntryId, versionId: string, placeholder: string): Drive {
  const file = getFile(drive, id);
  const version = file.versions.find((v) => v.id === versionId);
  if (!version) throw new DriveError('no-version', `${file.name} has no version ${versionId}`);
  if (placeholder.length > PLACEHOLDER_MOST || !PLACEHOLDER.test(placeholder)) throw new DriveError('invalid-settings', 'A placeholder is a tiny picture, as a data: URL.');
  return withFile(drive, { ...file, versions: file.versions.map((v) => (v === version ? { ...v, placeholder } : v)) });
}

/** The smallest rendition of a version that shows it at `size` pixels, or none when only the original does. */
export const renditionFor = (version: Version, size: number): Rendition | undefined => version.renditions?.find((r) => r.size >= size);

/** The files outside the trash whose bytes, as they are now, have one of these SHA-256s: by each. */
export function filesByHash(drive: Drive, hashes: readonly string[]): Map<string, FileEntry[]> {
  const wanted = new Set(hashes);
  const found = new Map<string, FileEntry[]>();
  for (const entry of drive.entries.values()) {
    const hash = entry.kind === 'file' ? entry.versions[0].sha256 : undefined;
    if (!hash || !wanted.has(hash) || isTrashed(drive, entry.id)) continue;
    found.set(hash, [...(found.get(hash) ?? []), entry as FileEntry]);
  }
  return found;
}
