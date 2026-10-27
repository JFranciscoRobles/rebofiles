// A drive kept in the page, with no server: the same client as
// `createDriveClient`, answering from core and keeping the bytes as Blobs.
// For a demo, a story, a test, or trying the interface before the backend is
// there. Nothing outlives the page.

import * as core from '@rebofiles/core';
import type { Context, Drive, DriveErrorCode, Entry, EntryId, FileEntry, FolderEntry } from '@rebofiles/core';
import { type DriveClient, type DriveEvent, RequestError, type UploadOptions } from './client';
import { placeholderOf, renditionsOf } from './images';

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
  /** What My files shows at the top, as the server's option says: the user's own (the default), or everything there. */
  top?: 'own' | 'everyone';
  /** The drive's settings to start with; the user may change them, as one who may configure the drive. */
  settings?: Partial<core.DriveSettings>;
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
  'invalid-share': 400,
  'invalid-settings': 400,
  'invalid-color': 400,
  'invalid-field': 400,
  'invalid-comment': 400,
  'on-hold': 409,
  retained: 409,
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
  const lines: core.Activity[] = [];
  const said = new Map<string, core.Comment>();
  // Those watching, told of every change as the server tells them: where it was, and what changed.
  const watchers = new Set<(event: DriveEvent) => void>();
  const tell = (before: Drive, after: Drive, by: string) => {
    if (!watchers.size || before === after) return;
    const { put, removed } = core.changes(before, after);
    const folders = new Set<EntryId | null>();
    for (const entry of put) folders.add(entry.parent).add(before.entries.get(entry.id)?.parent ?? entry.parent);
    for (const id of removed) folders.add(before.entries.get(id)?.parent ?? null);
    const event: DriveEvent = { by, at: context().at, folders: [...folders], entries: put.map((entry) => entry.id) };
    // After the change is answered, as a server's comes.
    setTimeout(() => {
      for (const watcher of watchers) watcher(event);
    });
  };
  const change = <T>(work: (current: Drive) => { drive: Drive; answer: T }, by = user) =>
    run(() => {
      const done = work(drive);
      if (done.drive !== drive) lines.push(...core.activityOf(drive, done.drive, by, context().at));
      tell(drive, done.drive, by);
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

  let settings = core.readDriveSettings(options.settings ?? {});
  let saved = options.settings !== undefined;
  let mine: core.PersonalSettings = {};
  let seenShared: string | undefined;
  let starred: EntryId[] = [];
  const texts = new Map<EntryId, { version: string; text: string }>();

  const client: DriveClient = {
    watch(onChange, how = {}) {
      watchers.add(onChange);
      how.onState?.(true);
      return () => watchers.delete(onChange);
    },
    settings: async () => ({ drive: settings, mine, settings: core.settingsFor(settings, mine), canConfigure: true, saved, you: user }),
    saveSettings: (given) =>
      run(() => {
        saved = true;
        return (settings = core.readDriveSettings(given, settings));
      }),
    saveMySettings: (given) =>
      run(() => {
        mine = core.readPersonalSettings(given);
        return { mine, settings: core.settingsFor(settings, mine) };
      }),
    list: (folder) =>
      run(() => {
        const found = folder ? core.getFolder(drive, folder) : null;
        const inside = core.children(drive, folder);
        const entries = found || options.top === 'everyone' ? inside : inside.filter((entry) => entry.owner === user);
        return { folder: found, path: found ? [...core.ancestors(drive, found.id), found] : [], entries };
      }),
    entry: (entryId) => run(() => ({ entry: core.getEntry(drive, entryId), path: core.ancestors(drive, entryId), trashed: core.isTrashed(drive, entryId) })),
    recent: () => run(() => core.recent(drive)),
    trash: () => run(() => core.trash(drive, options.top === 'everyone' ? undefined : user)),
    setFields: (entryId, fields) => change((current) => one(core.setFields(current, entryId, fields, context()), entryId)),
    withField: (name, value) => run(() => [...drive.entries.values()].filter((entry) => entry.fields?.[name] === value && !core.isTrashed(drive, entry.id))),
    adminUsage: async () => {
      const people = core.usageByOwner(drive);
      const total = people.reduce((sum, one) => ({ files: sum.files + one.files, folders: sum.folders + one.folders, bytes: sum.bytes + one.bytes }), { files: 0, folders: 0, bytes: 0 });
      return { people, total, quota: settings.quota };
    },
    adminActivity: async (limit = 100) => lines.slice(-limit).reverse(),
    // One person alone: nobody shares with them nor names them.
    notifications: async () => ({ notifications: [], unseen: 0 }),
    sawNotifications: async () => undefined,
    starred: () => run(() => starred.flatMap((one) => (drive.entries.has(one) && !core.isTrashed(drive, one) ? [drive.entries.get(one)!] : []))),
    star: (entryId, on = true) =>
      run(() => {
        core.getEntry(drive, entryId);
        starred = on ? [entryId, ...starred.filter((one) => one !== entryId)] : starred.filter((one) => one !== entryId);
        return on;
      }),
    shared: () => run(() => core.sharedWith(drive, user)),
    searchText: async (query, limit = 50) => {
      const found: { entry: FileEntry; snippet: string }[] = [];
      for (const [entryId, kept] of texts) {
        const entry = drive.entries.get(entryId);
        if (entry?.kind !== 'file' || entry.versions[0].id !== kept.version || core.isTrashed(drive, entryId)) continue;
        const match = core.textMatch(kept.text, query);
        if (match) found.push({ entry, snippet: match.snippet });
      }
      return found.slice(0, limit);
    },
    activity: async (entryId, limit = 50) => core.activityFor(lines, entryId).reverse().slice(0, limit),
    sharedNew: async () => core.sharedSince(drive, user, seenShared).length,
    sawShared: async () => void (seenShared = context().at),
    search: (query, found = {}) => run(() => core.search(drive, query, { within: found.within, trashed: found.trashed, limit: 200 })),
    info: async () => ({ storage: options.label ?? 'memory', maxSize: Number.MAX_SAFE_INTEGER }),

    createFolder: (name, parent) =>
      change((current) => {
        const folderId = id();
        const next = core.createFolder(current, { id: folderId, name, parent }, context());
        return { drive: next, answer: core.getFolder(next, folderId) as FolderEntry };
      }),
    setColor: (entryId, color) => change((current) => one(core.setColor(current, entryId, color), entryId)),
    rename: (entryId, name, ifTaken) => change((current) => one(core.rename(current, entryId, name, context(), { ifTaken }), entryId)),
    move: (entryId, parent, ifTaken) => change((current) => one(core.move(current, entryId, parent, context(), { ifTaken }), entryId)),
    moveToTrash: (entryId) => change((current) => one(core.moveToTrash(current, entryId, context()), entryId)),
    restore: (entryId) => change((current) => one(core.restore(current, entryId, context()), entryId)),
    deleteForever: async (entryId) => {
      const removed = await change((current) => {
        const gone = core.deleteForever(current, entryId, { days: settings.retentionDays, now: context().at });
        return { drive: gone.drive, answer: gone };
      });
      forget(removed.keys);
      return removed.removed;
    },
    emptyTrash: async () => {
      const removed = await change((current) => {
        const gone = core.emptyTrash(current, options.top === 'everyone' ? undefined : user, { days: settings.retentionDays, now: context().at });
        return { drive: gone.drive, answer: gone };
      });
      forget(removed.keys);
      return removed.removed;
    },
    comments: async (entryId) => run(() => (core.getEntry(drive, entryId), core.threads([...said.values()].filter((c) => c.entry === entryId)))),
    addComment: (entryId, text, replyTo) =>
      run(() => {
        const entry = core.getEntry(drive, entryId);
        const to = replyTo ? said.get(replyTo) : undefined;
        if (replyTo && to?.entry !== entryId) throw new RequestError(404, 'no-comment', 'There is no such comment here.');
        const comment: core.Comment = { id: id(), entry: entryId, by: user, at: context().at, text: core.commentText(text), ...(to ? { replyTo: to.replyTo ?? to.id } : {}) };
        said.set(comment.id, comment);
        lines.push({ at: comment.at, by: user, action: 'commented', entry: entry.id, name: entry.name, kind: entry.kind, parent: entry.parent });
        return comment;
      }),
    editComment: (_entryId, commentId, text) =>
      run(() => {
        const comment = said.get(commentId);
        if (!comment) throw new RequestError(404, 'no-comment', 'There is no such comment here.');
        const next = { ...comment, text: core.commentText(text), edited: context().at };
        said.set(commentId, next);
        return next;
      }),
    resolveComment: (_entryId, commentId, resolved = true) =>
      run(() => {
        const comment = said.get(commentId);
        if (!comment) throw new RequestError(404, 'no-comment', 'There is no such comment here.');
        const { resolved: _, ...rest } = comment;
        const next: core.Comment = resolved ? { ...rest, resolved: { by: user, at: context().at } } : rest;
        said.set(commentId, next);
        return next;
      }),
    removeComment: async (_entryId, commentId) => {
      for (const comment of [...said.values()]) if (comment.id === commentId || comment.replyTo === commentId) said.delete(comment.id);
    },
    hold: (entryId, reason) => change((current) => one(core.setHold(current, entryId, { reason }, context()), entryId)),
    release: (entryId) => change((current) => one(core.setHold(current, entryId, null, context()), entryId)),
    exportPerson: async () =>
      run(() => {
        const owned = [...drive.entries.values()].filter((entry) => entry.owner === user);
        const tops = owned.filter((entry) => entry.parent === null || drive.entries.get(entry.parent)?.owner !== user);
        return {
          person: user,
          at: context().at,
          pack: core.packOf(
            drive,
            tops.map((entry) => entry.id),
            (entry) => entry.owner === user,
          ),
          entries: owned,
          shared: core.sharedWith(drive, user).map((entry) => entry.id),
          comments: [...said.values()].filter((c) => c.by === user),
          activity: lines.filter((a) => a.by === user).reverse(),
          settings: mine,
        };
      }),
    share: (entryId, who, role) => change((current) => one(core.share(current, entryId, who, role, context()), entryId)),
    unshare: (entryId, who) => change((current) => one(core.unshare(current, entryId, who), entryId)),
    // No server to sign it: a link's token is its id, and nothing outside the page reads it.
    // A password is not kept here: with no server, there is no one to ask for it.
    createLink: (entryId, days = 7, how = {}) =>
      change((current) => {
        const link = { id: id(), expires: new Date(Date.parse(context().at) + days * 86_400_000).toISOString(), locked: Boolean(how.password), uses: how.once ? 1 : undefined };
        const next = core.addLink(current, entryId, link, context());
        return { drive: next, answer: { entry: core.getEntry(next, entryId), token: link.id } };
      }),
    linkToken: async (_entryId, link) => link,
    removeLink: (entryId, link) => change((current) => one(core.removeLink(current, entryId, link), entryId)),
    restoreVersion: (entryId, version) => change((current) => one(core.restoreVersion(current, entryId, version, id(), context()), entryId) as { drive: Drive; answer: FileEntry }),
    pack: (ids) => run(() => core.packOf(drive, ids)),
    duplicates: async (hashes) => {
      const found: Record<string, Entry[]> = {};
      for (const [hash, files] of core.filesByHash(drive, hashes)) found[hash] = files;
      return found;
    },
    usage: async () => ({ used: core.usageOf(drive, user), quota: settings.quota }),
    urls: async (ids, found = {}) => {
      const urls: Record<EntryId, { url: string; expires: string }> = {};
      // Addresses of the page itself, good as long as it is open.
      for (const entryId of ids) if (drive.entries.get(entryId)?.kind === 'file') urls[entryId] = { url: await client.url(entryId, found), expires: '9999-12-31T00:00:00.000Z' };
      return urls;
    },
    url: (entryId, found = {}) =>
      run(() => {
        const file = core.getFile(drive, entryId);
        const version = found.version ? file.versions.find((v) => v.id === found.version) : file.versions[0];
        if (!version) throw new core.DriveError('no-version', `${file.name} has no version ${found.version}`);
        const smaller = found.size ? core.renditionFor(version, found.size) : undefined;
        const key = smaller?.key ?? version.key;
        let url = urls.get(key);
        if (!url) {
          const blob = blobs.get(key) ?? new Blob([], { type: file.type });
          url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: smaller?.type ?? file.type }));
          urls.set(key, url);
        }
        return url;
      }),

    async upload(file: Blob & { name?: string }, how: UploadOptions = {}): Promise<FileEntry> {
      // A smaller picture of a version, as the drive keeps the first page of a document it has drawn: beside it, not a file of its own.
      if (how.rendition) {
        const r = how.rendition;
        return run(() => {
          const version = core.getFile(drive, r.file).versions.find((v) => v.id === r.version);
          if (!version) throw new core.DriveError('not-found', `No version ${r.version}`);
          const key = `${r.file}/${version.id}@${r.size}`;
          blobs.set(key, file);
          drive = core.addRendition(drive, r.file, version.id, { size: r.size, width: r.width, height: r.height, key, type: file.type, bytes: file.size });
          return core.getFile(drive, r.file);
        });
      }
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
      const made = await change((current) => {
        const fileId = how.file ?? id();
        const key = `${fileId}/${versionId}`;
        blobs.set(key, file);
        const version = { id: versionId, key, size: file.size, ...(how.sha256 ? { sha256: how.sha256 } : {}) };
        const next = how.file
          ? core.addVersion(current, fileId, version, context())
          : core.addFile(current, { id: fileId, name, parent: how.parent ?? null, type: file.type || 'application/octet-stream', version }, context());
        return { drive: next, answer: core.getFile(next, fileId) };
      });
      // The smaller pictures, made in the page as the client of a server makes them, and kept beside.
      const smaller = how.images ? await (how.renditions ?? renditionsOf)(file, how.images).catch(() => []) : [];
      for (const r of smaller) {
        const key = `${made.id}/${versionId}@${r.size}`;
        blobs.set(key, r.blob);
        drive = core.addRendition(drive, made.id, versionId, { size: r.size, width: r.width, height: r.height, key, type: r.blob.type, bytes: r.blob.size });
      }
      const placeholder = how.images ? await placeholderOf(smaller[0]?.blob ?? file).catch(() => undefined) : undefined;
      if (placeholder) drive = core.setPlaceholder(drive, made.id, versionId, placeholder);
      const text = how.text ? await how.text(file, name).catch(() => undefined) : undefined;
      if (text?.trim()) texts.set(made.id, { version: versionId, text: text.slice(0, 100_000) });
      return smaller.length || placeholder ? core.getFile(drive, made.id) : made;
    },
  };

  // Defined, not assigned: assigning would copy the drive of this moment rather than the getter.
  Object.defineProperty(client, 'drive', { get: () => drive, enumerable: true });
  return Object.assign(client as DriveClient & { readonly drive: Drive }, {
    apply(work: (current: Drive, at: Context) => Drive, by: string) {
      const at = context(by);
      const next = work(drive, at);
      lines.push(...core.activityOf(drive, next, by, at.at));
      tell(drive, next, by);
      drive = next;
    },
  });
}

const one = (drive: Drive, entryId: EntryId): { drive: Drive; answer: Entry } => ({ drive, answer: core.getEntry(drive, entryId) });
