// What a drive is: entries, each a folder or a file, each in a folder or at
// the top. A `Drive` is an immutable value: every operation returns a new one
// and keeps the entries it did not change, so telling what changed is a
// comparison of references (see `changes`).

export type EntryId = string;

/** One state of a file's bytes. The bytes are in the storage under `key`; the model keeps only where. */
export interface Version {
  id: string;
  key: string;
  /** In bytes. */
  size: number;
  /** ISO 8601. */
  at: string;
  by: string;
  note?: string;
  /** The version this one brought back, when it was made by `restoreVersion`. */
  restoredFrom?: string;
}

/** Put in the trash: when, by whom. The entry keeps its folder, to go back to it. */
export interface Trashed {
  at: string;
  by: string;
}

interface Base {
  id: EntryId;
  name: string;
  /** The folder it is in; null at the top. */
  parent: EntryId | null;
  owner: string;
  created: string;
  modified: string;
  modifiedBy: string;
  /** Only on the entry put in the trash itself; what is inside it is in the trash through it (see `isTrashed`). */
  trashed?: Trashed;
}

export interface FolderEntry extends Base {
  kind: 'folder';
}

export interface FileEntry extends Base {
  kind: 'file';
  /** The media type, as the upload said it: `application/pdf`, `image/png`. */
  type: string;
  /** The newest first: `versions[0]` is the file as it is now. Never empty. */
  versions: readonly Version[];
}

export type Entry = FolderEntry | FileEntry;

export interface Drive {
  readonly entries: ReadonlyMap<EntryId, Entry>;
}

/** Who does an operation, and when. The model has no clock of its own. */
export interface Context {
  by: string;
  at: string;
}

export const emptyDrive = (): Drive => ({ entries: new Map() });

/** A drive of the entries given, as a metadata store keeps them. */
export const driveOf = (entries: Iterable<Entry>): Drive => ({ entries: new Map(Array.from(entries, (entry) => [entry.id, entry])) });

/** The size of a file as it is now; a folder has none of its own. */
export const sizeOf = (entry: Entry): number => (entry.kind === 'file' ? entry.versions[0].size : 0);
