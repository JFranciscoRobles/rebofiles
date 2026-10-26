// What the page asks of the server, one function per route of
// @rebofiles/server. An upload goes as the server says: each part straight to
// where it was told (the bucket, or the server for a disk), a few at a time,
// with how much has gone so far.

import type { Entry, EntryId, FileEntry, FolderEntry, Role } from '@rebofiles/core';

export interface ClientOptions {
  /** Where the routes are: `/api/files`. */
  base: string;
  /** Headers for every request to the server, such as a token of the session. Not sent to the bucket. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** For tests, or a fetch of your own. */
  fetch?: typeof fetch;
  /** How many parts go at once. */
  parallel?: number;
}

/** What the server refused, with its code (`name-taken`, `forbidden`…) and the message it gave. */
export class RequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

export interface Listing {
  folder: FolderEntry | null;
  path: FolderEntry[];
  entries: Entry[];
}

export interface UploadProgress {
  sent: number;
  size: number;
}

export interface UploadOptions {
  /** The folder it goes into; null or left out for the top. */
  parent?: EntryId | null;
  /** A new version of this file, instead of a new file. */
  file?: EntryId;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

interface Part {
  number: number;
  url: string;
  from: number;
  to: number;
}

export type DriveClient = ReturnType<typeof createDriveClient>;

export function createDriveClient(options: ClientOptions) {
  const base = options.base.replace(/\/$/, '');
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const parallel = options.parallel ?? 3;

  async function ask<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { ...(await options.headers?.()) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const answer = await send(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
    const said = (await answer.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!answer.ok) throw new RequestError(answer.status, said.error ?? 'server', said.message ?? `The server answered ${answer.status}.`);
    return said as T;
  }
  const one = async (method: string, path: string, body?: unknown) => (await ask<{ entry: Entry }>(method, path, body)).entry;
  const q = (values: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(values)) if (value) query.set(name, value);
    const text = query.toString();
    return text ? `?${text}` : '';
  };
  /**
   * An address the server made of its own (a storage on the disk) is relative: to `base` when that is a whole
   * address, as on a server or in a test, else to the page. One of a bucket is whole already.
   */
  const absolute = (url: string) => {
    if (/^https?:/.test(url)) return url;
    if (/^https?:/.test(base)) return new URL(url, base).toString();
    return typeof location === 'undefined' ? url : new URL(url, location.href).toString();
  };

  /** One part, with XMLHttpRequest where there is one, as only it says how much of a body has gone. */
  function sendPart(url: string, bytes: Blob, onSent: (sent: number) => void, signal?: AbortSignal): Promise<string> {
    if (typeof XMLHttpRequest === 'undefined' || options.fetch) {
      return send(absolute(url), { method: 'PUT', headers: bytes.type ? { 'content-type': bytes.type } : undefined, body: bytes, signal }).then((answer) => {
        if (!answer.ok) throw new RequestError(answer.status, 'upload', `A part was refused (${answer.status}).`);
        onSent(bytes.size);
        return answer.headers.get('etag') ?? '';
      });
    }
    return new Promise((done, fail) => {
      const request = new XMLHttpRequest();
      request.open('PUT', absolute(url));
      request.upload.onprogress = (event) => onSent(event.loaded);
      request.onload = () =>
        request.status < 300 ? (onSent(bytes.size), done(request.getResponseHeader('etag') ?? '')) : fail(new RequestError(request.status, 'upload', `A part was refused (${request.status}).`));
      // A bucket that does not let the page in answers nothing a page can read: most often its rule of origins.
      request.onerror = () => fail(new RequestError(0, 'upload', 'The part could not be sent. If the bytes go to a bucket, check that it lets this origin in.'));
      signal?.addEventListener('abort', () => request.abort());
      request.onabort = () => fail(new DOMException('The upload was stopped.', 'AbortError'));
      request.send(bytes);
    });
  }

  return {
    list: (folder: EntryId | null) => ask<Listing>('GET', `/entries${q({ folder: folder ?? undefined })}`),
    entry: (id: EntryId) => ask<{ entry: Entry; path: FolderEntry[]; trashed: boolean }>('GET', `/entries/${encodeURIComponent(id)}`),
    recent: async () => (await ask<{ entries: Entry[] }>('GET', '/recent')).entries,
    trash: async () => (await ask<{ entries: Entry[] }>('GET', '/trash')).entries,
    search: async (query: string, options: { within?: EntryId; trashed?: boolean } = {}) =>
      (await ask<{ entries: Entry[] }>('GET', `/search${q({ q: query, within: options.within, trashed: options.trashed ? '1' : undefined })}`)).entries,
    info: () => ask<{ storage: string; maxSize: number }>('GET', '/info'),
    /** What others shared with the one asking. */
    shared: async () => (await ask<{ entries: Entry[] }>('GET', '/shared')).entries,

    createFolder: (name: string, parent: EntryId | null) => one('POST', '/folders', { name, parent }) as Promise<FolderEntry>,
    rename: (id: EntryId, name: string, ifTaken?: 'keep-both') => one('PATCH', `/entries/${encodeURIComponent(id)}`, { name, ifTaken }),
    move: (id: EntryId, parent: EntryId | null, ifTaken?: 'keep-both') => one('PATCH', `/entries/${encodeURIComponent(id)}`, { parent, ifTaken }),
    moveToTrash: (id: EntryId) => one('POST', `/entries/${encodeURIComponent(id)}/trash`),
    restore: (id: EntryId) => one('POST', `/entries/${encodeURIComponent(id)}/restore`),
    deleteForever: async (id: EntryId) => (await ask<{ removed: EntryId[] }>('DELETE', `/entries/${encodeURIComponent(id)}`)).removed,
    emptyTrash: async () => (await ask<{ removed: EntryId[] }>('POST', '/trash/empty')).removed,
    /** Shared with someone, or with everyone signed in as `'*'`, or given another role. */
    share: (id: EntryId, user: string, role: Role) => one('POST', `/entries/${encodeURIComponent(id)}/shares`, { with: user, role }),
    /** No longer shared with them; anyone may leave what was shared with themselves. */
    unshare: (id: EntryId, user: string) => one('DELETE', `/entries/${encodeURIComponent(id)}/shares/${encodeURIComponent(user)}`),
    /** A link to read it without signing in, for `days`; the token is what goes in its address. */
    createLink: (id: EntryId, days?: number) => ask<{ entry: Entry; token: string }>('POST', `/entries/${encodeURIComponent(id)}/links`, { days }),
    /** The token of a link made before: the same every time. */
    linkToken: async (id: EntryId, link: string) => (await ask<{ token: string }>('GET', `/entries/${encodeURIComponent(id)}/links/${encodeURIComponent(link)}`)).token,
    removeLink: (id: EntryId, link: string) => one('DELETE', `/entries/${encodeURIComponent(id)}/links/${encodeURIComponent(link)}`),
    restoreVersion: (id: EntryId, version: string) => one('POST', `/entries/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/restore`) as Promise<FileEntry>,
    /** An address to read the file from, for a few minutes; `inline` to show it in the page rather than save it. */
    url: async (id: EntryId, options: { version?: string; inline?: boolean } = {}) =>
      absolute((await ask<{ url: string }>('GET', `/entries/${encodeURIComponent(id)}/download${q({ version: options.version, inline: options.inline ? '1' : undefined })}`)).url),

    async upload(file: Blob & { name?: string }, options: UploadOptions = {}): Promise<FileEntry> {
      // A bucket signs the type of a file of one part, so each part goes with the type the server was told.
      const type = file.type || 'application/octet-stream';
      const start = await ask<{ token: string; parts: Part[] }>(
        'POST',
        '/uploads',
        { name: file.name ?? 'file', parent: options.parent ?? null, file: options.file, type, size: file.size },
        options.signal,
      );
      const sent = new Map<number, number>();
      const report = () => options.onProgress?.({ sent: [...sent.values()].reduce((a, b) => a + b, 0), size: file.size });
      report();
      const finished: { number: number; etag: string }[] = [];
      const waiting = [...start.parts];
      const worker = async () => {
        for (let part = waiting.shift(); part; part = waiting.shift()) {
          const { number } = part;
          const etag = await sendPart(part.url, file.slice(part.from, part.to, type), (n) => (sent.set(number, n), report()), options.signal);
          // A bucket that lets the page in but not its ETag: the parts arrived, and cannot be put together.
          if (!etag && start.parts.length > 1) throw new RequestError(0, 'upload', 'The bucket did not let the page read the ETag of a part. Its rule of origins has to expose ETag.');
          finished.push({ number, etag });
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(parallel, start.parts.length) }, worker));
      } catch (error) {
        // Given up: no more parts go, and what arrived is taken away rather than left in the bucket. Not with the signal, which may be what stopped it.
        waiting.length = 0;
        await ask('POST', '/uploads/abort', { token: start.token }).catch(() => undefined);
        throw error;
      }
      return (await ask<{ entry: FileEntry }>('POST', '/uploads/finish', { token: start.token, parts: finished }, options.signal)).entry;
    },
  };
}

