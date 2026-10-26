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
//   POST   /uploads                       { name, parent, type, size }, or { file, type, size } for a new version: where to send the parts;
//                                         or { rendition: { file, version, size, width, height }, type, size }: a smaller picture of a version
//   POST   /uploads/finish                { token, parts: [{ number, etag }] }: the file, once its bytes are there
//   POST   /uploads/resume                { token }: an upload cut, gone on with: what arrived, and where to send the rest
//   POST   /uploads/abort                 { token }: an upload given up, and what of it arrived taken away
//   PATCH  /entries/:id                   { name } or { parent }, with { ifTaken: 'keep-both' } to add "(2)"
//   POST   /entries/:id/trash             into the trash
//   POST   /entries/:id/restore           out of it
//   DELETE /entries/:id                   gone for good, from the trash
//   POST   /trash/empty
//   GET    /entries/:id/download?version=&inline=1&size=  an address to read it from, or to show it in the page; with size, a smaller picture when there is one
//   POST   /entries/:id/versions/:v/restore
//   POST   /urls                          { ids, inline, size }: the addresses of many files at once, for a grid; until when each is good
//   GET    /info                          where the bytes are, as a person reads it
//   GET    /settings                      the drive's settings, the one asking's own, and whether they may change the drive's
//   PUT    /settings                      the drive's, for whoever may 'configure'
//   PUT    /settings/mine                 { language, theme }: one's own
//   GET    /shared                        what others shared with the one asking
//   POST   /entries/:id/shares            { with, role }: shared, or given another role
//   DELETE /entries/:id/shares/:with      no longer shared with them
//   POST   /entries/:id/links             { days }: a link to read it without signing in, and its address
//   GET    /entries/:id/links/:link       the address of a link again
//   DELETE /entries/:id/links/:link       taken back
//
// Every one asks `identify` who is asking and `authorize` whether they may,
// but for what a link reads, which asks neither: the link is the permission.
//
//   GET    /links/:token?folder=…         what the link reads, or a folder inside it
//   GET    /links/:token/download?id=…&inline=1

import { randomUUID } from 'node:crypto';
import * as core from '@rebofiles/core';
import type { Action, Context, Drive, Entry, EntryId, Role } from '@rebofiles/core';
import type { MetadataStore } from './metadata';
import { Refused, answerTo } from './refused';
import { type FinishedPart, READ_LIFE, type Storage, UploadGone, shownWindow } from './storage';
import { openToken, sealToken } from './tokens';

export type { Action } from '@rebofiles/core';

export interface User {
  id: string;
  /** May change the settings of the whole drive, with `byRoles`. */
  admin?: boolean;
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
  /**
   * What My files shows at the top of the drive: what the one asking owns (`'own'`, the default), with what others
   * share in Shared with me; or everything there they may read (`'everyone'`), for one drive of a whole team.
   */
  top?: 'own' | 'everyone';
  /** The largest file taken, in bytes; 5 GiB unless said. */
  maxSize?: number;
  /** The settings of the drive until someone who may 'configure' changes them: its language, theme, colour, and the sizes pictures are made in. */
  settings?: Partial<Omit<core.DriveSettings, 'images'>> & { images?: Partial<core.ImageSettings> };
  now?: () => Date;
  newId?: () => string;
}

/** For a demo on one's own machine: everyone signed in as `who`, and everyone may do everything. Never on a site. */
export const everyone = (who = 'me') => ({ identify: () => ({ id: who }), authorize: () => true });

/** What may be done at the top of the drive, which is everyone's own: look, and put things there. */
const AT_THE_TOP: Action[] = ['list', 'create', 'upload'];

/**
 * An `authorize` from what the drive says: its owner may do everything, those it is shared with what their role
 * allows, on it and on what is inside it. Yours may ask it and add rules of its own, as `isAdmin(user) || byRoles(…)`.
 */
export const byRoles = (user: User, action: Action, entry: Entry | null, drive: Drive): boolean =>
  action === 'configure' ? user.admin === true : entry === null ? AT_THE_TOP.includes(action) : core.allows(core.accessOf(drive, entry.id, user.id), action);

/** What a link's token holds: its id, and that it is one, so no other token of the server is taken for it. */
interface LinkToken {
  purpose: 'link';
  link: string;
}

/** The most days a link may last. */
const LINK_DAYS = 90;

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
  /** A smaller picture of a version of this one. */
  rendition?: { of: EntryId; version: string; size: number; width: number; height: number };
}

