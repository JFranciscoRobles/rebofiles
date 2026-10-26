// The routes of a drive, as a function from a Request to a Response: what a
// Next.js route handler, Bun, Deno or a Worker takes, and `nodeHandler` makes
// it one for `node:http`. The bytes do not pass through here (but for a
// storage on the disk): the browser is given addresses to send them to and
// read them from, and the server keeps the entries.
//
//   GET    /entries?folder=…              what is in a folder (none: the top), and where it is
//   GET    /entries/:id                   one entry, and where it is
//   GET    /recent                        the files changed last
//   GET    /trash                         what is in the trash
//   GET    /search?q=…&within=…&trashed=1 found by name
//   POST   /folders                       { name, parent }
//   POST   /uploads                       { name, parent, type, size }, or { file, type, size } for a new version: where to send the parts
//   POST   /uploads/finish                { token, parts: [{ number, etag }] }: the file, once its bytes are there
//   POST   /uploads/abort                 { token }: an upload given up, and what of it arrived taken away
//   PATCH  /entries/:id                   { name } or { parent }, with { ifTaken: 'keep-both' } to add "(2)"
//   POST   /entries/:id/trash             into the trash
//   POST   /entries/:id/restore           out of it
//   DELETE /entries/:id                   gone for good, from the trash
//   POST   /trash/empty
//   GET    /entries/:id/download?version=&inline=1  an address to read it from, or to show it in the page
//   POST   /entries/:id/versions/:v/restore
//   GET    /info                          where the bytes are, as a person reads it
//
// Every one asks `identify` who is asking and `authorize` whether they may.

import { randomUUID } from 'node:crypto';
import * as core from '@rebofiles/core';
import type { Context, Drive, Entry, EntryId } from '@rebofiles/core';
import type { MetadataStore } from './metadata';
import { Refused, answerTo } from './refused';
import type { FinishedPart, Storage } from './storage';
import { openToken, sealToken } from './tokens';

export type Action = 'list' | 'read' | 'create' | 'upload' | 'rename' | 'move' | 'trash' | 'restore' | 'delete' | 'download';

export interface User {
  id: string;
}

export interface DriveServerOptions {
  storage: Storage;
  metadata: MetadataStore;
  /** Who is asking, from the session of the application; null for no one, answered 401. */
  identify(request: Request): User | null | Promise<User | null>;
  /**
   * Whether `user` may do `action` to `entry`; null is the top of the drive. Asked
   * on every request: for 'create' and 'upload' with the folder they go into, for
   * 'move' with the entry and then with the folder it goes to, for 'list' with the
   * folder and then with each entry in it, as 'read'.
   */
  authorize(user: User, action: Action, entry: Entry | null, drive: Drive): boolean | Promise<boolean>;
  /** What upload tokens are signed with: long, random, the same in every process. */
  secret: string;
  /** The path the routes are under: `/api/files`. */
  base?: string;
  /** The largest file taken, in bytes; 5 GiB unless said. */
  maxSize?: number;
  now?: () => Date;
  newId?: () => string;
}

/** For a demo on one's own machine: everyone signed in as `who`, and everyone may do everything. Never on a site. */
export const everyone = (who = 'me') => ({ identify: () => ({ id: who }), authorize: () => true });

interface Pending {
  key: string;
  versionId: string;
  state: string;
  size: number;
  type: string;
  user: string;
  /** A new file: where and with what name. */
  file?: { id: EntryId; name: string; parent: EntryId | null };
  /** A new version of this one. */
  of?: EntryId;
}

/** An upload left halfway is good for this long. */
const UPLOAD_LIFE = 24 * 60 * 60;
const MAX_BODY = 1_000_000;

