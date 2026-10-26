// What the page asks of the server, one function per route of
// @rebofiles/server. An upload goes as the server says: each part straight to
// where it was told (the bucket, or the server for a disk), a few at a time,
// with how much has gone so far. A part cut is tried again, after asking the
// server what arrived; and an upload left halfway is remembered, so the same
// file uploaded again goes on from where it was.

import type { DriveSettings, Entry, EntryId, FileEntry, FolderEntry, ImageSettings, PersonalSettings, Role } from '@rebofiles/core';
import { renditionsOf } from './images';

export interface ClientOptions {
  /** Where the routes are: `/api/files`. */
  base: string;
  /** Headers for every request to the server, such as a token of the session. Not sent to the bucket. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** For tests, or a fetch of your own. */
  fetch?: typeof fetch;
  /** How many parts go at once. */
  parallel?: number;
  /** How a part that fails is tried again: `attempts` times in a row (5), the first after `delay` milliseconds (1000), each wait twice the last. */
  retry?: { attempts?: number; delay?: number };
  /**
   * Where an upload halfway is remembered, so the same file uploaded again to the same place goes on from where it
   * was: the page's localStorage unless said, and always while the page is open. null for only while it is open.
   */
  remember?: UploadMemory | null;
}

/** Tokens of uploads not finished, by the file and where it goes. */
export interface UploadMemory {
  get(key: string): string | null | undefined;
  set(key: string, token: string): void;
  delete(key: string): void;
}

const REMEMBERED = 'rebofiles:upload:';

/** The page's localStorage, when there is one that may be used; a private window or a blocked site has none. */
const localMemory = (): UploadMemory | null => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    return {
      get: (key) => storage.getItem(REMEMBERED + key),
      set: (key, token) => {
        try {
          storage.setItem(REMEMBERED + key, token);
        } catch {}
      },
      delete: (key) => storage.removeItem(REMEMBERED + key),
    };
  } catch {
    return null;
  }
};

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
  /** Of a picture, the smaller ones to make of it in the page and send after it, as the drive's settings say. */
  images?: ImageSettings;
  /** Not a file: a smaller picture of a version of one. */
  rendition?: { file: EntryId; version: string; size: number; width: number; height: number };
}

/** The settings as the server says them for the one asking. */
export interface SettingsAnswer {
  /** The drive's. */
  drive: DriveSettings;
  /** Their own, over the drive's. */
  mine: PersonalSettings;
  /** The two together: what their drive is. */
  settings: DriveSettings;
  /** Whether they may change the drive's. */
  canConfigure: boolean;
  /** Whether the drive's were ever saved: until they are, they are the defaults, and an application's options come before them. */
  saved: boolean;
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
  const attempts = options.retry?.attempts ?? 5;
  const delay = options.retry?.delay ?? 1000;
  // While the page is open, in any case; and where it says, to outlive it.
  const kept = new Map<string, string>();
  const lasting = options.remember === undefined ? localMemory() : options.remember;
  const memory: UploadMemory = {
    get: (key) => kept.get(key) ?? lasting?.get(key),
    set: (key, token) => (kept.set(key, token), lasting?.set(key, token)),
    delete: (key) => (kept.delete(key), lasting?.delete(key)),
  };
  const pause = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((done, fail) => {
      const timer = setTimeout(done, ms);
      signal?.addEventListener('abort', () => (clearTimeout(timer), fail(new DOMException('The upload was stopped.', 'AbortError'))), { once: true });
    });

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