/** Where to read a file from, and until when. */
interface Address {
  url: string;
  /** ISO 8601. */
  expires: string;
  width?: number;
  height?: number;
}

/** How many files' addresses are asked for in one request: a page of a grid, and more. */
const URLS_AT_ONCE = 500;

/** An upload left halfway is good for this long. */
const UPLOAD_LIFE = 24 * 60 * 60;
const MAX_BODY = 1_000_000;

export function createDriveHandler(options: DriveServerOptions): (request: Request) => Promise<Response> {
  const base = (options.base ?? '').replace(/\/$/, '');
  const maxSize = options.maxSize ?? 5 * 1024 ** 3;
  const newId = options.newId ?? randomUUID;
  const now = () => (options.now?.() ?? new Date()).toISOString();
  // The drive as it was last loaded, and the revision of the store it was then: loaded again only once that changed,
  // by this process or another. The revision is read before the drive, so a change between the two only loads it again.
  let held: { revision: string; drive: Drive } | undefined;
  const load = async (): Promise<Drive> => {
    if (!options.metadata.revision) return options.metadata.load();
    const revision = await options.metadata.revision();
    if (held?.revision === revision) return held.drive;
    const drive = await options.metadata.load();
    held = { revision, drive };
    return drive;
  };

  // Changes go one at a time, each on the drive the last one left; reads take the drive as it is.
  let queue: Promise<unknown> = Promise.resolve();
  const change = <T>(work: (drive: Drive) => Promise<{ drive: Drive; answer: T }>): Promise<T> => {
    const step = async () => {
      const before = await load();
      const { drive, answer } = await work(before);
      if (drive !== before) {
        await options.metadata.save(core.changes(before, drive));
        // What was saved is what is held, under the lock that kept others out meanwhile: nothing to load for it.
        if (options.metadata.revision) held = { revision: await options.metadata.revision(), drive };
      }
      return answer;
    };
    // In order here, and under the store's lock when it has one, for the other processes on the same store.
    const run = queue.then(() => (options.metadata.lock ? options.metadata.lock(step) : step()));
    queue = run.catch(() => undefined);
    return run;
  };

  // Kept by the store when it can, else for as long as the process lasts.
  const ownSettings = new Map<string, unknown>();
  const getSetting = (name: string) => (options.metadata.getSetting ? options.metadata.getSetting(name) : Promise.resolve(ownSettings.get(name)));
  const setSetting = (name: string, value: unknown) => (options.metadata.setSetting ? options.metadata.setSetting(name, value) : (ownSettings.set(name, value), Promise.resolve()));
  /** The drive's settings: what was kept, over the defaults the server was given. */
  const driveSettings = async () => core.readDriveSettings(await getSetting('drive'), defaults);
  const defaults = core.readDriveSettings(options.settings ?? {});

  const allow = async (user: User, action: Action, entry: Entry | null, drive: Drive) => {
    if (!(await options.authorize(user, action, entry, drive))) throw new Refused(403, 'forbidden', 'You may not do that here.');
  };
  const readable = async (user: User, entries: Entry[], drive: Drive) => {
    const seen = await Promise.all(entries.map((entry) => options.authorize(user, 'read', entry, drive)));
    return entries.filter((_, i) => seen[i]);
  };
  const folderOf = (drive: Drive, id: string | null | undefined): Entry | null => (id ? core.getFolder(drive, id) : null);
  /**
   * Where to read a file from: its version, or the smaller picture that shows it at `size` when there is one, named as
   * what it is; and until when the address is good, as a storage of the server's makes it.
   */
  const addressOf = async (file: core.FileEntry, inline: boolean, size?: number, wanted?: string): Promise<Address> => {
    const version = wanted ? file.versions.find((v) => v.id === wanted) : file.versions[0];
    if (!version) throw new Refused(404, 'no-version', `${file.name} has no version ${wanted}.`);
    const expires = new Date(inline ? shownWindow().until : Date.now() + READ_LIFE * 1000).toISOString();
    const smaller = size === undefined ? undefined : core.renditionFor(version, size);
    if (smaller) {
      const name = smaller.type === file.type ? file.name : `${core.splitName(file.name).base}.${smaller.type === 'image/jpeg' ? 'jpg' : smaller.type.split('/')[1]}`;
      return { url: await options.storage.downloadUrl(smaller.key, name, smaller.type, base, inline), expires, width: smaller.width, height: smaller.height };
    }
    return { url: await options.storage.downloadUrl(version.key, file.name, file.type, base, inline), expires };
  };
  /** The folders down to an entry that the one asking may read: from where it was shared with them, not above. */
  const pathOf = async (user: User, drive: Drive, folders: Entry[]) => readable(user, folders, drive);
  /** The same address for a link every time, as its token is sealed until the link expires. */
  const linkToken = (link: { id: string; expires: string }) => sealToken(options.secret, { purpose: 'link', link: link.id } satisfies LinkToken, 0, Date.parse(link.expires));

  return async (request) => {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(base)) return new Response('Not here.', { status: 404 });
      const path = url.pathname.slice(base.length) || '/';
      const own = await options.storage.serve?.(request, path);
      if (own) return own;

      if (path.startsWith('/links/')) return await viaLink(path, url);

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
      const route = `${request.method} ${path
        .replace(/^\/entries\/[^/]+/, '/entries/:id')
        .replace(/\/versions\/[^/]+/, '/versions/:v')
        .replace(/\/shares\/[^/]+/, '/shares/:with')
        .replace(/\/links\/[^/]+/, '/links/:link')}`;
      const id = decodeURIComponent(/^\/entries\/([^/]+)/.exec(path)?.[1] ?? '');
      const versionId = decodeURIComponent(/\/versions\/([^/]+)/.exec(path)?.[1] ?? '');
      const shareWith = decodeURIComponent(/\/shares\/([^/]+)/.exec(path)?.[1] ?? '');
      const linkId = decodeURIComponent(/\/links\/([^/]+)/.exec(path)?.[1] ?? '');

      switch (route) {
        case 'GET /entries': {
          const drive = await load();
          const folder = folderOf(drive, url.searchParams.get('folder'));
          await allow(user, 'list', folder, drive);
          if (folder && core.isTrashed(drive, folder.id)) throw new Refused(409, 'in-trash', 'That folder is in the trash.');
          const inside = core.children(drive, folder?.id ?? null);
          // At the top, unless it is one drive for everyone, only one's own: what others share is in Shared with me.
          const shown = folder || options.top === 'everyone' ? inside : inside.filter((entry) => entry.owner === user.id);
          return Response.json({
            folder,
            path: folder ? await pathOf(user, drive, [...core.ancestors(drive, folder.id), folder]) : [],
            entries: await readable(user, shown, drive),
          });
        }
        case 'GET /entries/:id': {
          const drive = await load();
          const entry = core.getEntry(drive, id);
          await allow(user, 'read', entry, drive);
          return Response.json({ entry, path: await pathOf(user, drive, core.ancestors(drive, id)), trashed: core.isTrashed(drive, id) });
        }
        case 'GET /recent': {
          const drive = await load();
          return Response.json({ entries: await readable(user, core.recent(drive), drive) });
        }
        case 'GET /trash': {
          const drive = await load();
          // One's own trash: what one owns or put there, not what others threw away in a folder shared with them.
          return Response.json({ entries: await readable(user, core.trash(drive, user.id), drive) });
        }
        case 'GET /shared': {
          const drive = await load();
          return Response.json({ entries: await readable(user, core.sharedWith(drive, user.id), drive) });
        }
        case 'GET /search': {
          const drive = await load();
          const within = url.searchParams.get('within') || undefined;
          const found = core.search(drive, url.searchParams.get('q') ?? '', { within, trashed: url.searchParams.get('trashed') === '1', limit: 200 });
          return Response.json({ entries: await readable(user, found, drive) });
        }
        case 'GET /settings': {
          const drive = await load();
          const kept = await getSetting('drive');
          const settings = core.readDriveSettings(kept, defaults);
          const mine = core.readPersonalSettings(await getSetting(`person:${user.id}`));
          return Response.json({
            drive: settings,
            mine,
            settings: core.settingsFor(settings, mine),
            canConfigure: await options.authorize(user, 'configure', null, drive),
            saved: kept !== undefined || options.settings !== undefined,
          });
        }

        case 'PUT /settings': {
          const asked = await body<unknown>();
          await allow(user, 'configure', null, await load());
          const settings = core.readDriveSettings(asked, await driveSettings());
          await setSetting('drive', settings);
          return Response.json({ drive: settings });
        }

        case 'PUT /settings/mine': {
          const mine = core.readPersonalSettings(await body<unknown>());
          await setSetting(`person:${user.id}`, mine);
          return Response.json({ mine, settings: core.settingsFor(await driveSettings(), mine) });
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
          const asked = await body<{
            name?: string;
            parent?: EntryId | null;
            file?: EntryId;
            type?: string;
            size: number;
            rendition?: { file: EntryId; version: string; size: number; width: number; height: number };
          }>();
          const size = Number(asked.size);
          if (!Number.isSafeInteger(size) || size < 0) throw new Refused(400, 'bad-size', 'Say the size of the file, in bytes.');
          if (size > maxSize) throw new Refused(413, 'too-large', `Files up to ${maxSize} bytes.`);
          const type = /^[\w.+-]+\/[\w.+-]+$/.test(asked.type ?? '') ? asked.type! : 'application/octet-stream';
          const drive = await load();
          let pending: Omit<Pending, 'key' | 'state'>;
          const versionId = newId();
          if (asked.rendition) {
            const r = asked.rendition;
            const file = core.getFile(drive, String(r.file));
            await allow(user, 'upload', file, drive);
            const version = file.versions.find((v) => v.id === r.version);
            if (!version) throw new Refused(404, 'no-version', `${file.name} has no version ${r.version}.`);
            const sizes = (await driveSettings()).images.sizes;
            const rendition = { of: file.id, version: version.id, size: Number(r.size), width: Number(r.width), height: Number(r.height) };
            if (!sizes.includes(rendition.size)) throw new Refused(400, 'bad-size', `Pictures are made in ${sizes.join(', ')} pixels.`);
            if (![rendition.width, rendition.height].every((n) => Number.isInteger(n) && n > 0 && n <= rendition.size))
              throw new Refused(400, 'bad-size', 'Say the width and the height of the picture, at most its size.');
            if (!type.startsWith('image/')) throw new Refused(400, 'not-a-picture', 'A smaller picture is a picture.');
            const key = `${file.id}/${version.id}@${rendition.size}`;
            const plan = await options.storage.startUpload(key, type, size, base);
            const made: Pending = { versionId: version.id, size, type, user: user.id, rendition, key, state: plan.state };
            return Response.json({ token: sealToken(options.secret, made, UPLOAD_LIFE), parts: plan.parts });
          }
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
              if (pending.rendition) {
                const { of, version: on, size, width, height } = pending.rendition;
                await allow(user, 'upload', core.getEntry(drive, of), drive);
                const next = core.addRendition(drive, of, on, { size, width, height, key: pending.key, type: pending.type, bytes: pending.size });
                return { drive: next, answer: { entry: core.getEntry(next, of) } };
              }
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

        case 'POST /uploads/resume': {
          const asked = await body<{ token: string }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          if (!options.storage.resumeUpload) throw new Refused(501, 'no-resume', 'This storage cannot go on with an upload: start it again.');
          const drive = await load();
          if ([...drive.entries.values()].some((entry) => entry.kind === 'file' && entry.versions.some((v) => v.key === pending.key)))
            throw new Refused(409, 'upload-finished', 'That upload is finished already.');
          try {
            const plan = await options.storage.resumeUpload(pending.key, pending.state, pending.size, base);
            const left = plan.parts.reduce((sum, part) => sum + part.to - part.from, 0);
            return Response.json({ token: asked.token, done: plan.done, parts: plan.parts, sent: pending.size - left });
          } catch (error) {
            if (error instanceof UploadGone) throw new Refused(410, 'upload-gone', 'That upload is no longer in the storage: start it again.');
            throw error;
          }
        }

        case 'POST /uploads/abort': {
          const asked = await body<{ token: string }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          // A token stays good after its upload is finished: the bytes of a version that is kept are not taken away.
          const drive = await load();
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
            // One's own trash, as it is listed: others' things in it are theirs to empty.
            for (const entry of core.trash(drive, user.id)) for (const inside of core.subtree(drive, entry.id)) await allow(user, 'delete', inside, drive);
            const removed = core.emptyTrash(drive, user.id);
            return { drive: removed.drive, answer: removed };
          });
          // The entries are gone first: bytes left behind by a failure here cost space, not a file that points nowhere.
          await options.storage.remove(gone.keys);
          return Response.json({ removed: gone.removed });
        }

        case 'GET /entries/:id/download': {
          const drive = await load();
          const file = core.getFile(drive, id);
          await allow(user, 'download', file, drive);
          const wanted = url.searchParams.get('version');
          const size = url.searchParams.has('size') ? Number(url.searchParams.get('size')) : undefined;
          return Response.json(await addressOf(file, url.searchParams.get('inline') === '1', size, wanted ?? undefined));
        }

        case 'POST /urls': {
          const asked = await body<{ ids?: unknown; inline?: boolean; size?: number }>();
          const ids = Array.isArray(asked.ids) ? asked.ids.filter((id): id is string => typeof id === 'string') : [];
          if (ids.length > URLS_AT_ONCE) throw new Refused(400, 'too-many', `Up to ${URLS_AT_ONCE} at once.`);
          const drive = await load();
          const size = typeof asked.size === 'number' ? asked.size : undefined;
          const urls: Record<string, Address> = {};
          // Each as its own route would answer it; one that may not be read, or is not a file, is left out.
          await Promise.all(
            [...new Set(ids)].map(async (id) => {
              const entry = drive.entries.get(id);
              if (entry?.kind !== 'file' || !(await options.authorize(user, 'download', entry, drive))) return;
              urls[id] = await addressOf(entry, asked.inline === true, size);
            }),
          );
          return Response.json({ urls });
        }

        case 'POST /entries/:id/shares': {
          const asked = await body<{ with: string; role: Role }>();
          return Response.json(
            await change(async (drive) => {
              await allow(user, 'share', core.getEntry(drive, id), drive);
              const next = core.share(drive, id, String(asked.with ?? ''), asked.role, context());
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );
        }
        case 'DELETE /entries/:id/shares/:with':
          return Response.json(
            await change(async (drive) => {
              // Anyone may leave what was shared with them; only who may share may take it from someone else.
              if (shareWith !== user.id) await allow(user, 'share', core.getEntry(drive, id), drive);
              const next = core.unshare(drive, id, shareWith);
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );

        case 'POST /entries/:id/links': {
          const asked = await body<{ days?: number }>();
          const days = asked.days === undefined ? 7 : Number(asked.days);
          if (!(days > 0 && days <= LINK_DAYS)) throw new Refused(400, 'bad-days', `A link lasts from a day to ${LINK_DAYS} days.`);
          const made = { id: newId(), expires: new Date(Date.parse(now()) + days * 86_400_000).toISOString() };
          return Response.json(
            await change(async (drive) => {
              await allow(user, 'share', core.getEntry(drive, id), drive);
              const next = core.addLink(drive, id, made, context());
              return { drive: next, answer: { entry: core.getEntry(next, id), token: linkToken(made) } };
            }),
          );
        }
        case 'GET /entries/:id/links/:link': {
          const drive = await load();
          const entry = core.getEntry(drive, id);
          await allow(user, 'share', entry, drive);
          const link = entry.links?.find((l) => l.id === linkId);
          if (!link) throw new Refused(404, 'no-link', 'There is no such link.');
          return Response.json({ token: linkToken(link) });
        }
        case 'DELETE /entries/:id/links/:link':
          return Response.json(
            await change(async (drive) => {
              await allow(user, 'share', core.getEntry(drive, id), drive);
              const next = core.removeLink(drive, id, linkId);
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            }),
          );

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

  /** What a link reads: the entry it was made for and what is inside it, to anyone who has its address, while it lasts. */
  async function viaLink(path: string, url: URL): Promise<Response> {
    const [, , token = '', rest] = path.split('/');
    const sealed = openToken<LinkToken>(options.secret, decodeURIComponent(token));
    const drive = await load();
    const root = sealed?.purpose === 'link' ? core.linked(drive, sealed.link, now()) : null;
    // One answer for a link changed, out of date, taken back or in the trash: which, is not for whoever holds it.
    if (!root) throw new Refused(404, 'no-link', 'This link does not work any more.');
    const inside = (id: string | null) => {
      const entry = id ? core.getEntry(drive, id) : root;
      if (!core.isWithin(drive, entry.id, root.id) || core.isTrashed(drive, entry.id)) throw new Refused(404, 'no-link', 'That is not in what this link reads.');
      return entry;
    };
    if (rest === undefined) {
      const folder = inside(url.searchParams.get('folder'));
      const path = [...core.ancestors(drive, folder.id), folder].filter((entry) => core.isWithin(drive, entry.id, root.id));
      return Response.json({ root, folder, path, entries: folder.kind === 'folder' ? core.children(drive, folder.id) : [] });
    }
    if (rest === 'download') {
      const file = inside(url.searchParams.get('id'));
      if (file.kind !== 'file') throw new Refused(400, 'not-a-file', `${file.name} is a folder.`);
      return Response.json({ url: await options.storage.downloadUrl(file.versions[0].key, file.name, file.type, base, url.searchParams.get('inline') === '1') });
    }
    throw new Refused(404, 'no-route', 'No such route.');
  }
}
