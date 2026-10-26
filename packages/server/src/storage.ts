// Where the bytes are. The browser sends them and reads them itself, at
// addresses a storage makes; the server only asks for those addresses, and
// finishes and deletes. A storage that cannot be reached from a browser, as
// a folder of the disk, serves those addresses itself (`serve`).

const MiB = 1024 * 1024;

/** How many bytes go in each part of an upload: S3 takes parts of 5 MiB at least, but for the last. */
export const PART_SIZE = 8 * MiB;

/** The most parts S3 puts together into one object. */
export const MAX_PARTS = 10_000;

/** The bytes of each part of a file of `size`: PART_SIZE, or more, in whole MiB, for a file that would need more than MAX_PARTS. */
export const partSizeOf = (size: number): number => Math.max(PART_SIZE, Math.ceil(size / MAX_PARTS / MiB) * MiB);

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
  /**
   * Uploads started before `before` and neither finished nor given up, taken away: a page closed halfway leaves its
   * parts, which cost space and are listed nowhere. How many there were. The server calls it now and then.
   */
  sweepUploads?(before: Date): Promise<number>;
  /** The requests to addresses of its own, for a storage the browser cannot reach; undefined for any other. */
  serve?(request: Request, path: string): Promise<Response | undefined>;
}

/** The parts of a file of `size` bytes: one for a small file, as a part of its own costs a request. */
export function partsOf(size: number): { number: number; from: number; to: number }[] {
  const parts = [];
  const each = partSizeOf(size);
  for (let from = 0, number = 1; from < size || number === 1; from += each, number++) parts.push({ number, from, to: Math.min(size, from + each) });
  return parts;
}

/** `Content-Disposition` for a download, with a name in any language; `inline` for a preview. */
export const attachment = (name: string, inline = false): string =>
  `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