  const api = {
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
    /**
     * An address to read the file from, for a few minutes; `inline` to show it in the page rather than save it.
     * With `size`, of a picture: the smallest one made of it that shows it at that many pixels, or the original.
     */
    url: async (id: EntryId, options: { version?: string; inline?: boolean; size?: number } = {}) =>
      absolute(
        (
          await ask<{ url: string }>(
            'GET',
            `/entries/${encodeURIComponent(id)}/download${q({ version: options.version, inline: options.inline ? '1' : undefined, size: options.size ? String(options.size) : undefined })}`,
          )
        ).url,
      ),

    /** The drive's settings, the one asking's own, and whether they may change the drive's. */
    settings: () => ask<SettingsAnswer>('GET', '/settings'),
    /** The drive's settings changed, over what they were: for whoever may configure the drive. */
    saveSettings: async (settings: Partial<Omit<DriveSettings, 'images'>> & { images?: Partial<ImageSettings> }) => (await ask<{ drive: DriveSettings }>('PUT', '/settings', settings)).drive,
    /** One's own: the language and the theme; what is left out is the drive's. */
    saveMySettings: (mine: PersonalSettings) => ask<{ mine: PersonalSettings; settings: DriveSettings }>('PUT', '/settings/mine', mine),

    async upload(file: Blob & { name?: string; lastModified?: number }, options: UploadOptions = {}): Promise<FileEntry> {
      // A bucket signs the type of a file of one part, so each part goes with the type the server was told.
      const type = file.type || 'application/octet-stream';
      const name = file.name ?? 'file';
      const signal = options.signal;
      const key = JSON.stringify([base, options.rendition ?? options.file ?? options.parent ?? null, name, file.size, file.lastModified ?? null, type]);

      type Plan = { token: string; parts: Part[]; done: { number: number; etag: string }[] };
      const resume = (token: string) => ask<Plan>('POST', '/uploads/resume', { token }, signal);
      // The same file to the same place, left halfway: gone on with, when the server still has it.
      let plan: Plan | null = null;
      const remembered = memory.get(key);
      if (remembered) plan = await resume(remembered).catch(() => (memory.delete(key), null));
      if (!plan) {
        const asked = options.rendition ? { rendition: options.rendition, type, size: file.size } : { name, parent: options.parent ?? null, file: options.file, type, size: file.size };
        const start = await ask<{ token: string; parts: Part[] }>('POST', '/uploads', asked, signal);
        plan = { ...start, done: [] };
        memory.set(key, plan.token);
      }
      const { token } = plan;
      const several = plan.parts.length + plan.done.length > 1;

      const finished = new Map(plan.done.map((part) => [part.number, part.etag]));
      // What has gone of each part: those that arrived before, whole.
      const sent = new Map<number, number>();
      let before = file.size;
      for (const part of plan.parts) before -= part.to - part.from;
      const report = () => options.onProgress?.({ sent: before + [...sent.values()].reduce((a, b) => a + b, 0), size: file.size });
      report();

      let waiting = [...plan.parts];
      for (let failures = 0; waiting.length; ) {
        const queue = [...waiting];
        const worker = async () => {
          for (let part = queue.shift(); part; part = queue.shift()) {
            const { number } = part;
            try {
              const etag = await sendPart(part.url, file.slice(part.from, part.to, type), (n) => (sent.set(number, n), report()), signal);
              // A bucket that lets the page in but not its ETag: the parts arrived, and cannot be put together.
              if (!etag && several) throw new RequestError(0, 'no-etag', 'The bucket did not let the page read the ETag of a part. Its rule of origins has to expose ETag.');
              finished.set(number, etag);
              failures = 0;
            } catch (error) {
              // No more parts go once one has failed; those under way finish first.
              queue.length = 0;
              throw error;
            }
          }
        };
        const failed = (await Promise.allSettled(Array.from({ length: Math.min(parallel, queue.length) }, worker))).find((done) => done.status === 'rejected');
        if (!failed) break;
        const error = (failed as PromiseRejectedResult).reason as RequestError;
        // Stopped by the person: given up, and what arrived taken away. Not with the signal, which is what stopped it.
        if (signal?.aborted || error.name === 'AbortError') {
          memory.delete(key);
          await ask('POST', '/uploads/abort', { token }).catch(() => undefined);
          throw error;
        }
        // Cut, or its addresses out of date: what arrived stays, to go on with now, or when the file is uploaded again.
        if (error.code === 'no-etag' || ++failures > attempts) throw error;
        await pause(delay * 2 ** (failures - 1), signal);
        // Asked again what arrived, with addresses good from now.
        const again = await resume(token).catch((refused: RequestError) => {
          if (refused.status >= 400 && refused.status < 500) memory.delete(key);
          throw refused;
        });
        for (const part of again.done) finished.set(part.number, part.etag);
        before = file.size - again.parts.reduce((sum, part) => sum + part.to - part.from, 0);
        sent.clear();
        report();
        waiting = again.parts;
      }
      let entry = (await ask<{ entry: FileEntry }>('POST', '/uploads/finish', { token, parts: [...finished].map(([number, etag]) => ({ number, etag })) }, signal)).entry;
      memory.delete(key);
      // The smaller pictures after: the file is up whether or not they are, and is shown by the original until they are.
      if (options.images && !options.rendition) {
        const version = entry.versions[0].id;
        try {
          for (const made of await renditionsOf(file, options.images)) {
            entry = await api.upload(made.blob, { rendition: { file: entry.id, version, size: made.size, width: made.width, height: made.height }, signal });
          }
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }
      return entry;
    },
  };
  return api;
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