export function createDriveHandler(options: DriveServerOptions): (request: Request) => Promise<Response> {
  const base = (options.base ?? '').replace(/\/$/, '');
  const maxSize = options.maxSize ?? 5 * 1024 ** 3;
  const newId = options.newId ?? randomUUID;
  const now = () => (options.now?.() ?? new Date()).toISOString();
  // Changes go one at a time, each on the drive the last one left; reads take the drive as it is.
  let queue: Promise<unknown> = Promise.resolve();
  const change = <T>(work: (drive: Drive) => Promise<{ drive: Drive; answer: T }>): Promise<T> => {
    const step = async () => {
      const before = await options.metadata.load();
      const { drive, answer } = await work(before);
      if (drive !== before) await options.metadata.save(core.changes(before, drive));
      return answer;
    };
    // In order here, and under the store's lock when it has one, for the other processes on the same store.
    const run = queue.then(() => (options.metadata.lock ? options.metadata.lock(step) : step()));
    queue = run.catch(() => undefined);
    return run;
  };

  const allow = async (user: User, action: Action, entry: Entry | null, drive: Drive) => {
    if (!(await options.authorize(user, action, entry, drive))) throw new Refused(403, 'forbidden', 'You may not do that here.');
  };
  const readable = async (user: User, entries: Entry[], drive: Drive) => {
    const seen = await Promise.all(entries.map((entry) => options.authorize(user, 'read', entry, drive)));
    return entries.filter((_, i) => seen[i]);
  };
  const folderOf = (drive: Drive, id: string | null | undefined): Entry | null => (id ? core.getFolder(drive, id) : null);

  return async (request) => {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(base)) return new Response('Not here.', { status: 404 });
      const path = url.pathname.slice(base.length) || '/';
      const own = await options.storage.serve?.(request, path);
      if (own) return own;

      const user = await options.identify(request);
      if (!user) throw new Refused(401, 'signed-out', 'Sign in first.');
      const context = (): Context => ({ by: user.id, at: now() });
      const body = async <T>(): Promise<T> => {
        if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) throw new Refused(413, 'too-large', 'Too much to read.');
        try {
          return (await request.json()) as T;
        } catch {
          throw new Refused(400, 'bad-body', 'The body is not JSON.');
        }
      };
      const route = `${request.method} ${path.replace(/^\/entries\/[^/]+/, '/entries/:id').replace(/\/versions\/[^/]+/, '/versions/:v')}`;
      const id = decodeURIComponent(/^\/entries\/([^/]+)/.exec(path)?.[1] ?? '');
      const versionId = decodeURIComponent(/\/versions\/([^/]+)/.exec(path)?.[1] ?? '');

      switch (route) {
        case 'GET /entries': {
          const drive = await options.metadata.load();
          const folder = folderOf(drive, url.searchParams.get('folder'));
          await allow(user, 'list', folder, drive);
          if (folder && core.isTrashed(drive, folder.id)) throw new Refused(409, 'in-trash', 'That folder is in the trash.');
          return Response.json({
            folder,
            path: folder ? [...core.ancestors(drive, folder.id), folder] : [],
            entries: await readable(user, core.children(drive, folder?.id ?? null), drive),
          });
        }
        case 'GET /entries/:id': {
          const drive = await options.metadata.load();
          const entry = core.getEntry(drive, id);
          await allow(user, 'read', entry, drive);
          return Response.json({ entry, path: core.ancestors(drive, id), trashed: core.isTrashed(drive, id) });
        }
        case 'GET /recent': {
          const drive = await options.metadata.load();
          return Response.json({ entries: await readable(user, core.recent(drive), drive) });
        }
        case 'GET /trash': {
          const drive = await options.metadata.load();
          return Response.json({ entries: await readable(user, core.trash(drive), drive) });
        }
        case 'GET /search': {
          const drive = await options.metadata.load();
          const within = url.searchParams.get('within') || undefined;
          const found = core.search(drive, url.searchParams.get('q') ?? '', { within, trashed: url.searchParams.get('trashed') === '1', limit: 200 });
          return Response.json({ entries: await readable(user, found, drive) });
        }
        case 'GET /info':
          return Response.json({ storage: options.storage.label, maxSize });

        case 'POST /folders': {
          const asked = await body<{ name: string; parent?: EntryId | null }>();
          return Response.json(
            await change(async (drive) => {
              await allow(user, 'create', folderOf(drive, asked.parent), drive);
              const folderId = newId();
              const next = core.createFolder(drive, { id: folderId, name: String(asked.name ?? ''), parent: asked.parent ?? null }, context());
              return { drive: next, answer: { entry: core.getEntry(next, folderId) } };
            }),
          );
        }

        case 'POST /uploads': {
          const asked = await body<{ name?: string; parent?: EntryId | null; file?: EntryId; type?: string; size: number }>();
          const size = Number(asked.size);
          if (!Number.isSafeInteger(size) || size < 0) throw new Refused(400, 'bad-size', 'Say the size of the file, in bytes.');
          if (size > maxSize) throw new Refused(413, 'too-large', `Files up to ${maxSize} bytes.`);
          const type = /^[\w.+-]+\/[\w.+-]+$/.test(asked.type ?? '') ? asked.type! : 'application/octet-stream';
          const drive = await options.metadata.load();
          let pending: Omit<Pending, 'key' | 'state'>;
          const versionId = newId();
          if (asked.file) {
            const file = core.getFile(drive, asked.file);
            await allow(user, 'upload', file, drive);
            if (core.isTrashed(drive, file.id)) throw new Refused(409, 'in-trash', `${file.name} is in the trash.`);
            pending = { versionId, size, type, user: user.id, of: file.id };
          } else {
            const name = String(asked.name ?? '');
            const problem = core.nameProblem(name);
            if (problem) throw new Refused(400, 'invalid-name', `"${name}" cannot be a name (${problem}).`);
            const parent = folderOf(drive, asked.parent);
            await allow(user, 'upload', parent, drive);
            if (parent && core.isTrashed(drive, parent.id)) throw new Refused(409, 'in-trash', 'That folder is in the trash.');
            pending = { versionId, size, type, user: user.id, file: { id: newId(), name, parent: parent?.id ?? null } };
          }
          const key = `${pending.of ?? pending.file!.id}/${versionId}`;
          const plan = await options.storage.startUpload(key, type, size, base);
          return Response.json({ token: sealToken(options.secret, { ...pending, key, state: plan.state } satisfies Pending, UPLOAD_LIFE), parts: plan.parts });
        }

        case 'POST /uploads/finish': {
          const asked = await body<{ token: string; parts: FinishedPart[] }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          const parts = Array.isArray(asked.parts) ? asked.parts.map((part) => ({ number: Number(part.number), etag: String(part.etag) })) : [];
          try {
            await options.storage.finishUpload(pending.key, pending.state, parts, pending.size);
          } catch (error) {
            // An upload that cannot be finished is given up, so its parts do not wait in the bucket for a lifecycle rule.
            await options.storage.abortUpload(pending.key, pending.state, pending.size).catch(() => undefined);
            throw error;
          }
          const version = { id: pending.versionId, key: pending.key, size: pending.size };
          return Response.json(
            await change(async (drive) => {
              // Asked again: what was allowed when it started may not be now.
              if (pending.of) {
                await allow(user, 'upload', core.getEntry(drive, pending.of), drive);
                const next = core.addVersion(drive, pending.of, version, context());
                return { drive: next, answer: { entry: core.getEntry(next, pending.of) } };
              }
              const file = pending.file!;
              await allow(user, 'upload', folderOf(drive, file.parent), drive);
              const next = core.addFile(drive, { ...file, type: pending.type, version }, context());
              return { drive: next, answer: { entry: core.getEntry(next, file.id) } };
            }),
          );
        }

        case 'POST /uploads/abort': {
          const asked = await body<{ token: string }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          // A token stays good after its upload is finished: the bytes of a version that is kept are not taken away.
          const drive = await options.metadata.load();
          const kept = [...drive.entries.values()].some((entry) => entry.kind === 'file' && entry.versions.some((v) => v.key === pending.key));
          if (!kept) await options.storage.abortUpload(pending.key, pending.state, pending.size);
          return Response.json({ aborted: !kept });
        }

        case 'PATCH /entries/:id': {
          const asked = await body<{ name?: string; parent?: EntryId | null; ifTaken?: 'refuse' | 'keep-both' }>();
          const ifTaken = asked.ifTaken === 'keep-both' ? 'keep-both' : 'refuse';
          return Response.json(
            await change(async (drive) => {
              const entry = core.getEntry(drive, id);
              let next = drive;
              if (asked.parent !== undefined) {
                await allow(user, 'move', entry, drive);
                await allow(user, 'create', folderOf(drive, asked.parent), drive);
                next = core.move(next, id, asked.parent, context(), { ifTaken });
              }
              if (asked.name !== undefined) {
                await allow(user, 'rename', entry, drive);
                next = core.rename(next, id, String(asked.name), context(), { ifTaken });
              }
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );
        }

        case 'POST /entries/:id/trash':
        case 'POST /entries/:id/restore': {
          const action = route.endsWith('trash') ? 'trash' : 'restore';
          return Response.json(
            await change(async (drive) => {
              await allow(user, action, core.getEntry(drive, id), drive);
              const next = action === 'trash' ? core.moveToTrash(drive, id, context()) : core.restore(drive, id, context());
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );
        }

        case 'DELETE /entries/:id':
        case 'POST /trash/empty': {
          const gone = await change(async (drive) => {
            if (id) {
              for (const entry of core.subtree(drive, id)) await allow(user, 'delete', entry, drive);
              const removed = core.deleteForever(drive, id);
              return { drive: removed.drive, answer: removed };
            }
            for (const entry of core.trash(drive)) for (const inside of core.subtree(drive, entry.id)) await allow(user, 'delete', inside, drive);
            const removed = core.emptyTrash(drive);
            return { drive: removed.drive, answer: removed };
          });
          // The entries are gone first: bytes left behind by a failure here cost space, not a file that points nowhere.
          await options.storage.remove(gone.keys);
          return Response.json({ removed: gone.removed });
        }

        case 'GET /entries/:id/download': {
          const drive = await options.metadata.load();
          const file = core.getFile(drive, id);
          await allow(user, 'download', file, drive);
          const wanted = url.searchParams.get('version');
          const version = wanted ? file.versions.find((v) => v.id === wanted) : file.versions[0];
          if (!version) throw new Refused(404, 'no-version', `${file.name} has no version ${wanted}.`);
          return Response.json({ url: await options.storage.downloadUrl(version.key, file.name, file.type, base, url.searchParams.get('inline') === '1') });
        }

        case 'POST /entries/:id/versions/:v/restore':
          return Response.json(
            await change(async (drive) => {
              await allow(user, 'upload', core.getEntry(drive, id), drive);
              const next = core.restoreVersion(drive, id, versionId, newId(), context());
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );
      }
      return Response.json({ error: 'no-route', message: `No ${request.method} ${path}.` }, { status: 404 });
    } catch (error) {
      return answerTo(error);
    }
  };
}
