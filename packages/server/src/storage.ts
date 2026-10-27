// Where the bytes are. The browser sends them and reads them itself, at
// addresses a storage makes; the server only asks for those addresses, and
// finishes and deletes. A storage that cannot be reached from a browser, as
// a folder of the disk, serves those addresses itself (`serve`).

import { MAX_PARTS, PART_SIZE, partSizeOf, partsOf } from '@rebofiles/core';

export { MAX_PARTS, PART_SIZE, partSizeOf, partsOf };

export interface UploadPart {
  number: number;
  /** Where to PUT the bytes of this part. */
  url: string;
  /** The bytes of the file this part is, `from` included and `to` not. */
  from: number;
  to: number;
}

export interface UploadPlan {
  parts: UploadPart[];
  /** What the storage needs to finish it, kept by the server meanwhile (in the upload's token). */
  state: string;
  /** False for a storage that puts the parts together by their numbers alone (Azure): the page need not read an ETag. */
  etags?: false;
}

export interface FinishedPart {
  number: number;
  /** The ETag header the PUT answered with. */
  etag: string;
}

/** An upload gone on with: the parts that arrived, and new addresses for the rest. */
export interface ResumePlan {
  done: FinishedPart[];
  /** The parts still to send, each at an address good from now. */
  parts: UploadPart[];
}

/** How long an address to download a file is good for, in seconds. */
export const READ_LIFE = 15 * 60;
/** The hour an address to show a file in the page is the same for; it is good for two, from the start of the first. */
export const SHOWN_HOUR = 60 * 60;

/**
 * The window an address to show a file is signed for: from the start of this hour to the end of the next, so the
 * address is the same all the hour and the browser takes what it already has instead of reading it again.
 */
export function shownWindow(now = Date.now()): { from: number; seconds: number; until: number } {
  const from = Math.floor(now / (SHOWN_HOUR * 1000)) * SHOWN_HOUR * 1000;
  return { from, seconds: 2 * SHOWN_HOUR, until: from + 2 * SHOWN_HOUR * 1000 };
}

/** What a storage says of an upload it no longer has, given up or past its life: it can only start again. */
export class UploadGone extends Error {}

export interface Storage {
  /** How the storage is shown to a person: `s3://acme-files`, `disk:./storage`. */
  readonly label: string;
  /** Addresses to send `size` bytes of type `type` to, to be kept under `key`. `base` is where the server's routes are. */
  startUpload(key: string, type: string, size: number, base: string): Promise<UploadPlan>;
  /** The upload made whole; refused when what arrived is not the size it said. */
  finishUpload(key: string, state: string, parts: FinishedPart[], size: number): Promise<void>;
  /**
   * What of an upload has arrived, and addresses good from now for the rest: to go on after a cut, or after the
   * addresses of the start ran out. Throws `UploadGone` when it has no such upload. Without it, an upload cut
   * starts again.
   */
  resumeUpload?(key: string, state: string, size: number, base: string): Promise<ResumePlan>;
  /** An upload given up: whatever of it arrived taken away. Only for a key no version points to. */
  abortUpload(key: string, state: string, size: number): Promise<void>;
  /**
   * An address to read the bytes from, as an attachment named `name`, good for READ_LIFE; or, `inline`, to show them
   * in the page, the same address for the hour of `shownWindow` and kept by the browser as long.
   */
  downloadUrl(key: string, name: string, type: string, base: string, inline?: boolean): Promise<string>;
  remove(keys: string[]): Promise<void>;
  /**
   * The bytes kept under `key`, from `from` to `to` (not included), or all of them: what the server's `inspect` reads of
   * a file once it arrived. Without it, there is no `inspect`.
   */
  read?(key: string, range?: { from: number; to: number }): Promise<Uint8Array>;
  /** Bytes put under `key` by the server itself: the pictures and what it makes of a file (`derive`). Without it, nothing is made. */
  write?(key: string, bytes: Uint8Array, type: string): Promise<void>;
  /**
   * Uploads started before `before` and neither finished nor given up, taken away: a page closed halfway leaves its
   * parts, which cost space and are listed nowhere. How many there were. The server calls it now and then.
   */
  sweepUploads?(before: Date): Promise<number>;
  /**
   * A part of an upload in parts made of the same bytes of what is kept under `from`, in the storage, without them
   * passing through the server or the page: S3's UploadPartCopy, a copy on the disk. For a new version whose parts are
   * those of the one before but some. Without it, every part is sent.
   */
  copyPart?(from: string, to: string, state: string, part: { number: number; from: number; to: number }): Promise<void>;
  /** The requests to addresses of its own, for a storage the browser cannot reach; undefined for any other. */
  serve?(request: Request, path: string): Promise<Response | undefined>;
}

/** `Content-Disposition` for a download, with a name in any language; `inline` for a preview. */
export const attachment = (name: string, inline = false): string =>
  `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
