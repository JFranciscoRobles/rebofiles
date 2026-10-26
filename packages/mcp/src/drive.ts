// The routes of @rebofiles/server, asked as the person the assistant works
// for: every call goes through `identify` and `authorize` as theirs would, so
// the assistant may do what they may and nothing more. Its own few lines
// rather than the client of @rebofiles/react, which would bring React along.

import type { Activity, Comment, Entry, EntryId, FileEntry, FolderColor, FolderEntry } from '@rebofiles/core';

export interface DriveOptions {
  /** Where the routes are, as a whole address: `https://acme.com/api/files`. */
  base: string;
  /** Headers for every request to the server: what says who the assistant works for. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** A fetch of your own: the handler itself, for one in the same process. */
  fetch?: typeof fetch;
}

/** What the server refused, with its code and its message, for the assistant to be told. */
export class DriveRefusal extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DriveRefusal';
    this.status = status;
    this.code = code;
  }
}

export type Drive = ReturnType<typeof driveAt>;

export function driveAt(options: DriveOptions) {
  const base = options.base.replace(/\/$/, '');
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  // An address a storage on the disk makes is the server's own, so relative to it.
  const whole = (url: string) => new URL(url, `${base}/`).toString();

  async function ask<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...(await options.headers?.()) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const answer = await send(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const said = (await answer.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!answer.ok) throw new DriveRefusal(answer.status, said.error ?? 'server', said.message ?? `The server answered ${answer.status}.`);
    return said as T;
  }
  const one = async (method: string, path: string, body?: unknown) => (await ask<{ entry: Entry }>(method, path, body)).entry;
  const at = (id: EntryId) => `/entries/${encodeURIComponent(id)}`;

  return {
    list: (folder: EntryId | null) => ask<{ folder: FolderEntry | null; path: FolderEntry[]; entries: Entry[] }>('GET', `/entries${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`),
    entry: (id: EntryId) => ask<{ entry: Entry; path: FolderEntry[]; trashed: boolean }>('GET', at(id)),
    search: async (query: string, within?: EntryId, trashed?: boolean) => {
      const q = new URLSearchParams({ q: query });
      if (within) q.set('within', within);
      if (trashed) q.set('trashed', '1');
      return (await ask<{ entries: Entry[] }>('GET', `/search?${q}`)).entries;
    },
    /** What is written in a file, kept to find it by: what it wrote, as a page reads what it uploads. Not kept by a server without the route. */
    keepText: (file: FileEntry, text: string) => ask('PUT', `${at(file.id)}/text`, { version: file.versions[0].id, text }).catch(() => undefined),
    searchText: async (query: string) => (await ask<{ results: { entry: FileEntry; snippet: string }[] }>('GET', `/search/text?q=${encodeURIComponent(query)}`)).results,
    recent: async () => (await ask<{ entries: Entry[] }>('GET', '/recent')).entries,
    shared: async () => (await ask<{ entries: Entry[] }>('GET', '/shared')).entries,
    comments: async (id: EntryId) => (await ask<{ comments: Comment[] }>('GET', `${at(id)}/comments`)).comments,
    addComment: async (id: EntryId, text: string, replyTo?: string) => (await ask<{ comment: Comment }>('POST', `${at(id)}/comments`, { text, replyTo })).comment,
    activity: async (id: EntryId, limit: number) => (await ask<{ activity: Activity[] }>('GET', `${at(id)}/activity?limit=${limit}`)).activity,
    createFolder: (name: string, parent: EntryId | null) => one('POST', '/folders', { name, parent }) as Promise<FolderEntry>,
    rename: (id: EntryId, name: string) => one('PATCH', at(id), { name }),
    setColor: (id: EntryId, color: FolderColor | null) => one('PATCH', at(id), { color }),
    move: (id: EntryId, parent: EntryId | null) => one('PATCH', at(id), { parent }),
    moveToTrash: (id: EntryId) => one('POST', `${at(id)}/trash`),
    restore: (id: EntryId) => one('POST', `${at(id)}/restore`),
    restoreVersion: (id: EntryId, version: string) => one('POST', `${at(id)}/versions/${encodeURIComponent(version)}/restore`),

    /** The bytes of a file, or of one of its versions, read from where the server says. */
    async bytes(id: EntryId, version?: string): Promise<Uint8Array> {
      const { url } = await ask<{ url: string }>('GET', `${at(id)}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`);
      const answer = await send(whole(url));
      if (!answer.ok) throw new DriveRefusal(answer.status, 'download', `The file could not be read (${answer.status}).`);
      return new Uint8Array(await answer.arrayBuffer());
    },

    /** Up as the browser sends a file: each part to where it is told, with the type the server signed. */
    async upload(bytes: Uint8Array, type: string, to: { name: string; parent: EntryId | null } | { file: EntryId }): Promise<FileEntry> {
      const start = await ask<{ token: string; parts: { number: number; url: string; from: number; to: number }[] }>('POST', '/uploads', { ...to, type, size: bytes.length });
      const parts = [];
      try {
        for (const part of start.parts) {
          const answer = await send(whole(part.url), { method: 'PUT', headers: { 'content-type': type }, body: bytes.slice(part.from, part.to) as Uint8Array<ArrayBuffer> });
          if (!answer.ok) throw new DriveRefusal(answer.status, 'upload', `A part was refused (${answer.status}).`);
          parts.push({ number: part.number, etag: answer.headers.get('etag') ?? '' });
        }
      } catch (error) {
        await ask('POST', '/uploads/abort', { token: start.token }).catch(() => undefined);
        throw error;
      }
      return (await ask<{ entry: FileEntry }>('POST', '/uploads/finish', { token: start.token, parts })).entry;
    },
  };
}
