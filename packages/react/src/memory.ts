// A drive kept in the page, with no server: the same client as
// `createDriveClient`, answering from core and keeping the bytes as Blobs.
// For a demo, a story, a test, or trying the interface before the backend is
// there. Nothing outlives the page.

import * as core from '@rebofiles/core';
import type { Context, Drive, DriveErrorCode, Entry, EntryId, FileEntry, FolderEntry } from '@rebofiles/core';
import { type DriveClient, RequestError, type UploadOptions } from './client';

export interface MemoryOptions {
  /** The drive to start with, made with core. */
  drive?: Drive;
  /** The bytes of its files, by their keys. A file whose key has none reads as empty. */
  blobs?: Map<string, Blob>;
  /** Who does what is done through the client. */
  user?: string;
  /** How the storage is shown: `memory` unless said. */
  label?: string;
  /** How long an upload takes to go, in milliseconds per step of 12%; 0 for at once. 180 unless said, as a real one is seen to move. */
  uploadStep?: number;
  now?: () => Date;
}

export type MemoryClient = DriveClient & {
  /** The drive as it is now. */
  readonly drive: Drive;
  /** A change made by someone other than the user, such as an assistant: what core returns becomes the drive. */
  apply(change: (drive: Drive, context: Context) => Drive, by: string): void;
};

const STATUS: Record<DriveErrorCode, number> = {
  'not-found': 404,
  'duplicate-id': 409,
  'invalid-name': 400,
  'name-taken': 409,
  'not-a-folder': 400,
  'not-a-file': 400,
  'into-itself': 400,
  'in-trash': 409,
  'not-in-trash': 409,
  'no-version': 404,
};

export function createMemoryClient(options: MemoryOptions = {}): MemoryClient {
  let drive = options.drive ?? core.emptyDrive();
  const blobs = options.blobs ?? new Map<string, Blob>();
  const urls = new Map<string, string>();
  const user = options.user ?? 'me';
  const step = options.uploadStep ?? 180;
  const context = (by = user): Context => ({ by, at: (options.now?.() ?? new Date()).toISOString() });
  const id = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  /** Errors of core said as the server says them, so the interface handles one kind. */
  const run = async <T>(work: () => T): Promise<T> => {
    try {
      return work();
    } catch (error) {
      if (error instanceof core.DriveError) throw new RequestError(STATUS[error.code], error.code, error.message);
      throw error;
    }
  };
  const change = <T>(work: (current: Drive) => { drive: Drive; answer: T }) =>
    run(() => {
      const done = work(drive);
      drive = done.drive;
      return done.answer;
    });
  const forget = (keys: string[]) => {
    for (const key of keys) {
      blobs.delete(key);
      const url = urls.get(key);
      if (url) URL.revokeObjectURL(url);
      urls.delete(key);
    }
  };
  const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((done, fail) => {
      const timer = setTimeout(done, ms);
      signal?.addEventListener('abort', () => (clearTimeout(timer), fail(new DOMException('The upload was stopped.', 'AbortError'))));
    });

  const client: DriveClient = {
    list: (folder) =>
      run(() => {
        const found = folder ? core.getFolder(drive, folder) : null;
        return { folder: found, path: found ? [...core.ancestors(drive, found.id), found] : [], entries: core.children(drive, folder) };
      }),
    entry: (entryId) => run(() => ({ entry: core.getEntry(drive, entryId), path: core.ancestors(drive, entryId), trashed: core.isTrashed(drive, entryId) })),
    recent: () => run(() => core.recent(drive)),
    trash: () => run(() => core.trash(drive)),
    search: (query, found = {}) => run(() => core.search(drive, query, { within: found.within, trashed: found.trashed, limit: 200 })),
    info: async () => ({ storage: options.label ?? 'memory', maxSize: Number.MAX_SAFE_INTEGER }),

    createFolder: (name, parent) =>
      change((current) => {
        const folderId = id();
        const next = core.createFolder(current, { id: folderId, name, parent }, context());
        return { drive: next, answer: core.getFolder(next, folderId) as FolderEntry };
      }),
    rename: (entryId, name, ifTaken) => change((current) => one(core.rename(current, entryId, name, context(), { ifTaken }), entryId)),
    move: (entryId, parent, ifTaken) => change((current) => one(core.move(current, entryId, parent, context(), { ifTaken }), entryId)),
    moveToTrash: (entryId) => change((current) => one(core.moveToTrash(current, entryId, context()), entryId)),
    restore: (entryId) => change((current) => one(core.restore(current, entryId, context()), entryId)),
    deleteForever: async (entryId) => {
      const removed = await change((current) => {
        const gone = core.deleteForever(current, entryId);
        return { drive: gone.drive, answer: gone };
      });
      forget(removed.keys);
      return removed.removed;
    },
    emptyTrash: async () => {
      const removed = await change((current) => {
        const gone = core.emptyTrash(current);
        return { drive: gone.drive, answer: gone };
      });
      forget(removed.keys);
      return removed.removed;
    },
    restoreVersion: (entryId, version) => change((current) => one(core.restoreVersion(current, entryId, version, id(), context()), entryId) as { drive: Drive; answer: FileEntry }),
    url: (entryId, found = {}) =>
      run(() => {
        const file = core.getFile(drive, entryId);
        const version = found.version ? file.versions.find((v) => v.id === found.version) : file.versions[0];
        if (!version) throw new core.DriveError('no-version', `${file.name} has no version ${found.version}`);
        let url = urls.get(version.key);
        if (!url) {
          const blob = blobs.get(version.key) ?? new Blob([], { type: file.type });
          url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: file.type }));
          urls.set(version.key, url);
        }
        return url;
      }),

    async upload(file: Blob & { name?: string }, how: UploadOptions = {}): Promise<FileEntry> {
      const name = file.name ?? 'file';
      // Refused before anything goes, as the server refuses a bad name or a folder in the trash.
      await run(() => {
        if (how.file) core.getFile(drive, how.file);
        else {
          const problem = core.nameProblem(name);
          if (problem) throw new core.DriveError('invalid-name', `"${name}" cannot be a name (${problem})`);
          if (how.parent) core.getFolder(drive, how.parent);
        }
      });
      for (let sent = 0; sent < 100 && step > 0; sent = Math.min(100, sent + 12)) {
        how.onProgress?.({ sent: Math.round((file.size * sent) / 100), size: file.size });
        await wait(step, how.signal);
      }
      how.onProgress?.({ sent: file.size, size: file.size });
      const versionId = id();
      return change((current) => {
        const fileId = how.file ?? id();
        const key = `${fileId}/${versionId}`;
        blobs.set(key, file);
        const version = { id: versionId, key, size: file.size };
        const next = how.file
          ? core.addVersion(current, fileId, version, context())
          : core.addFile(current, { id: fileId, name, parent: how.parent ?? null, type: file.type || 'application/octet-stream', version }, context());
        return { drive: next, answer: core.getFile(next, fileId) };
      });
    },
  };

  // Defined, not assigned: assigning would copy the drive of this moment rather than the getter.
  Object.defineProperty(client, 'drive', { get: () => drive, enumerable: true });
  return Object.assign(client as DriveClient & { readonly drive: Drive }, {
    apply(work: (current: Drive, at: Context) => Drive, by: string) {
      drive = work(drive, context(by));
    },
  });
}

const one = (drive: Drive, entryId: EntryId): { drive: Drive; answer: Entry } => ({ drive, answer: core.getEntry(drive, entryId) });
