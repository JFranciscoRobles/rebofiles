// What goes in an archive of some entries of a drive: each file, and each
// folder with everything in it, at the path it has from the entry picked, as a
// person who unpacks it finds them. Two picked from different folders with the
// same name are told apart as "(2)", as a name taken in one folder would be.

import type { Drive, Entry, EntryId } from './model';
import { splitName } from './names';
import { getEntry } from './tree';

export interface PackedFile {
  id: EntryId;
  /** Where it goes in the archive: `Contracts/2026/agreement.docx`. */
  path: string;
  size: number;
  type: string;
  /** ISO 8601: when its current version was made. */
  modified: string;
}

export interface Packed {
  files: PackedFile[];
  /** Every folder, its path ending in "/": an empty one is still there once unpacked. */
  folders: string[];
}

/**
 * The files and folders of an archive of `ids`, the folders with what is in them and not in the trash, each that
 * `may` lets in; one picked that it does not, or that is not there, is left out with what is in it.
 */
export function packOf(drive: Drive, ids: EntryId[], may: (entry: Entry) => boolean = () => true): Packed {
  const files: PackedFile[] = [];
  const folders: string[] = [];
  const under = new Map<EntryId, Entry[]>();
  for (const entry of drive.entries.values()) if (entry.parent !== null && !entry.trashed) (under.get(entry.parent) ?? under.set(entry.parent, []).get(entry.parent)!).push(entry);
  const taken = new Set<string>();
  /** A name at the top of the archive, told apart from one already there as "(2)". */
  const free = (name: string) => {
    const { base, ext } = splitName(name);
    let shown = name;
    for (let n = 2; taken.has(shown.toLowerCase()); n++) shown = `${base} (${n})${ext}`;
    taken.add(shown.toLowerCase());
    return shown;
  };
  const put = (entry: Entry, path: string) => {
    if (entry.kind === 'file') {
      files.push({ id: entry.id, path, size: entry.versions[0].size, type: entry.type, modified: entry.versions[0].at });
      return;
    }
    folders.push(`${path}/`);
    const inside = (under.get(entry.id) ?? []).filter(may).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    for (const child of inside) put(child, `${path}/${child.name}`);
  };
  for (const id of new Set(ids)) {
    const entry = drive.entries.get(id);
    if (!entry || !may(entry)) continue;
    put(getEntry(drive, id), free(entry.name));
  }
  return { files, folders };
}
