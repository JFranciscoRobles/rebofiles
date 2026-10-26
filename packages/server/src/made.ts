// What the server makes of a file once it is kept, for what did not come from
// a page that makes it itself (an assistant, a sync, a script): its smaller
// pictures, the tiny one shown blurred while they come, and what is written
// in it, to find it by. What makes them is the application's (`derive`), as
// `@rebofiles/server/derive` gives, with sharp and pdf.js.

import type { FileEntry, ImageSettings } from '@rebofiles/core';

/** What a page made of a file itself, and the server need not: said when the upload starts. */
export type MadeHere = 'pictures' | 'text';

/** A file kept, and what is wanted of it. */
export interface ToDerive {
  file: FileEntry;
  /** Its bytes as they are now, or some of them. */
  read(range?: { from: number; to: number }): Promise<Uint8Array>;
  /** The sizes and the format pictures are made in, as the drive's settings say. */
  images: ImageSettings;
  /** What is wanted: what the page did not make, and the drive's settings allow. */
  want: { pictures: boolean; text: boolean };
}

/** What was made of it. */
export interface Derived {
  /** Smaller pictures of it, each its longest side at most a size of the drive's. */
  renditions?: { size: number; width: number; height: number; type: string; bytes: Uint8Array }[];
  /** A tiny picture of it, as a data: URL of a few hundred bytes. */
  placeholder?: string;
  /** What is written in it. */
  text?: string;
}

/** What a file is made into; undefined, or nothing, for none. */
export type Derive = (file: ToDerive) => Promise<Derived | undefined>;
