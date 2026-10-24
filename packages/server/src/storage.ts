// Where the bytes are. The browser sends them and reads them itself, at
// addresses a storage makes; the server only asks for those addresses, and
// finishes and deletes. A storage that cannot be reached from a browser, as
// a folder of the disk, serves those addresses itself (`serve`).

/** How many bytes go in each part of an upload: S3 takes parts of 5 MiB at least, but for the last. */
export const PART_SIZE = 8 * 1024 * 1024;

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

export interface Storage {
  /** How the storage is shown to a person: `s3://acme-files`, `disk:./storage`. */
  readonly label: string;
  /** Addresses to send `size` bytes of type `type` to, to be kept under `key`. `base` is where the server's routes are. */
  startUpload(key: string, type: string, size: number, base: string): Promise<UploadPlan>;
  /** The upload made whole; refused when what arrived is not the size it said. */
  finishUpload(key: string, state: string, parts: FinishedPart[], size: number): Promise<void>;
  /** An address to read the bytes from, as an attachment named `name`, or shown in the page when `inline`. */
  downloadUrl(key: string, name: string, type: string, base: string, inline?: boolean): Promise<string>;
  remove(keys: string[]): Promise<void>;
  /** The requests to addresses of its own, for a storage the browser cannot reach; undefined for any other. */
  serve?(request: Request, path: string): Promise<Response | undefined>;
}

/** The parts of a file of `size` bytes: one for a small file, as a part of its own costs a request. */
export function partsOf(size: number): { number: number; from: number; to: number }[] {
  const parts = [];
  for (let from = 0, number = 1; from < size || number === 1; from += PART_SIZE, number++) parts.push({ number, from, to: Math.min(size, from + PART_SIZE) });
  return parts;
}

/** `Content-Disposition` for a download, with a name in any language; `inline` for a preview. */
export const attachment = (name: string, inline = false): string =>
  `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