export interface LinkListing {
  /** What the link was made for. */
  root: Entry;
  /** The folder shown, the root itself or one inside it; for a link to a file, the file. */
  folder: Entry;
  /** From the root down to the folder. */
  path: Entry[];
  entries: Entry[];
}

/** What a link reads, for someone not signed in: its folders and an address to read each file from. */
export function createLinkClient(options: { base: string; token: string; fetch?: typeof fetch }) {
  const base = `${options.base.replace(/\/$/, '')}/links/${encodeURIComponent(options.token)}`;
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const ask = async <T>(path: string): Promise<T> => {
    const answer = await send(base + path);
    const said = (await answer.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!answer.ok) throw new RequestError(answer.status, said.error ?? 'server', said.message ?? `The server answered ${answer.status}.`);
    return said as T;
  };
  const absolute = (url: string) => (/^https?:/.test(url) ? url : new URL(url, /^https?:/.test(base) ? base : typeof location === 'undefined' ? 'http://localhost' : location.href).toString());
  return {
    list: (folder?: EntryId) => ask<LinkListing>(folder ? `?folder=${encodeURIComponent(folder)}` : ''),
    url: async (id: EntryId, how: { inline?: boolean } = {}) => absolute((await ask<{ url: string }>(`/download?id=${encodeURIComponent(id)}${how.inline ? '&inline=1' : ''}`)).url),
  };
}

export type LinkClient = ReturnType<typeof createLinkClient>;
