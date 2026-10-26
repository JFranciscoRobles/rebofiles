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
  /** The SHA-256 of its bytes, in hex, as the one who uploaded it said: to tell the same file uploaded again. */
  sha256?: string;
  /** Of a picture, a tiny one of it as a data: URL, a few hundred bytes: shown blurred while the picture comes. */
  placeholder?: string;
  /** The version this one brought back, when it was made by `restoreVersion`. */
  restoredFrom?: string;
  /** Of a picture: smaller ones made of it when it was uploaded, to show it; the bytes under `key` stay as they came. */
  renditions?: Rendition[];
}

/** A picture made smaller, for one size of the drive's: its longest side at most `size` pixels. */
export interface Rendition {
  /** The size of the drive's it was made for: the most pixels of its longest side. */
  size: number;
  width: number;
  height: number;
  key: string;
  type: string;
  /** In bytes. */
  bytes: number;
}

/** What a person shared with may do, the least first. The owner may do everything, and is no role. */
export type Role = 'viewer' | 'commenter' | 'editor';

/** An entry shared with someone, or with everyone signed in (`with: '*'`), and what they may do with it and what is inside it. */
export interface Share {
  with: string;
  role: Role;
  by: string;
  at: string;
}

/** An address to read an entry and what is inside it without signing in, until `expires`. Taken back by removing it. */
export interface Link {
  id: string;
  role: 'viewer';
  /** ISO 8601. */
  expires: string;
  /** Opened only with its password, which the server keeps apart from the drive. */
  locked?: boolean;
  /** How many times what it reads may be downloaded through it: 1 for a link of one use; no limit when left out. */
  uses?: number;
  /** How many times it has been. */
  used?: number;
  /** ISO 8601: when its last use was taken. It works a while longer, for the rest of that download, then no more. */
  spent?: string;
  by: string;
  at: string;
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
  /** Who else it is shared with; what is inside it is shared through it (see `accessOf`). */
  shares?: readonly Share[];
  links?: readonly Link[];
}

/** The colours a folder may be given, each shown as the theme has it; none is the drive's own. */
export const FOLDER_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export interface FolderEntry extends Base {
  kind: 'folder';
  /** Its colour, to tell it apart at a glance; the drive's own when left out. */
  color?: FolderColor;
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
