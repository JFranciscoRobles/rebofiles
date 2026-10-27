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
//   GET    /starred                       what the one asking starred, the last starred first
//   PUT    /entries/:id/star              starred, by the one asking only
//   DELETE /entries/:id/star              no longer
//   GET    /search?q=…&within=…&trashed=1 found by name
//   POST   /folders                       { name, parent }
//   POST   /uploads                       { name, parent, type, size }, or { file, type, size } for a new version: where to send the parts;
//                                         or { rendition: { file, version, size, width, height }, type, size }: a smaller picture of a version
//   POST   /uploads/finish                { token, parts: [{ number, etag }] }: the file, once its bytes are there
//   POST   /uploads/resume                { token }: an upload cut, gone on with: what arrived, and where to send the rest
//   POST   /uploads/abort                 { token }: an upload given up, and what of it arrived taken away
//   PATCH  /entries/:id                   { name }, { parent }, { color } or { fields }, with { ifTaken: 'keep-both' } to add "(2)"
//   GET    /fields?name=…&value=…         what has that field set to that value, of what one may read
//   POST   /entries/:id/copy              { parent }: a copy of a file, its bytes copied in the storage; beside it unless said, or at one's own top
//   POST   /entries/:id/trash             into the trash
//   POST   /entries/:id/restore           out of it
//   DELETE /entries/:id                   gone for good, from the trash
//   POST   /trash/empty
//   GET    /entries/:id/download?version=&inline=1&size=  an address to read it from, or to show it in the page; with size, a smaller picture when there is one
//   POST   /entries/:id/versions/:v/restore
//   POST   /zip                           { ids }: what an archive of them holds, folders with what is in them, at their paths
//   POST   /urls                          { ids, inline, size }: the addresses of many files at once, for a grid; until when each is good
//   GET    /info                          where the bytes are, as a person reads it
//   GET    /usage                         the bytes the one asking keeps, and how many they may
//   GET    /settings                      the drive's settings, the one asking's own, and whether they may change the drive's
//   PUT    /settings                      the drive's, for whoever may 'configure'
//   PUT    /settings/mine                 { language, theme }: one's own
//   GET    /entries/:id/activity?limit=   what was done to it, and in it of a folder, the newest first
//   GET    /search/text?q=                files by what is written in them, with a piece of it around what was found
//   PUT    /entries/:id/text              { version, text }: what is written in a file, as the page read it, to find it by
//   PUT    /entries/:id/placeholder       { version, placeholder }: the tiny picture shown blurred while a picture comes
//   POST   /duplicates                    { hashes }: the files with those bytes already, of what one may read
//   GET    /shared                        what others shared with the one asking
//   GET    /shared/new                    how many of those are new since they last looked
//   POST   /shared/seen                   they looked: none is new any more
//   POST   /entries/:id/shares            { with, role, days }: shared, or given another role; for that many days, for good with null, as before unless said
//   DELETE /entries/:id/shares/:with      no longer shared with them
//   POST   /entries/:id/links             { days, password, once, viewOnly, watermark }: a link to read it without signing in, and its address
//   GET    /entries/:id/links/:link       the address of a link again
//   DELETE /entries/:id/links/:link       taken back
//   GET    /entries/:id/comments          what is said of it, each thread with its replies under it
//   POST   /entries/:id/comments          { text, replyTo }: a comment, or a reply; those it names with @ told (onComment)
//   PATCH  /entries/:id/comments/:c       { text } by its author, or { resolved: true | false }
//   DELETE /entries/:id/comments/:c       by its author, or by who may share the entry
//   PUT    /entries/:id/hold              { reason }: on hold, for who may 'configure': not to be trashed or deleted
//   DELETE /entries/:id/hold              released
//   GET    /notifications                 what the one asking was told (shared with them or a group of theirs, named in a comment), the newest first, and how many are new
//   POST   /notifications/seen            they looked: none is new any more
//   GET    /admin/usage                   for who may 'configure': what each person keeps (files, folders, bytes), and the whole drive
//   GET    /admin/activity?limit=         for who may 'configure': what was done anywhere in the drive, the newest first
//   GET    /export?user=…                 everything of a person (oneself, or anyone for who may 'configure'), for a .zip
//   GET    /events                        what changes, as it happens (server-sent events): the folders and entries of each change one may see
//
// Every one asks `identify` who is asking and `authorize` whether they may,
// but for what a link reads, which asks neither: the link is the permission.
// A link with `watermark` asks with each the name of who sees it (X-Link-Viewer);
// one `viewOnly` shows what it shares, inline, and gives nothing to save.
//
//   GET    /links/:token?folder=…         what the link reads, or a folder inside it
//   GET    /links/:token/download?id=…&inline=1
//   GET    /links/:token/zip?ids=…        what an archive of some of it (all, unless said) holds
//   GET    /links/:token/urls?ids=…       the addresses of some of its files
//   POST   /links/:token/uploads          { name, folder, type, size }, and /finish, /resume, /abort: a file put in it, of a link that lets files in ({ uploads });
//                                         X-Link-Name says who sends, X-Link-Item which document asked for it is,
//                                         X-Link-Expires until when it is good (YYYY-MM-DD), of a document that asks it
//                                         and X-Link-Answers what they wrote to its questions ({ id: text }, as JSON, encoded)
//   DELETE /links/:token/sent/:receipt     a file just sent through it taken back, for ten minutes, by the receipt its upload gave
//   PATCH  /entries/:id/links/:link        { days, uploads, request, closed }: a link changed, closed or opened again
//   PUT    /entries/:id/review             { status: 'accepted' | 'rejected' | null, reason }: a file that came through a request, looked at
//   GET    /received                      what came through the requests for files of the one asking, the newest first
//   GET    /requests                      the requests for files of the one asking: each folder, its link, its token, what came
//   GET    /admin/requests                for who may 'configure': every request for files, with whom it was sent to and what is missing
//   POST   /entries/:id/links/:link/remind  whoever a request was sent to reminded now of what is missing (with `reminders`)
//   GET    /expiring?days=                files one may read whose field `expires` says they stop being good within so many days

import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
/** A password as it is kept: its salt and what scrypt makes of it, never itself. */
async function sealPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt, 32)).toString('hex')}`;
}
async function passwordIs(kept: unknown, given: string): Promise<boolean> {
  if (typeof kept !== 'string' || !kept.includes(':')) return false;
  const [salt, hash] = kept.split(':');
  const made = await derive(given, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(made, Buffer.from(hash, 'hex'));
}
import * as core from '@rebofiles/core';
import type { Action, Context, Drive, Entry, EntryId, Role } from '@rebofiles/core';
import type { Inspect, UploadAsked } from './inspect';
import type { Derive, MadeHere } from './made';
import type { Reminder } from './mail';
import { DEFAULT_LIMITS, type Limit, type Limiter, type Limits, type Logger, type RequestDone, consoleLogger, memoryLimiter } from './observe';
import { type KeptText, type MetadataStore, activityIn } from './metadata';
import { type Scope, viewOf } from './view';
import { Refused, answerTo } from './refused';
import { type FinishedPart, READ_LIFE, type Storage, UploadGone, partSizeOf, partsOf, shownWindow } from './storage';
import { openToken, sealToken } from './tokens';

export type { Action } from '@rebofiles/core';

export interface User {
  id: string;
  /** May change the settings of the whole drive, with `byRoles`. */
  admin?: boolean;
  /**
   * The groups the application says they are in (`sales`, `team-42`): what is shared with `group:sales` is shared
   * with them, as `byRoles` and Shared with me read it. Who is in each is the application's, asked as it identifies.
   */
  groups?: readonly string[];
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
  /**
   * Called once an entry is shared with someone, or their role changed (`first: false`): to tell them, by mail or as
   * yours does. Its failure is not the request's, which is answered as soon as the share is kept.
   */
  /** Pages of other origins that may use the routes, as `['tauri://localhost', 'https://app.example.com']`: none unless said. */
  cors?: { origins: string[] };
  onShare?: (event: { entry: Entry; with: string; role: Role; by: User; first: boolean }) => void | Promise<void>;
  /**
   * Asked before an upload is given addresses, with what the page says of it: its name, type, size and where it goes.
   * Throw a `Refused` to refuse it with a message of yours (`new Refused(415, 'no-videos', 'No videos here.')`), or
   * return false for a 403. For each new file and each new version, not for the smaller pictures the page makes.
   */
  beforeUpload?: (upload: UploadAsked, drive: Drive) => unknown;
  /**
   * Asked once the bytes are in the storage and before the file is listed, with a `read` of them: a scan for viruses
   * (`clamav()`), the type its bytes are against the one its name says (`checkType()`). Throw a `Refused`, or return
   * false, and the bytes are taken away and the upload refused (422). Any other error refuses it too (503): a file
   * not looked at is not let in. Needs a storage that can `read`, as both of this package can.
   */
  inspect?: Inspect;
  /**
   * What changes told as it happens, at `GET /events`, to the pages that watch: a change made here at once, one made by
   * another process on the same store (of a store with `revision`, as SQLite's and Postgres') within `poll`
   * milliseconds, 2000 unless said. False for none: the pages ask again as they did, after their own changes.
   */
  live?: false | { poll?: number };
  /**
   * Each thing done to the drive, as its activity says it, once it is kept: made, uploaded, a new version, renamed,
   * moved, trashed, restored, deleted, shared… with the entry as it is after (null once deleted). For webhooks, an
   * audit of your own, another index, or counting space. Its failure is logged, not the request's.
   */
  onChange?: (event: { activity: core.Activity; entry: Entry | null }) => void | Promise<void>;
  /** Each comment made, with whom it names with an @ (`@bea`): to tell them, as your application does. Its failure is logged. */
  onComment?: (event: { comment: core.Comment; entry: Entry; mentions: string[]; by: User }) => void | Promise<void>;
  /**
   * Each file that came through a request for files: who sent it, the document asked for it is, the request (its
   * `email` among it, for a receipt) and what came through it so far. Its failure is logged.
   */
  onReceived?: (event: { entry: core.FileEntry; from?: string; item?: string; request?: core.FileRequest; got?: core.Received }) => void | Promise<void>;
  /** A file that came through a request, accepted or turned back with a reason: to tell who sent it. Its failure is logged. */
  onReview?: (event: { entry: Entry; status: 'accepted' | 'rejected' | null; reason?: string; from?: string; by: User }) => void | Promise<void>;
  /**
   * Whoever a request for files was sent to (its `email`) reminded of what is missing, every `remind` days the request
   * says, while it is open; and at once from the drive. `mailReminders({ mail: resend(…), url })` of this package sends
   * a mail of it; yours may do anything. Without it, nobody is reminded and the drive offers it to nobody.
   */
  reminders?: { send: (reminder: Reminder) => void | Promise<void> };
  /**
   * What is written in a file that came through a request, once it is known, against the document it was asked as:
   * the words it should say and the fields its patterns find (`checkWritten` of the core, the default). Yours may
   * return the same of it (`{ missing, fields }`), as a service that reads documents would. `false` for none.
   */
  check?: false | ((event: { entry: core.FileEntry; item: core.RequestItem; text: string }) => ReturnType<typeof core.checkWritten> | Promise<ReturnType<typeof core.checkWritten>>);
  /**
   * The files whose field `field` (`expires`, as a request asks it) says they stop being good, told to their owner in
   * the drive `days` before (15), and to `onExpiring`. `false` for none.
   */
  expiring?: false | { field?: string; days?: number; onExpiring?: (event: { entry: Entry; expires: string; days: number }) => void | Promise<void> };
  /**
   * A file that came through a request with the same bytes as one its owner has already, marked with the field `same`
   * (the id of that one), to be told in what came: by the SHA-256 the page of the link says. `false` for none.
   */
  duplicates?: false;
  /**
   * What the server makes of a file once it is kept, a moment after, for what the page did not make itself: its
   * smaller pictures, its placeholder, what is written in it. `deriveAll()` of `@rebofiles/server/derive` makes them of
   * pictures, PDFs, Word documents and text, with sharp and pdf.js. Needs a storage that can read and write.
   */
  derive?: Derive;
  /** Where what went wrong and was not answered for is written: `pino()`, `console` (the default), yours. */
  logger?: Logger;
  /** After every request, with its route, status, time and who asked: for metrics (`openTelemetry(meter)`). */
  onRequest?: (done: RequestDone) => void;
  /** How many requests of each kind each one may make, over `DEFAULT_LIMITS`; a 429 with `retry-after` past them. `false` for none. */
  limits?: Limits | false;
  /** Where the counts are kept: in this process unless given; one of all the processes (Redis) for more than one. */
  limiter?: Limiter;
  /** The address of who asks, to limit wrong passwords of a link by it too: `x-forwarded-for` behind a proxy you trust. */
  clientIp?: (request: Request) => string | null | undefined;
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
  action === 'configure' ? user.admin === true : entry === null ? AT_THE_TOP.includes(action) : core.allows(core.accessOf(drive, entry.id, user), action);

/** What a link's token holds: its id, and that it is one, so no other token of the server is taken for it. */
interface LinkToken {
  purpose: 'link';
  link: string;
}

/** What lets whoever sent a file through a link take it back, a while. */
interface ReceiptToken {
  purpose: 'receipt';
  file: EntryId;
  link?: string;
}
/** How long a file just sent through a link may be taken back by who sent it, in seconds. */
const RECEIPT_LIFE = 10 * 60;

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
  /** The SHA-256 of each part, as the page said: kept with the version, for the next one to be sent without what it shares. */
  parts?: core.PartHashes;
  /** Some of its parts copied in the storage from the version before: their ETags asked of it when it is finished. */
  copied?: true;
  /** What the page makes of it itself, which the server's `derive` need not. */
  madeHere?: MadeHere[];
  /** The SHA-256 of the bytes, as the page said: kept with the version, to tell the same file again. */
  sha256?: string;
  /** Of a file put through a link: whose it is, the owner of the folder, and what whoever sent it said they are called. */
  owner?: string;
  from?: string;
  /** The link it came through, and the document of its request it is. */
  link?: string;
  item?: { id: string; label: string };
  /** Until when it is good, as its sender said, of a document that asks it: YYYY-MM-DD. */
  expires?: string;
  /** What its sender wrote to the questions of the request, by the field each is kept as. */
  answers?: Record<string, string>;
}

/** Where to read a file from, and until when. */
interface Address {
  url: string;
  /** ISO 8601. */
  expires: string;
  width?: number;
  height?: number;
}

/** What a page watching is told of a change: where it was, and what changed of what it may read. */
export interface DriveEvent {
  /** Who made it, when this process made it; null for one seen in the store, made by another. */
  by: string | null;
  at: string;
  /** The folders where something came, went, or changed, that the one watching may list: null is the top. */
  folders: (EntryId | null)[];
  /** The entries changed, or made, that the one watching may read. */
  entries: EntryId[];
}

/** How often a page watching is sent a line of nothing, so what is between does not take it for gone. */
const HEARTBEAT = 25_000;

/** How often the trash is looked at for what has been there longer than the settings let it. */
const SWEEP_EVERY = 10 * 60_000;

/** Bytes as a person reads them, in a message: "1.2 GB". */
const bytes = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1024 ** 2))} MB`);

/** How many files and folders go in one archive. */
const ZIP_AT_ONCE = 50_000;

/** How many files' addresses are asked for in one request: a page of a grid, and more. */
const URLS_AT_ONCE = 500;
/** The most characters of a file's text kept to find it by: the start of a long one is enough. */
const TEXT_KEPT = 100_000;

/** An upload left halfway is good for this long. */
const UPLOAD_LIFE = 24 * 60 * 60;
const MAX_BODY = 1_000_000;
/** The largest file the server copies by reading and writing it, for a storage that cannot copy by itself. */
const COPY_THROUGH = 100 * 1024 * 1024;
/** How many entries a person may star; the oldest go past it. */
const MAX_STARRED = 1000;
/** A person's starred entries, as kept. */
/** An entry as whoever holds a link sees it: not with whom it is shared, its links, nor the fields of the application's. */
const bare = (entry: Entry): Entry => {
  const { shares: _, links: __, fields: ___, hold: ____, ...rest } = entry;
  return rest as Entry;
};
/** A header sent encoded, so what is in it may be in any language: as it was, trimmed; as it came, if it was not. */
const decoded = (said: string) => {
  try {
    return decodeURIComponent(said).trim();
  } catch {
    return said.trim();
  }
};
const starredOf = (kept: unknown): EntryId[] => (Array.isArray(kept) ? kept.filter((one): one is EntryId => typeof one === 'string') : []);

/** A request's route as the list at the top says it, its ids as their names: `PATCH /entries/:id`. */
export function routeOf(method: string, path: string): string {
  if (path.startsWith('/links/')) {
    const rest = path.split('/')[3];
    return `${method} /links/:token${rest ? `/${rest}` : ''}`;
  }
  return `${method} ${path
    .replace(/^\/entries\/[^/]+/, '/entries/:id')
    .replace(/\/versions\/[^/]+/, '/versions/:v')
    .replace(/\/shares\/[^/]+/, '/shares/:with')
    .replace(/\/comments\/[^/]+/, '/comments/:c')
    .replace(/\/links\/[^/]+/, '/links/:link')}`;
}

/** The routes of a drive, as a function of a Request; and when what it makes of files in the background is made. */
export type DriveHandler = ((request: Request) => Promise<Response>) & {
  /** Once nothing is being made of a file (`derive`): for a test, or before the process ends. */
  idle(): Promise<void>;
};

export function createDriveHandler(options: DriveServerOptions): DriveHandler {
  const base = (options.base ?? '').replace(/\/$/, '');
  const maxSize = options.maxSize ?? 5 * 1024 ** 3;
  const newId = options.newId ?? randomUUID;
  const now = () => (options.now?.() ?? new Date()).toISOString();
  const log = options.logger ?? consoleLogger;
  const limits = options.limits === false ? null : { ...DEFAULT_LIMITS, ...options.limits };
  const limiter = options.limiter ?? memoryLimiter();
  /** One more of a kind of request by `who`: refused with a 429, and when to ask again, past its limit. */
  const throttle = async (kind: keyof Limits, who: string, how: { peek?: boolean } = {}) => {
    const rule = limits?.[kind] as Limit | false | undefined;
    if (!rule) return;
    const { ok, retryAfter } = await limiter.hit(`${kind}:${who}`, rule, how);
    if (!ok) throw new Refused(429, 'rate-limited', 'Too many at once: try again in a moment.', { headers: { 'retry-after': String(Math.max(1, Math.ceil(retryAfter / 1000))) } });
  };
  // Who asked each request, for what `onRequest` is told after it.
  const askedBy = new WeakMap<Request, string>();
  // The drive as each request needs it: a piece of it, of a store that answers a piece at a time; else the whole of
  // it, held while the store's revision stays, so it is loaded again only once this process or another changed it.
  const view = viewOf(options.metadata);
  const load = (scope?: Scope) => view.drive(scope);
  const find = view.find;

  // Changes go one at a time, each on the drive the last one left; reads take the drive as it is.
  let queue: Promise<unknown> = Promise.resolve();
  // What was done, kept by the store when it can, else for as long as the process lasts, the last ten thousand.
  const ownActivity: core.Activity[] = [];
  const record = async (lines: core.Activity[]) => {
    if (!lines.length) return;
    if (options.metadata.record) return options.metadata.record(lines);
    ownActivity.push(...lines);
    if (ownActivity.length > 10_000) ownActivity.splice(0, ownActivity.length - 10_000);
  };
  // The text of each file, to find it by: kept by the store when it can, else for as long as the process lasts.
  const ownTexts = new Map<EntryId, KeptText>();
  const keepText = async (id: EntryId, version: string, text: string) => {
    await (options.metadata.keepText ? options.metadata.keepText(id, version, text) : (ownTexts.set(id, { id, version, text }), Promise.resolve()));
    await checked(id, text).catch((error) => log.error('What is written in a file that came could not be checked:', error));
  };
  /**
   * A file that came through a request, its text known: whether it says what the document asked should, and the
   * fields found in it, kept on it for whoever looks at it (`check`: the words it does not say).
   */
  const checked = async (id: EntryId, text: string) => {
    if (options.check === false) return;
    const scope = await load({ ids: [id] });
    const file = scope.entries.get(id);
    if (file?.kind !== 'file' || file.fields?.via !== 'request' || !file.fields.request || !file.fields.item) return;
    const drive = await load(await find.withLink(file.fields.request));
    const item = core.linkOf(drive, file.fields.request)?.request?.items?.find((one) => one.label === file.fields!.item);
    if (!item) return;
    const said = options.check ? await options.check({ entry: file, item, text }) : core.checkWritten(item, text);
    if (!said) return;
    const fields = Object.fromEntries(Object.entries(said.fields ?? {}).filter(([name]) => !file.fields?.[name]));
    await change(
      async (drive) => ({ drive: core.setFields(drive, id, { ...fields, check: said.missing?.length ? said.missing.join(' | ') : null }, { by: 'drive', at: now() }), answer: null }),
      'drive',
      { ids: [id] },
    );
  };
  const findText = (query: string, limit: number) => (options.metadata.findText ? options.metadata.findText(query, limit) : Promise.resolve([...ownTexts.values()]));
  const activity = (id: EntryId, limit: number) => (options.metadata.activity ? options.metadata.activity(id, limit) : Promise.resolve(activityIn(ownActivity, id, limit)));

  /**
   * A change of the drive by `by`, who is told in its activity: someone signed in, or the server itself (`trash`). On
   * the drive with what `scope` names, asked under the lock: a function of it is asked there too, as what is there may
   * have changed while it waited.
   */
  const change = <T>(work: (drive: Drive) => Promise<{ drive: Drive; answer: T }>, by = 'drive', scope: Scope | (() => Promise<Scope>) = {}): Promise<T> => {
    const step = async () => {
      const before = await load(typeof scope === 'function' ? await scope() : scope);
      const { drive, answer } = await work(before);
      if (drive !== before) {
        await options.metadata.save(core.changes(before, drive));
        if (!view.scoped) told = drive;
        void tell(before, drive, by === 'drive' || by === 'trash' ? null : by);
        // Its activity after it, as what is kept beside: a change kept with no line of it is better than a line of none.
        const lines = core.activityOf(before, drive, by, now());
        // Told here already: not again when it is read back from the store's activity, as another process's would be.
        if (view.scoped && polling) {
          if (toldHere.size > 10_000) toldHere.clear();
          for (const line of lines) toldHere.add(lineKey(line));
        }
        await record(lines).catch((error) => log.error('The activity could not be kept:', error));
        if (options.onChange)
          for (const activity of lines)
            void Promise.resolve()
              .then(() => options.onChange!({ activity, entry: drive.entries.get(activity.entry) ?? null }))
              .catch((error) => log.error('onChange failed:', error));
        // What was saved is what is held, under the lock that kept others out meanwhile: nothing to load for it.
        if (options.metadata.revision) {
          const revision = await options.metadata.revision();
          view.saved(drive, revision);
        }
      }
      return answer;
    };
    // In order here, and under the store's lock when it has one, for the other processes on the same store.
    const run = queue.then(() => (options.metadata.lock ? options.metadata.lock(step) : step()));
    queue = run.catch(() => undefined);
    return run;
  };

  // ---- What changes, told to the pages watching ----
  const watchers = new Set<{ user: User; send: (text: string) => void }>();
  /** The drive as it was last told: a drive loaded that is another was changed by another process. */
  let told: Drive | undefined;
  const tell = async (before: Drive, after: Drive, by: string | null) => {
    if (!watchers.size) return;
    const { put, removed } = core.changes(before, after);
    if (!put.length && !removed.length) return;
    // Where each change was: the folder of what changed, the one it left when it moved, the one of what is gone.
    const folders = new Set<EntryId | null>();
    // The top is each one's own: told only to whose came, went or changed there, unless it is one drive for everyone.
    const atTheTop = new Set<string>();
    const place = (entry: Entry | undefined) => {
      if (!entry) return;
      folders.add(entry.parent);
      if (entry.parent === null) atTheTop.add(entry.owner);
    };
    for (const entry of put) {
      place(entry);
      const was = before.entries.get(entry.id);
      if (was && was.parent !== entry.parent) place(was);
    }
    for (const id of removed) place(before.entries.get(id));
    const at = now();
    for (const watcher of watchers) {
      try {
        const entries = (await readable(watcher.user, put, after)).map((entry) => entry.id);
        const seen: (EntryId | null)[] = [];
        for (const id of folders) {
          const folder = id === null ? null : after.entries.get(id);
          if (id === null && options.top !== 'everyone' && !atTheTop.has(watcher.user.id)) continue;
          if (folder !== undefined && (await may(watcher.user, 'list', folder, after))) seen.push(id);
        }
        if (entries.length || seen.length) watcher.send(`event: change\ndata: ${JSON.stringify({ by, at, folders: seen, entries } satisfies DriveEvent)}\n\n`);
      } catch (error) {
        log.error('A change could not be told:', error);
      }
    }
  };
  // Changes of other processes, from the store's revision, while some page watches: of a store without one, only this process's.
  const poll = options.live === false ? 0 : (options.live?.poll ?? 2000);
  let polling: ReturnType<typeof setInterval> | undefined;
  // The revision last seen: one that is another was made by another process.
  let seenRevision: string | undefined;
  // Where the store's activity was last read, and the lines of this process's changes, told already as they were made.
  let activityCursor: string | undefined;
  const toldHere = new Set<string>();
  const lineKey = (line: core.Activity) => `${line.at}|${line.by}|${line.action}|${line.entry}`;
  /** What another process did, from the store's activity: each page watching told of what of it they may see. */
  const tellLines = async (lines: core.Activity[]) => {
    const theirs = lines.filter((line) => !toldHere.delete(lineKey(line)));
    if (!theirs.length) return;
    const ids = [...new Set(theirs.flatMap((line) => [line.entry, line.parent, line.from ?? null]))];
    const drive = await load({ ids, children: [] });
    const at = now();
    for (const watcher of watchers) {
      try {
        const entries: EntryId[] = [];
        const folders = new Set<EntryId | null>();
        for (const line of theirs) {
          const entry = drive.entries.get(line.entry);
          if (entry && (await may(watcher.user, 'read', entry, drive))) entries.push(entry.id);
          for (const id of [line.parent, ...(line.from !== undefined ? [line.from] : [])]) {
            const folder = id === null ? null : drive.entries.get(id);
            if (id === null && options.top !== 'everyone' && !(line.parent === null && (entry?.owner ?? line.by) === watcher.user.id)) continue;
            if (folder !== undefined && (await may(watcher.user, 'list', folder, drive))) folders.add(id);
          }
        }
        if (entries.length || folders.size) watcher.send(`event: change\ndata: ${JSON.stringify({ by: null, at, folders: [...folders], entries: [...new Set(entries)] } satisfies DriveEvent)}\n\n`);
      } catch (error) {
        log.error('A change could not be told:', error);
      }
    }
  };
  const look = async () => {
    try {
      if (!view.scoped) {
        const drive = await load();
        if (told && drive !== told) await tell(told, drive, null);
        told = drive;
        return;
      }
      // Of a store asked a piece at a time, what another process changed is read from what it did, kept by the store.
      const revision = await options.metadata.revision!();
      if (seenRevision !== undefined && revision === seenRevision) return;
      seenRevision = revision;
      if (options.metadata.activityAfter) {
        const { lines, cursor } = await options.metadata.activityAfter(activityCursor);
        const first = activityCursor === undefined;
        activityCursor = cursor;
        if (!first) await tellLines(lines);
        return;
      }
      // Without it, only that something changed: each page asks again what it shows, and only what it may see.
      for (const watcher of watchers) watcher.send(`event: change\ndata: ${JSON.stringify({ by: null, at: now(), folders: [], entries: [] } satisfies DriveEvent)}\n\n`);
    } catch (error) {
      log.error('The store could not be looked at for changes:', error);
    }
  };
  const watch = (user: User, signal: AbortSignal): Response => {
    let watcher: { user: User; send: (text: string) => void } | undefined;
    let beat: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (watcher) watchers.delete(watcher);
      clearInterval(beat);
      if (!watchers.size) clearInterval(polling), (polling = undefined);
    };
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            stop();
          }
        };
        watcher = { user, send };
        watchers.add(watcher);
        send('retry: 3000\n: watching\n\n');
        beat = setInterval(() => send(': still\n\n'), HEARTBEAT);
        (beat as { unref?: () => void }).unref?.();
        if (options.metadata.revision && !polling) {
          void look();
          polling = setInterval(look, poll);
          (polling as { unref?: () => void }).unref?.();
        }
        signal.addEventListener('abort', () => {
          stop();
          try {
            controller.close();
          } catch {}
        });
      },
      cancel: stop,
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' } });
  };

  // Kept by the store when it can, else for as long as the process lasts.
  const ownSettings = new Map<string, unknown>();
  const getSetting = (name: string) => (options.metadata.getSetting ? options.metadata.getSetting(name) : Promise.resolve(ownSettings.get(name)));
  const setSetting = (name: string, value: unknown) => (options.metadata.setSetting ? options.metadata.setSetting(name, value) : (ownSettings.set(name, value), Promise.resolve()));
  /** Something told to a person, or to everyone of a group, kept for them to see in the drive. */
  const notify = async (to: string, notice: Omit<core.Notice, 'id' | 'at'>) => {
    if (to === '*' || to === notice.by) return;
    const kept = core.noticesOf(await getSetting(`inbox:${to}`));
    await setSetting(`inbox:${to}`, [{ id: newId(), at: now(), ...notice }, ...kept].slice(0, core.MAX_NOTICES));
  };
  /** The drive's settings: what was kept, over the defaults the server was given. */
  const driveSettings = async () => core.readDriveSettings(await getSetting('drive'), defaults);
  const defaults = core.readDriveSettings(options.settings ?? {});

  /**
   * Who puts files through a link: a user made for the request, who may make a file in the link's folder and under it,
   * and nothing else; and the folder, whose owner the files are, and what they said they are called.
   */
  const throughLinks = new WeakMap<User, { root: Entry; owner: string; link: core.Link; from?: string; item?: string; expires?: string; answers?: Record<string, unknown> }>();
  const linkUsers = new WeakMap<Request, User>();
  const may = (user: User, action: Action, entry: Entry | null, drive: Drive): boolean | Promise<boolean> => {
    const via = throughLinks.get(user);
    if (via) return action === 'upload' && entry !== null && entry.kind === 'folder' && core.isWithin(drive, entry.id, via.root.id) && !core.isTrashed(drive, entry.id);
    return options.authorize(user, action, entry, drive);
  };
  const allow = async (user: User, action: Action, entry: Entry | null, drive: Drive) => {
    if (!(await may(user, action, entry, drive))) throw new Refused(403, 'forbidden', 'You may not do that here.');
  };
  const readable = async (user: User, entries: Entry[], drive: Drive) => {
    const seen = await Promise.all(entries.map((entry) => may(user, 'read', entry, drive)));
    return entries.filter((_, i) => seen[i]);
  };
  const folderOf = (drive: Drive, id: string | null | undefined): Entry | null => (id ? core.getFolder(drive, id) : null);
  /** Whose entries at the top a request asks for: of one drive for everyone, all of them. */
  const topOf = (...owners: (string | undefined)[]) => (options.top === 'everyone' ? [] : owners);
  /** An entry, what is beside it in its folder (whose names it may not take) and, with `under`, what is under it. */
  const around = async (id: EntryId, under = false): Promise<Scope> => {
    const [entry] = (await options.metadata.scoped?.entries([id])) ?? [];
    return { ids: [id], children: entry ? [entry.parent] : [], owners: topOf(entry?.owner), subtrees: under ? [id] : [] };
  };
  /** Several scopes as one. */
  const both = (...scopes: Scope[]): Scope => ({
    ids: scopes.flatMap((scope) => scope.ids ?? []),
    children: scopes.flatMap((scope) => scope.children ?? []),
    owners: scopes.flatMap((scope) => scope.owners ?? []),
    subtrees: scopes.flatMap((scope) => scope.subtrees ?? []),
    entries: scopes.flatMap((scope) => scope.entries ?? []),
  });
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
  /** What `inspect` says of an upload whose bytes arrived: nothing when it lets it in; its bytes taken away, and refused, when not. */
  const inspected = async (pending: Pending, user: User) => {
    const storage = options.storage;
    if (!storage.read) throw new Error('`inspect` needs a storage that can read: this one cannot.');
    const of = pending.of ?? pending.rendition?.of;
    const drive = await load({ ids: [of, pending.file?.parent] });
    const file = of ? core.getFile(drive, of) : undefined;
    const parent = folderOf(drive, file ? file.parent : pending.file!.parent) as core.FolderEntry | null;
    let refusal: unknown;
    try {
      const said = await options.inspect!(
        {
          user,
          purpose: pending.rendition ? 'rendition' : pending.of ? 'version' : 'file',
          name: file?.name ?? pending.file!.name,
          type: pending.type,
          size: pending.size,
          parent,
          ...(file ? { file } : {}),
          key: pending.key,
          read: (range) => storage.read!(pending.key, range),
        },
        drive,
      );
      if (said === false) refusal = new Refused(422, 'refused-content', `${file?.name ?? pending.file!.name} was not kept: it was refused when it was looked at.`);
    } catch (error) {
      refusal = error instanceof Refused ? error : new Refused(503, 'not-inspected', 'The file could not be looked at before it is kept. Try again in a moment.', { cause: error });
    }
    if (refusal) {
      await storage.remove([pending.key]).catch((error) => log.error('The bytes of a refused upload could not be taken away:', error));
      throw refusal;
    }
  };
  // ---- What is made of a file once it is kept, a few at a time, after the answer ----
  const deriving: { id: EntryId; version: string; madeHere: MadeHere[] }[] = [];
  let derivers = 0;
  const idleWaiters: (() => void)[] = [];
  const toDerive = (id: EntryId, version: string, madeHere: MadeHere[]) => {
    if (!options.derive || !options.storage.read || !options.storage.write || (madeHere.includes('pictures') && madeHere.includes('text'))) return;
    deriving.push({ id, version, madeHere });
    while (derivers < 2 && deriving.length) void deriveNext();
  };
  const deriveNext = async () => {
    derivers++;
    try {
      for (let job = deriving.shift(); job; job = deriving.shift()) await deriveOne(job).catch((error) => log.error('What is made of a file could not be made:', error));
    } finally {
      derivers--;
      if (!derivers && !deriving.length) for (const done of idleWaiters.splice(0)) done();
    }
  };
  const deriveOne = async ({ id, version, madeHere }: { id: EntryId; version: string; madeHere: MadeHere[] }) => {
    const file = (await load({ ids: [id] })).entries.get(id);
    const kept = file?.kind === 'file' ? file.versions.find((v) => v.id === version) : undefined;
    if (file?.kind !== 'file' || !kept) return;
    const images = (await driveSettings()).images;
    const want = { pictures: images.enabled && !madeHere.includes('pictures') && !kept.renditions?.length, text: !madeHere.includes('text') && file.versions[0].id === version };
    if (!want.pictures && !want.text) return;
    const storage = options.storage;
    const made = await options.derive!({ file: { ...file, versions: [kept, ...file.versions.filter((v) => v !== kept)] }, read: (range) => storage.read!(kept.key, range), images, want });
    if (!made) return;
    const renditions = want.pictures ? (made.renditions ?? []) : [];
    const written: { size: number; width: number; height: number; key: string; type: string; bytes: number }[] = [];
    for (const r of renditions) {
      const key = `${id}/${version}@${r.size}`;
      await storage.write!(key, r.bytes, r.type);
      written.push({ size: r.size, width: r.width, height: r.height, key, type: r.type, bytes: r.bytes.length });
    }
    if (written.length || (want.pictures && made.placeholder))
      await change(
        async (drive) => {
          let next = drive;
          for (const r of written) next = core.addRendition(next, id, version, r);
          if (want.pictures && made.placeholder) next = core.setPlaceholder(next, id, version, made.placeholder);
          return { drive: next, answer: null };
        },
        'drive',
        { ids: [id] },
      );
    if (want.text && made.text?.trim()) await keepText(id, version, made.text.slice(0, TEXT_KEPT));
  };
  /** Whether an upload is finished already: its bytes a version of its file, or a smaller picture of one. */
  const finished = async (pending: Pending) => {
    const id = pending.of ?? pending.file?.id ?? pending.rendition?.of;
    const entry = id ? (await load({ ids: [id] })).entries.get(id) : undefined;
    return entry?.kind === 'file' && entry.versions.some((v) => v.key === pending.key || v.renditions?.some((r) => r.key === pending.key));
  };
  /** The same address for a link every time, as its token is sealed until the link expires. */
  const linkToken = (link: { id: string; expires: string }) => sealToken(options.secret, { purpose: 'link', link: link.id } satisfies LinkToken, 0, Date.parse(link.expires));

  // The trash emptying itself, as the settings say: looked at now and then, as requests come, not on a timer of its own.
  let sweptAt = 0;
  const sweep = async () => {
    // By the drive's clock, so a test's moves it on too.
    const at = Date.parse(now());
    if (at - sweptAt < SWEEP_EVERY) return;
    sweptAt = at;
    // Uploads left halfway, past the life of their tokens, so none can be finished any more: their parts taken away.
    void options.storage.sweepUploads?.(new Date(Date.parse(now()) - (UPLOAD_LIFE + 3600) * 1000)).catch((error) => log.error('Uploads left halfway could not be swept:', error));
    void lookAhead().catch((error) => log.error('Reminders and what stops being good could not be looked at:', error));
    const days = (await driveSettings()).trashDays;
    if (!days) return;
    const before = new Date(Date.parse(now()) - days * 86_400_000).toISOString();
    const keys = await change(
      async (drive) => {
        const gone = core.purgeTrash(drive, before, await keeping());
        return { drive: gone.removed.length ? gone.drive : drive, answer: gone };
      },
      'trash',
      () => find.trashed({ before }),
    );
    await forgetComments(keys.removed);
    if (keys.keys.length) await options.storage.remove(keys.keys);
  };

  /** Whoever a request was sent to reminded of what is missing, now: sent, then kept as reminded. */
  const remind = async (entry: Entry, link: core.Link) => {
    const settings = await driveSettings();
    await options.reminders!.send({
      email: link.request!.email!,
      folder: { id: entry.id, name: entry.name, owner: entry.owner },
      link,
      request: link.request!,
      missing: core.missingOf(link),
      token: linkToken(link),
      company: settings.company ?? null,
      language: settings.language,
    });
    return change(
      async (drive) => {
        const next = core.reminded(drive, entry.id, link.id, now());
        return { drive: next, answer: { entry: core.getEntry(next, entry.id) } };
      },
      'drive',
      { ids: [entry.id] },
    );
  };
  const expiringField = () => (options.expiring === false ? null : (options.expiring?.field ?? 'expires'));
  /**
   * Now and then, with the sweep: the requests due a reminder reminded, and the owners of files that stop being good
   * soon told, once for each day a file says. Of the whole drive, as there is no index of either.
   */
  const lookAhead = async () => {
    const field = expiringField();
    const at = now();
    const live = (drive: Drive) => [...drive.entries.values()].filter((entry) => !core.isTrashed(drive, entry.id));
    const reminding = options.reminders ? await find.withReminders(1000) : null;
    if (reminding)
      for (const { entry, link } of core.remindersDue(live(await load(reminding)), at))
        await remind(entry, link).catch((error) => log.error(`The reminder of a request of “${entry.name}” could not be sent:`, error));
    if (!field || options.expiring === false) return;
    const days = options.expiring?.days ?? 15;
    const soon = await find.withFieldUpTo(field, new Date(Date.parse(at) + days * 86_400_000).toISOString().slice(0, 10), 1000);
    if (!soon) return;
    for (const { entry, expires, days: left } of core.expiringWithin(live(await load(soon)), field, at, days)) {
      const told = core.noticesOf(await getSetting(`inbox:${entry.owner}`)).some((notice) => notice.kind === 'expiring' && notice.entry === entry.id && notice.expires === expires);
      if (told) continue;
      await notify(entry.owner, { kind: 'expiring', entry: entry.id, name: entry.name, by: 'drive', expires });
      if (options.expiring?.onExpiring) void Promise.resolve(options.expiring.onExpiring({ entry, expires, days: left })).catch((error) => log.error('onExpiring failed:', error));
    }
  };

  /** The rule of keeping, as the settings say it now: no entry deleted for good before so many days since it was made. */
  const keeping = async (): Promise<core.Keep> => ({ days: (await driveSettings()).retentionDays, now: now() });

  // ---- Comments: kept by the store when it can, else for as long as the process lasts ----
  const ownComments = new Map<string, core.Comment>();
  const store = options.metadata;
  const commentsOn = (entry: EntryId) => (store.comments ? store.comments(entry) : Promise.resolve([...ownComments.values()].filter((c) => c.entry === entry)));
  const commentById = (id: string) => (store.comment ? store.comment(id) : Promise.resolve(ownComments.get(id)));
  const keepComment = (comment: core.Comment) => (store.keepComment ? store.keepComment(comment) : (ownComments.set(comment.id, comment), Promise.resolve()));
  const unsay = (id: string) => (store.removeComment ? store.removeComment(id) : (ownComments.delete(id), Promise.resolve()));
  /** The comments of entries deleted for good, gone with them. */
  const forgetComments = async (ids: EntryId[]) => {
    try {
      for (const id of ids) for (const comment of await commentsOn(id)) await unsay(comment.id);
    } catch (error) {
      log.error('The comments of what was deleted could not be taken away:', error);
    }
  };
  /** A comment said: in the activity of its entry, to onChange, and to those watching who may read it. */
  const saidOf = async (entry: Entry, by: string) => {
    const line: core.Activity = { at: now(), by, action: 'commented', entry: entry.id, name: entry.name, kind: entry.kind, parent: entry.parent };
    await record([line]).catch((error) => log.error('The activity could not be kept:', error));
    if (options.onChange) void Promise.resolve(options.onChange({ activity: line, entry })).catch((error) => log.error('onChange failed:', error));
    const drive = await load({ ids: [entry.id] });
    for (const watcher of watchers)
      if (await Promise.resolve(may(watcher.user, 'read', entry, drive)).catch(() => false))
        watcher.send(`event: change\ndata: ${JSON.stringify({ by, at: line.at, folders: [], entries: [entry.id] } satisfies DriveEvent)}\n\n`);
  };

  const answer = async (request: Request): Promise<Response> => {
    try {
      await sweep().catch(() => undefined);
      const url = new URL(request.url);
      if (!url.pathname.startsWith(base)) return new Response('Not here.', { status: 404 });
      const path = url.pathname.slice(base.length) || '/';
      const own = await options.storage.serve?.(request, path);
      if (own) return own;

      if (path.startsWith('/links/')) return await viaLink(path, url, request);

      const user = linkUsers.get(request) ?? (await options.identify(request));
      if (!user) throw new Refused(401, 'signed-out', 'Sign in first.');
      const via = throughLinks.get(user);
      askedBy.set(request, user.id);
      await throttle('requests', user.id);
      const context = (): Context => ({ by: user.id, at: now() });
      const body = async <T>(): Promise<T> => {
        if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) throw new Refused(413, 'too-large', 'Too much to read.');
        try {
          return (await request.json()) as T;
        } catch {
          throw new Refused(400, 'bad-body', 'The body is not JSON.');
        }
      };
      const route = routeOf(request.method, path);
      // Through a link that lets files in: a file put in its folder, and nothing else.
      if (via && !['POST /uploads', 'POST /uploads/finish', 'POST /uploads/resume', 'POST /uploads/abort'].includes(route))
        throw new Refused(403, 'forbidden', 'A link puts files in, and does nothing else.');
      const id = decodeURIComponent(/^\/entries\/([^/]+)/.exec(path)?.[1] ?? '');
      const versionId = decodeURIComponent(/\/versions\/([^/]+)/.exec(path)?.[1] ?? '');
      const shareWith = decodeURIComponent(/\/shares\/([^/]+)/.exec(path)?.[1] ?? '');
      const linkId = decodeURIComponent(/\/links\/([^/]+)/.exec(path)?.[1] ?? '');
      const commentId = decodeURIComponent(/\/comments\/([^/]+)/.exec(path)?.[1] ?? '');

      switch (route) {
        case 'GET /events':
          if (!poll) throw new Refused(404, 'no-route', 'This server does not tell changes as they happen.');
          return watch(user, request.signal);
        case 'GET /entries': {
          const asked = url.searchParams.get('folder') || null;
          const drive = await load({ ids: [asked], children: [asked], owners: topOf(user.id) });
          const folder = folderOf(drive, asked);
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
        case 'GET /entries/:id/activity': {
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          await allow(user, 'read', entry, drive);
          const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
          return Response.json({ activity: await activity(id, limit) });
        }
        case 'GET /entries/:id': {
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          await allow(user, 'read', entry, drive);
          return Response.json({ entry, path: await pathOf(user, drive, core.ancestors(drive, id)), trashed: core.isTrashed(drive, id) });
        }
        case 'GET /recent': {
          const drive = await load(await find.recent(user.id, 100));
          return Response.json({ entries: await readable(user, core.recent(drive), drive) });
        }
        case 'GET /fields': {
          const name = url.searchParams.get('name') ?? '';
          const value = url.searchParams.get('value') ?? '';
          if (!core.FIELD_NAME.test(name)) throw new Refused(400, 'invalid-field', `"${name}" is not a name of a field.`);
          const drive = await load(await find.withField(name, value, 1000));
          const entries = [...drive.entries.values()].filter((entry) => entry.fields?.[name] === value && !core.isTrashed(drive, entry.id)).slice(0, 200);
          return Response.json({ entries: await readable(user, entries, drive) });
        }
        case 'GET /starred': {
          // Each person's own, kept as a setting; what is gone, in the trash or no longer theirs to read is left out.
          const ids = starredOf(await getSetting(`starred:${user.id}`));
          const drive = await load({ ids });
          const entries = ids.flatMap((one) => {
            const entry = drive.entries.get(one);
            return entry && !core.isTrashed(drive, one) ? [entry] : [];
          });
          return Response.json({ entries: await readable(user, entries, drive) });
        }
        case 'PUT /entries/:id/star':
        case 'DELETE /entries/:id/star': {
          const drive = await load({ ids: [id] });
          await allow(user, 'read', core.getEntry(drive, id), drive);
          const ids = starredOf(await getSetting(`starred:${user.id}`)).filter((one) => one !== id);
          const next = request.method === 'PUT' ? [id, ...ids].slice(0, MAX_STARRED) : ids;
          await setSetting(`starred:${user.id}`, next);
          return Response.json({ starred: request.method === 'PUT' });
        }
        case 'GET /trash': {
          const drive = await load(await find.trashed({ user: user.id }));
          // One's own trash: what one owns or put there, not what others threw away in a folder shared with them.
          return Response.json({ entries: await readable(user, core.trash(drive, user.id), drive) });
        }
        case 'GET /shared': {
          const drive = await load(await find.sharedWith(core.shareNamesOf(user)));
          return Response.json({ entries: await readable(user, core.sharedWith(drive, user), drive) });
        }
        case 'GET /shared/new': {
          const drive = await load(await find.sharedWith(core.shareNamesOf(user)));
          const since = (await getSetting(`seen-shared:${user.id}`)) as string | undefined;
          return Response.json({ count: (await readable(user, core.sharedSince(drive, user, since), drive)).length });
        }
        case 'GET /admin/usage': {
          await allow(user, 'configure', null, await load({}));
          // The whole drive, read once: for who looks after it, now and then.
          const people = core.usageByOwner(await options.metadata.load());
          const total = people.reduce((sum, one) => ({ files: sum.files + one.files, folders: sum.folders + one.folders, bytes: sum.bytes + one.bytes }), { files: 0, folders: 0, bytes: 0 });
          return Response.json({ people, total, quota: (await driveSettings()).quota });
        }
        case 'GET /admin/activity': {
          await allow(user, 'configure', null, await load({}));
          const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 100) || 100));
          const lines = options.metadata.activityLatest ? await options.metadata.activityLatest(limit) : ownActivity.slice(-limit).reverse();
          return Response.json({ activity: lines });
        }
        case 'GET /notifications': {
          // One's own, and those of each group one is in, as `identify` says now.
          const names = core.shareNamesOf(user).filter((name) => name !== '*');
          const all = (await Promise.all(names.map(async (name) => core.noticesOf(await getSetting(`inbox:${name}`)))))
            .flat()
            .filter((notice) => notice.by !== user.id)
            .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
            .slice(0, 50);
          const seen = (await getSetting(`inbox-seen:${user.id}`)) as string | undefined;
          return Response.json({ notifications: all, unseen: all.filter((notice) => seen === undefined || notice.at > seen).length });
        }
        case 'POST /notifications/seen':
          await setSetting(`inbox-seen:${user.id}`, now());
          return Response.json({ ok: true });
        case 'POST /shared/seen':
          await setSetting(`seen-shared:${user.id}`, now());
          return Response.json({ ok: true });
        case 'GET /search': {
          const within = url.searchParams.get('within') || undefined;
          const drive = await load({ ...(await find.named(url.searchParams.get('q') ?? '', 2000)), ids: [within] });
          const found = core.search(drive, url.searchParams.get('q') ?? '', { within, trashed: url.searchParams.get('trashed') === '1', limit: 200 });
          return Response.json({ entries: await readable(user, found, drive) });
        }
        case 'GET /search/text': {
          await throttle('searchText', user.id);
          // Files by what is written in them, as it is now: the text of a version gone by is not theirs any more.
          const q = url.searchParams.get('q') ?? '';
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
          const texts = await findText(q, limit * 4);
          const drive = await load({ ids: texts.map((kept) => kept.id) });
          const found: { entry: Entry; snippet: string }[] = [];
          for (const kept of texts) {
            if (found.length >= limit) break;
            const entry = drive.entries.get(kept.id);
            if (entry?.kind !== 'file' || entry.versions[0].id !== kept.version || core.isTrashed(drive, entry.id)) continue;
            const match = core.textMatch(kept.text, q);
            if (match && (await may(user, 'read', entry, drive))) found.push({ entry, snippet: match.snippet });
          }
          return Response.json({ results: found });
        }
        case 'PUT /entries/:id/placeholder':
          return Response.json(
            await change(
              async (drive) => {
                const asked = await body<{ version?: string; placeholder?: string }>();
                const file = core.getFile(drive, id);
                await allow(user, 'upload', file, drive);
                const next = core.setPlaceholder(drive, id, String(asked.version ?? ''), String(asked.placeholder ?? ''));
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );
        case 'PUT /entries/:id/text': {
          const asked = await body<{ version?: string; text?: string }>();
          const drive = await load({ ids: [id] });
          const file = core.getFile(drive, id);
          await allow(user, 'upload', file, drive);
          if (asked.version !== file.versions[0].id) throw new Refused(409, 'not-current', 'The text of a file is that of the version it is now.');
          if (typeof asked.text !== 'string') throw new Refused(400, 'bad-text', 'Say the text, as a string.');
          await keepText(file.id, file.versions[0].id, asked.text.slice(0, TEXT_KEPT));
          return Response.json({ ok: true });
        }
        case 'GET /usage': {
          const drive = await load(await find.owned(user.id));
          return Response.json({ used: core.usageOf(drive, user.id), quota: (await driveSettings()).quota });
        }

        case 'GET /settings': {
          const drive = await load({});
          const kept = await getSetting('drive');
          const settings = core.readDriveSettings(kept, defaults);
          const mine = core.readPersonalSettings(await getSetting(`person:${user.id}`));
          return Response.json({
            drive: settings,
            mine,
            settings: core.settingsFor(settings, mine),
            canConfigure: await may(user, 'configure', null, drive),
            saved: kept !== undefined || options.settings !== undefined,
            you: user.id,
            can: { remind: !!options.reminders, expiring: options.expiring !== false },
          });
        }

        case 'PUT /settings': {
          const asked = await body<unknown>();
          await allow(user, 'configure', null, await load({}));
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
            await change(
              async (drive) => {
                await allow(user, 'create', folderOf(drive, asked.parent), drive);
                const folderId = newId();
                const next = core.createFolder(drive, { id: folderId, name: String(asked.name ?? ''), parent: asked.parent ?? null }, context());
                return { drive: next, answer: { entry: core.getEntry(next, folderId) } };
              },
              user.id,
              { ids: [asked.parent], children: [asked.parent ?? null], owners: topOf(user.id) },
            ),
          );
        }

        case 'POST /uploads': {
          await throttle('uploads', user.id);
          const asked = await body<{
            name?: string;
            parent?: EntryId | null;
            file?: EntryId;
            type?: string;
            size: number;
            sha256?: string;
            rendition?: { file: EntryId; version: string; size: number; width: number; height: number };
            partHashes?: unknown;
            madeHere?: unknown;
          }>();
          const size = Number(asked.size);
          if (!Number.isSafeInteger(size) || size < 0) throw new Refused(400, 'bad-size', 'Say the size of the file, in bytes.');
          if (size > maxSize) throw new Refused(413, 'too-large', `Files up to ${maxSize} bytes.`);
          const type = /^[\w.+-]+\/[\w.+-]+$/.test(asked.type ?? '') ? asked.type! : 'application/octet-stream';
          const drive = await load({ ids: [asked.rendition?.file, asked.file, asked.parent, via?.root.id] });
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
            return Response.json({ token: sealToken(options.secret, made, UPLOAD_LIFE), parts: plan.parts, ...(plan.etags === false ? { etags: false } : {}) });
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
            // Through a link, into its folder unless a folder inside it is said.
            const parent = via && !asked.parent ? via.root : folderOf(drive, asked.parent);
            await allow(user, 'upload', parent, drive);
            if (parent && core.isTrashed(drive, parent.id)) throw new Refused(409, 'in-trash', 'That folder is in the trash.');
            // What a request asks of what is sent through it, said before anything goes.
            let item: core.RequestItem | undefined;
            let answers: Record<string, string> | undefined;
            if (via) {
              const request = via.link.request;
              if (request?.askName && !via.from) throw new Refused(400, 'name-needed', 'Say who you are first.');
              if (!core.accepts(request, name, type)) throw new Refused(415, 'not-accepted', `This request takes ${request!.accept!.join(', ')}.`);
              if (request?.maxSize !== undefined && size > request.maxSize) throw new Refused(413, 'too-large', `Files up to ${bytes(request.maxSize)} here.`);
              if (request?.maxFiles !== undefined && (via.link.got?.files ?? 0) >= request.maxFiles) throw new Refused(409, 'request-full', 'This request has all the files it takes.');
              if (via.item) {
                item = request?.items?.find((one) => one.id === via.item);
                if (!item) throw new Refused(400, 'no-item', 'This request does not ask for that document.');
              }
              if (via.expires && (!item?.expires || !/^\d{4}-\d{2}-\d{2}$/.test(via.expires) || !core.isDate(via.expires)))
                throw new Refused(400, 'bad-expires', 'Say until when it is good as a date, of a document that asks it.');
              try {
                answers = core.answersTo(request, via.answers ?? {});
              } catch (error) {
                throw new Refused(400, 'answers-missing', (error as Error).message);
              }
            }
            pending = {
              versionId,
              size,
              type,
              user: user.id,
              file: { id: newId(), name, parent: parent?.id ?? null },
              ...(via
                ? {
                    owner: via.owner,
                    link: via.link.id,
                    ...(via.from ? { from: via.from } : {}),
                    ...(item ? { item: { id: item.id, label: item.label } } : {}),
                    ...(via.expires ? { expires: via.expires } : {}),
                    ...(answers && Object.keys(answers).length ? { answers } : {}),
                  }
                : {}),
            };
          }
          if (options.beforeUpload) {
            const of = pending.of ? core.getFile(drive, pending.of) : undefined;
            const asked: UploadAsked = {
              user,
              purpose: of ? 'version' : 'file',
              name: of?.name ?? pending.file!.name,
              type,
              size,
              parent: folderOf(drive, of ? of.parent : pending.file!.parent) as core.FolderEntry | null,
              ...(of ? { file: of } : {}),
            };
            if ((await options.beforeUpload(asked, drive)) === false) throw new Refused(403, 'upload-refused', `${asked.name} may not be uploaded here.`);
          }
          // Room in the space of whoever owns it: one's own for a new file, the owner's for a version of theirs.
          const quota = (await driveSettings()).quota;
          if (quota !== null) {
            const owner = pending.of ? core.getEntry(drive, pending.of).owner : (pending.owner ?? user.id);
            const used = core.usageOf(await load(await find.owned(owner)), owner);
            if (used + size > quota) throw new Refused(413, 'over-quota', `There is no room for it: ${bytes(used)} of ${bytes(quota)} are used, and it is ${bytes(size)}.`);
          }
          if (typeof asked.sha256 === 'string' && /^[0-9a-f]{64}$/.test(asked.sha256)) pending.sha256 = asked.sha256;
          if (Array.isArray(asked.madeHere)) pending.madeHere = asked.madeHere.filter((made): made is MadeHere => made === 'pictures' || made === 'text');
          // The hashes of its parts, one for each as they are cut here, or none.
          const layout = partsOf(size);
          const hashes =
            Array.isArray(asked.partHashes) && asked.partHashes.length === layout.length && asked.partHashes.every((h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h))
              ? (asked.partHashes as string[])
              : null;
          if (hashes) pending.parts = { size: partSizeOf(size), hashes };
          const key = `${pending.of ?? pending.file!.id}/${versionId}`;
          const plan = await options.storage.startUpload(key, type, size, base);
          // Of a new version, the parts the one before has the same, of the same length, copied in the storage: not sent.
          const was = pending.of ? core.getFile(drive, pending.of).versions[0] : undefined;
          let copied = new Set<number>();
          if (hashes && was?.parts && was.parts.size === pending.parts!.size && layout.length > 1 && options.storage.copyPart) {
            const same = layout.filter((part, i) => was.parts!.hashes[i] === hashes[i] && Math.min(was.size, part.from + was.parts!.size) - part.from === part.to - part.from);
            try {
              await Promise.all(same.map((part) => options.storage.copyPart!(was.key, key, plan.state, part)));
              copied = new Set(same.map((part) => part.number));
              if (copied.size) pending.copied = true;
            } catch (error) {
              // Sent whole, then: a copy that fails is a part to send, not an upload refused.
              log.warn('Parts could not be copied from the version before; they are sent.', error);
              copied = new Set();
            }
          }
          return Response.json({
            token: sealToken(options.secret, { ...pending, key, state: plan.state } satisfies Pending, UPLOAD_LIFE),
            parts: plan.parts.filter((part) => !copied.has(part.number)),
            ...(copied.size ? { copied: [...copied] } : {}),
            ...(plan.etags === false ? { etags: false } : {}),
          });
        }

        case 'POST /uploads/finish': {
          const asked = await body<{ token: string; parts: FinishedPart[] }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          let parts = Array.isArray(asked.parts) ? asked.parts.map((part) => ({ number: Number(part.number), etag: String(part.etag) })) : [];
          // The parts copied from the version before, as the storage has them: those the page sent go over them.
          if (pending.copied && options.storage.resumeUpload) {
            const there = await options.storage.resumeUpload(pending.key, pending.state, pending.size, base);
            const sent = new Set(parts.map((part) => part.number));
            parts = [...parts, ...there.done.filter((part) => !sent.has(part.number))];
          }
          try {
            await options.storage.finishUpload(pending.key, pending.state, parts, pending.size);
          } catch (error) {
            // An upload that cannot be finished is given up, so its parts do not wait in the bucket for a lifecycle rule.
            await options.storage.abortUpload(pending.key, pending.state, pending.size).catch(() => undefined);
            throw error;
          }
          if (options.inspect) await inspected(pending, user);
          const version = { id: pending.versionId, key: pending.key, size: pending.size, ...(pending.sha256 ? { sha256: pending.sha256 } : {}), ...(pending.parts ? { parts: pending.parts } : {}) };
          // Of what came through a request, a file its owner has already, of the same bytes: the first of them they may read.
          const same =
            pending.link && pending.owner && pending.sha256 && options.duplicates !== false
              ? await (async () => {
                  const drive = await load(await find.withHashes([pending.sha256!]));
                  const files = (core.filesByHash(drive, [pending.sha256!]).get(pending.sha256!) ?? []).filter((file) => !core.isTrashed(drive, file.id));
                  return (await readable({ id: pending.owner! }, files, drive))[0]?.id;
                })().catch((error) => (log.warn('The same bytes could not be looked for:', error), undefined))
              : undefined;
          const kept = await change(
            async (drive) => {
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
              const file = { ...pending.file! };
              await allow(user, 'upload', folderOf(drive, file.parent), drive);
              let next = drive;
              const link = pending.link ? core.linkOf(drive, pending.link) : undefined;
              const request = link?.request;
              if (link) {
                if (request?.maxFiles !== undefined && (link.got?.files ?? 0) >= request.maxFiles) throw new Refused(409, 'request-full', 'This request has all the files it takes.');
                // A folder of their own for each who sends, inside the link's, made with the first they send.
                if (request?.perSender && pending.from) {
                  const name = pending.from.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
                  const theirs = core.children(drive, file.parent).find((entry) => entry.kind === 'folder' && core.sameName(entry.name, name));
                  if (theirs) file.parent = theirs.id;
                  else {
                    const made = newId();
                    next = core.createFolder(next, { id: made, name, parent: file.parent, owner: pending.owner }, context());
                    file.parent = made;
                  }
                  // What they wrote, on their folder too: theirs, the last said.
                  if (pending.answers) next = core.setFields(next, file.parent, pending.answers, context());
                }
                file.name = core.renamed(request, { name: file.name, item: pending.item?.label, from: pending.from, at: now() });
              }
              next = core.addFile(next, { ...file, type: pending.type, version, ...(pending.owner ? { owner: pending.owner } : {}) }, context());
              // Who sent it through a link, as they said; what it is of the request; the application's fields of it.
              if (link) {
                next = core.setFields(
                  next,
                  file.id,
                  {
                    ...pending.answers,
                    ...request?.fields,
                    via: 'request',
                    request: link.id,
                    ...(pending.from ? { from: pending.from } : {}),
                    ...(pending.item ? { item: pending.item.label } : {}),
                    ...(pending.expires ? { expires: pending.expires } : {}),
                    ...(same ? { same } : {}),
                  },
                  context(),
                );
                next = core.receivedThrough(next, link.id, { at: now(), item: pending.item?.id, from: pending.from });
              }
              return { drive: next, answer: { entry: core.getEntry(next, file.id) } };
            },
            user.id,
            pending.file ? { ids: [pending.file.parent], children: [pending.file.parent], owners: topOf(user.id) } : { ids: [pending.of ?? pending.rendition?.of] },
          );
          // What the page does not make of it, made after the answer: its pictures, what is written in it.
          if (!pending.rendition) toDerive(kept.entry.id, pending.versionId, pending.madeHere ?? []);
          // The owner told of a file that came through a link of theirs; whoever sent it given what takes it back a while.
          if (pending.owner && pending.file) {
            await notify(pending.owner, { kind: 'received', entry: kept.entry.id, name: kept.entry.name, by: pending.from ?? user.id });
            if (options.onReceived)
              void Promise.resolve()
                .then(async () => {
                  const drive = await load({ ids: [kept.entry.id] });
                  const link = pending.link ? core.linkOf(drive, pending.link) : undefined;
                  return options.onReceived!({ entry: kept.entry as core.FileEntry, from: pending.from, item: pending.item?.label, request: link?.request, got: link?.got });
                })
                .catch((error) => log.error('onReceived failed:', error));
            const receipt = sealToken(options.secret, { purpose: 'receipt', file: kept.entry.id, link: pending.link } satisfies ReceiptToken, RECEIPT_LIFE);
            return Response.json({ ...kept, receipt });
          }
          return Response.json(kept);
        }

        case 'POST /uploads/resume': {
          const asked = await body<{ token: string }>();
          const pending = openToken<Pending>(options.secret, String(asked.token ?? ''));
          if (!pending || pending.user !== user.id) throw new Refused(403, 'bad-token', 'That upload is not yours, or it is out of date.');
          if (!options.storage.resumeUpload) throw new Refused(501, 'no-resume', 'This storage cannot go on with an upload: start it again.');
          if (await finished(pending)) throw new Refused(409, 'upload-finished', 'That upload is finished already.');
          try {
            const plan = await options.storage.resumeUpload(pending.key, pending.state, pending.size, base);
            const left = plan.parts.reduce((sum, part) => sum + part.to - part.from, 0);
            return Response.json({ token: asked.token, done: plan.done, parts: plan.parts, sent: pending.size - left, ...(options.storage.label.startsWith('azure://') ? { etags: false } : {}) });
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
          const kept = await finished(pending);
          if (!kept) await options.storage.abortUpload(pending.key, pending.state, pending.size);
          return Response.json({ aborted: !kept });
        }

        case 'POST /entries/:id/copy': {
          const asked = await body<{ parent?: EntryId | null }>();
          const before = await load(both(await around(id), asked.parent ? { ids: [asked.parent] } : {}));
          const source = core.getFile(before, id);
          await allow(user, 'download', source, before);
          // Beside it, where one may put a file; else at one's own top, as a file shared to read is copied.
          let parent = asked.parent !== undefined ? asked.parent : source.parent;
          if (asked.parent === undefined && !(await may(user, 'upload', folderOf(before, parent), before))) parent = null;
          const current = source.versions[0];
          const quota = (await driveSettings()).quota;
          if (quota !== null) {
            const used = core.usageOf(await load(await find.owned(user.id)), user.id);
            if (used + current.size > quota) throw new Refused(413, 'over-quota', `There is no room for it: ${bytes(used)} of ${bytes(quota)} are used, and it is ${bytes(current.size)}.`);
          }
          const copyId = newId();
          const versionId = newId();
          const made: string[] = [];
          const copyBytes = async (from: string, to: string, size: number, type: string) => {
            if (options.storage.copy) await options.storage.copy(from, to, size, type);
            else if (options.storage.read && options.storage.write && size <= COPY_THROUGH) await options.storage.write(to, await options.storage.read(from), type);
            else throw new Refused(501, 'cannot-copy', 'This storage does not copy a file this large.');
            made.push(to);
          };
          try {
            const key = `${copyId}/${versionId}`;
            await copyBytes(current.key, key, current.size, source.type);
            const renditions = [];
            for (const rendition of current.renditions ?? []) {
              const at = `${copyId}/${versionId}@${rendition.size}`;
              await copyBytes(rendition.key, at, rendition.bytes, rendition.type);
              renditions.push({ ...rendition, key: at });
            }
            const version = {
              id: versionId,
              key,
              size: current.size,
              ...(current.sha256 ? { sha256: current.sha256 } : {}),
              ...(current.parts ? { parts: current.parts } : {}),
              ...(current.placeholder ? { placeholder: current.placeholder } : {}),
              ...(renditions.length ? { renditions } : {}),
            };
            const kept = await change(
              async (drive) => {
                await allow(user, 'upload', folderOf(drive, parent), drive);
                const next = core.copyFile(drive, id, { id: copyId, parent, version }, context());
                return { drive: next, answer: { entry: core.getEntry(next, copyId) } };
              },
              user.id,
              { ids: [id, parent], children: [parent], owners: topOf(user.id) },
            );
            // Found by what is written in it, as the file it was copied from.
            const text = (await options.metadata.textOf?.(id)) ?? ownTexts.get(id);
            if (text?.version === current.id) await keepText(copyId, versionId, text.text);
            return Response.json(kept);
          } catch (error) {
            await options.storage.remove(made).catch(() => undefined);
            throw error;
          }
        }
        case 'PATCH /entries/:id': {
          const asked = await body<{ name?: string; parent?: EntryId | null; color?: core.FolderColor | null; fields?: Record<string, string | null>; ifTaken?: 'refuse' | 'keep-both' }>();
          const ifTaken = asked.ifTaken === 'keep-both' ? 'keep-both' : 'refuse';
          return Response.json(
            await change(
              async (drive) => {
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
                // A folder's colour, as one who may rename it may give it.
                if (asked.color !== undefined) {
                  await allow(user, 'rename', entry, drive);
                  next = core.setColor(next, id, asked.color);
                }
                // The application's own fields, as one who may rename it may set them.
                if (asked.fields !== undefined) {
                  await allow(user, 'rename', entry, drive);
                  next = core.setFields(next, id, asked.fields, context());
                }
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              // Where it is and, moved, where it goes: what is in each, whose names it may not take.
              async () =>
                both(await around(id), asked.parent === undefined ? {} : { ids: [asked.parent], children: [asked.parent], owners: topOf((await options.metadata.scoped?.entries([id]))?.[0]?.owner) }),
            ),
          );
        }

        case 'POST /entries/:id/trash':
        case 'POST /entries/:id/restore': {
          const action = route.endsWith('trash') ? 'trash' : 'restore';
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, action, core.getEntry(drive, id), drive);
                const next = action === 'trash' ? core.moveToTrash(drive, id, context()) : core.restore(drive, id, context());
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              // Put in the trash, what is under it, for a hold; restored, the top as well, where it goes when its folder is not there.
              async () => {
                const near = await around(id, true);
                return action === 'restore' ? both(near, { children: [null], owners: near.owners }) : near;
              },
            ),
          );
        }

        case 'DELETE /entries/:id':
        case 'POST /trash/empty': {
          const gone = await change(
            async (drive) => {
              if (id) {
                for (const entry of core.subtree(drive, id)) await allow(user, 'delete', entry, drive);
                const removed = core.deleteForever(drive, id, await keeping());
                return { drive: removed.drive, answer: removed };
              }
              // One's own trash, as it is listed: others' things in it are theirs to empty. What is kept stays in it.
              for (const entry of core.trash(drive, user.id)) for (const inside of core.subtree(drive, entry.id)) await allow(user, 'delete', inside, drive);
              const removed = core.emptyTrash(drive, user.id, await keeping());
              return { drive: removed.drive, answer: removed };
            },
            user.id,
            id ? { subtrees: [id] } : () => find.trashed({ user: user.id }),
          );
          await forgetComments(gone.removed);
          // The entries are gone first: bytes left behind by a failure here cost space, not a file that points nowhere.
          await options.storage.remove(gone.keys);
          return Response.json({ removed: gone.removed });
        }

        case 'GET /entries/:id/download': {
          const drive = await load({ ids: [id] });
          const file = core.getFile(drive, id);
          await allow(user, 'download', file, drive);
          const wanted = url.searchParams.get('version');
          const size = url.searchParams.has('size') ? Number(url.searchParams.get('size')) : undefined;
          return Response.json(await addressOf(file, url.searchParams.get('inline') === '1', size, wanted ?? undefined));
        }

        case 'POST /zip': {
          await throttle('zip', user.id);
          const asked = await body<{ ids?: unknown }>();
          const ids = Array.isArray(asked.ids) ? asked.ids.filter((id): id is string => typeof id === 'string') : [];
          const drive = await load({ subtrees: ids.slice(0, URLS_AT_ONCE) });
          // Each entry that would go in it asked about, as reading it would be: a folder to be listed, a file to be downloaded.
          const candidates = new Map<EntryId, Entry>();
          for (const id of ids) if (drive.entries.has(id)) for (const entry of core.subtree(drive, id)) candidates.set(entry.id, entry);
          if (candidates.size > ZIP_AT_ONCE) throw new Refused(413, 'too-many', `Up to ${ZIP_AT_ONCE} files and folders in one archive.`);
          const allowed = new Set<EntryId>();
          await Promise.all([...candidates.values()].map(async (entry) => (await may(user, entry.kind === 'file' ? 'download' : 'list', entry, drive)) && allowed.add(entry.id)));
          return Response.json(core.packOf(drive, ids, (entry) => allowed.has(entry.id)));
        }

        case 'POST /duplicates': {
          // What is in the drive already with the same bytes, among what the one asking may read, for each hash asked.
          const asked = await body<{ hashes?: unknown }>();
          const hashes = (Array.isArray(asked.hashes) ? asked.hashes : []).filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)).slice(0, URLS_AT_ONCE);
          const drive = await load(await find.withHashes(hashes));
          const found: Record<string, Entry[]> = {};
          for (const [hash, files] of core.filesByHash(drive, hashes)) {
            const seen = await readable(user, files, drive);
            if (seen.length) found[hash] = seen;
          }
          return Response.json({ found });
        }
        case 'POST /urls': {
          const asked = await body<{ ids?: unknown; inline?: boolean; size?: number }>();
          const ids = Array.isArray(asked.ids) ? asked.ids.filter((id): id is string => typeof id === 'string') : [];
          if (ids.length > URLS_AT_ONCE) throw new Refused(400, 'too-many', `Up to ${URLS_AT_ONCE} at once.`);
          const drive = await load({ ids });
          const size = typeof asked.size === 'number' ? asked.size : undefined;
          const urls: Record<string, Address> = {};
          // Each as its own route would answer it; one that may not be read, or is not a file, is left out.
          await Promise.all(
            [...new Set(ids)].map(async (id) => {
              const entry = drive.entries.get(id);
              if (entry?.kind !== 'file' || !(await may(user, 'download', entry, drive))) return;
              urls[id] = await addressOf(entry, asked.inline === true, size);
            }),
          );
          return Response.json({ urls });
        }

        case 'POST /entries/:id/shares': {
          const asked = await body<{ with: string; role: Role; days?: number | null }>();
          const who = String(asked.with ?? '');
          // Days it lasts; null for good; left out, as it was shared before.
          const days = asked.days === undefined || asked.days === null ? asked.days : Number(asked.days);
          if (typeof days === 'number' && !(days > 0 && days <= 3650)) throw new Refused(400, 'invalid-share', 'A share lasts from a day to ten years, or for good.');
          const until = typeof days === 'number' ? new Date(Date.parse(now()) + days * 86_400_000).toISOString() : days;
          let first = false;
          const answer = await change(
            async (drive) => {
              await allow(user, 'share', core.getEntry(drive, id), drive);
              first = !core.getEntry(drive, id).shares?.some((s) => s.with === who);
              const next = core.share(drive, id, who, asked.role, context(), until);
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            },
            user.id,
            { ids: [id] },
          );
          const before = answer.entry.shares?.find((s) => s.with === who);
          if (first && before) await notify(who, { kind: 'shared', entry: id, name: answer.entry.name, by: user.id, role: before.role });
          if (options.onShare && before)
            void Promise.resolve()
              .then(() => options.onShare!({ entry: answer.entry, with: who, role: before.role, by: user, first }))
              .catch((error) => log.error('onShare failed:', error));
          return Response.json(answer);
        }
        case 'DELETE /entries/:id/shares/:with':
          return Response.json(
            await change(
              async (drive) => {
                // Anyone may leave what was shared with them; only who may share may take it from someone else.
                if (shareWith !== user.id) await allow(user, 'share', core.getEntry(drive, id), drive);
                const next = core.unshare(drive, id, shareWith);
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );

        case 'POST /entries/:id/links': {
          const asked = await body<{ days?: number; password?: string; once?: boolean; uploads?: 'also' | 'only'; request?: unknown; viewOnly?: boolean; watermark?: boolean }>();
          const days = asked.days === undefined ? 7 : Number(asked.days);
          const request = asked.uploads && asked.request !== undefined ? core.readRequest(asked.request) : undefined;
          if (!(days > 0 && days <= LINK_DAYS)) throw new Refused(400, 'bad-days', `A link lasts from a day to ${LINK_DAYS} days.`);
          const password = typeof asked.password === 'string' && asked.password ? asked.password : undefined;
          if (password && password.length < 4) throw new Refused(400, 'bad-password', 'A password of four characters or more.');
          const made = {
            id: newId(),
            expires: new Date(Date.parse(now()) + days * 86_400_000).toISOString(),
            locked: !!password,
            uses: asked.once ? 1 : undefined,
            ...(asked.uploads ? { uploads: asked.uploads } : {}),
            ...(request ? { request } : {}),
            ...(asked.viewOnly === true ? { viewOnly: true } : {}),
            ...(asked.watermark === true ? { watermark: true } : {}),
          };
          // Kept before the link is there, so it is never there without it.
          if (password) await setSetting(`link:${made.id}`, await sealPassword(password));
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, 'share', core.getEntry(drive, id), drive);
                const next = core.addLink(drive, id, made, context());
                return { drive: next, answer: { entry: core.getEntry(next, id), token: linkToken(made) } };
              },
              user.id,
              { ids: [id] },
            ),
          );
        }
        case 'PATCH /entries/:id/links/:link': {
          const asked = await body<{ days?: number; uploads?: 'also' | 'only'; request?: unknown; closed?: boolean }>();
          const days = asked.days === undefined ? undefined : Number(asked.days);
          if (days !== undefined && !(days > 0 && days <= LINK_DAYS)) throw new Refused(400, 'bad-days', `A link lasts from a day to ${LINK_DAYS} days.`);
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, 'share', core.getEntry(drive, id), drive);
                const at = now();
                const next = core.updateLink(
                  drive,
                  id,
                  linkId,
                  {
                    ...(days ? { expires: new Date(Date.parse(at) + days * 86_400_000).toISOString() } : {}),
                    ...(asked.uploads ? { uploads: asked.uploads } : {}),
                    ...(asked.request !== undefined ? { request: core.readRequest(asked.request) } : {}),
                    ...(asked.closed === true ? { closed: at } : asked.closed === false ? { closed: null } : {}),
                  },
                  at,
                );
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );
        }
        case 'PUT /entries/:id/review': {
          const asked = await body<{ status?: 'accepted' | 'rejected' | null; reason?: string }>();
          const status = asked.status === 'accepted' || asked.status === 'rejected' ? asked.status : null;
          const reason = status === 'rejected' && typeof asked.reason === 'string' ? asked.reason.trim().slice(0, 500) : '';
          const kept = await change(
            async (drive) => {
              await allow(user, 'rename', core.getEntry(drive, id), drive);
              const next = core.setFields(drive, id, { review: status, reviewReason: reason || null }, context());
              return { drive: next, answer: { entry: core.getEntry(next, id) } };
            },
            user.id,
            { ids: [id] },
          );
          if (options.onReview)
            void Promise.resolve(options.onReview({ entry: kept.entry, status, ...(reason ? { reason } : {}), from: kept.entry.fields?.from, by: user })).catch((error) =>
              log.error('onReview failed:', error),
            );
          return Response.json(kept);
        }
        case 'GET /received': {
          // What came through requests for files, of what the one asking may read, the newest first.
          const drive = await load(await find.withField('via', 'request', 2000));
          const entries = [...drive.entries.values()]
            .filter((entry) => entry.fields?.via === 'request' && !core.isTrashed(drive, entry.id))
            .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0))
            .slice(0, 500);
          return Response.json({ entries: await readable(user, entries, drive) });
        }
        case 'GET /requests': {
          // One's own requests for files: the folders one owns whose links take files.
          const drive = await load(await find.owned(user.id));
          const requests = [...drive.entries.values()]
            .filter((entry) => entry.owner === user.id && !core.isTrashed(drive, entry.id))
            .flatMap((entry) => (entry.links ?? []).filter((link) => link.uploads).map((link) => ({ folder: { id: entry.id, name: entry.name }, link, token: linkToken(link) })))
            .sort((a, b) => (a.link.at < b.link.at ? 1 : -1));
          return Response.json({ requests });
        }
        case 'GET /admin/requests': {
          await allow(user, 'configure', null, await load({}));
          // Every request for files, for the application to remind whom each was sent to of what is missing before it ends.
          const drive = await options.metadata.load();
          const at = now();
          const requests = [...drive.entries.values()].flatMap((entry) =>
            (entry.links ?? [])
              .filter((link) => link.uploads && link.request && !link.closed && link.expires > at && !core.isTrashed(drive, entry.id))
              .map((link) => ({ folder: { id: entry.id, name: entry.name, owner: entry.owner }, link, token: linkToken(link), missing: core.missingOf(link) })),
          );
          return Response.json({ requests });
        }
        case 'POST /entries/:id/links/:link/remind': {
          if (!options.reminders) throw new Refused(409, 'no-reminders', 'This drive sends no reminders.');
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          await allow(user, 'share', entry, drive);
          const link = entry.links?.find((l) => l.id === linkId);
          if (!link) throw new Refused(404, 'no-link', 'There is no such link.');
          if (!link.request?.email) throw new Refused(409, 'no-email', 'This request was sent to no email.');
          if (link.closed || !(link.expires > now())) throw new Refused(409, 'closed', 'This request is closed.');
          return Response.json(await remind(entry, link));
        }
        case 'GET /expiring': {
          const field = expiringField();
          if (!field) return Response.json({ files: [] });
          const days = Math.min(3650, Math.max(0, Number(url.searchParams.get('days') ?? (options.expiring || undefined)?.days ?? 15) || 0));
          const scope = await find.withFieldUpTo(field, new Date(Date.parse(now()) + days * 86_400_000).toISOString().slice(0, 10), 2000);
          if (!scope) return Response.json({ files: [] });
          const drive = await load(scope);
          const soon = core.expiringWithin(
            [...drive.entries.values()].filter((entry) => !core.isTrashed(drive, entry.id)),
            field,
            now(),
            days,
          );
          const mine = new Set(
            (
              await readable(
                user,
                soon.map((one) => one.entry),
                drive,
              )
            ).map((entry) => entry.id),
          );
          return Response.json({ files: soon.filter((one) => mine.has(one.entry.id)).map(({ entry, expires, days }) => ({ entry, expires, days })) });
        }
        case 'GET /entries/:id/links/:link': {
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          await allow(user, 'share', entry, drive);
          const link = entry.links?.find((l) => l.id === linkId);
          if (!link) throw new Refused(404, 'no-link', 'There is no such link.');
          return Response.json({ token: linkToken(link) });
        }
        case 'DELETE /entries/:id/links/:link':
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, 'share', core.getEntry(drive, id), drive);
                const next = core.removeLink(drive, id, linkId);
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );

        case 'GET /entries/:id/comments': {
          const drive = await load({ ids: [id] });
          await allow(user, 'read', core.getEntry(drive, id), drive);
          return Response.json({ comments: core.threads(await commentsOn(id)) });
        }
        case 'POST /entries/:id/comments': {
          const asked = await body<{ text?: unknown; replyTo?: unknown }>();
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          await allow(user, 'comment', entry, drive);
          const text = core.commentText(asked.text);
          let replyTo: string | undefined;
          if (typeof asked.replyTo === 'string' && asked.replyTo) {
            const to = await commentById(asked.replyTo);
            if (!to || to.entry !== id) throw new Refused(404, 'no-comment', 'There is no such comment here.');
            // A reply goes under the comment that starts its thread.
            replyTo = to.replyTo ?? to.id;
          }
          const comment: core.Comment = { id: newId(), entry: id, by: user.id, at: now(), text, ...(replyTo ? { replyTo } : {}) };
          await keepComment(comment);
          await saidOf(entry, user.id);
          const mentions = core.mentionsOf(text).filter((who) => who !== user.id);
          for (const who of mentions) await notify(who, { kind: 'mentioned', entry: id, name: entry.name, by: user.id, text: text.slice(0, 200) });
          if (options.onComment) void Promise.resolve(options.onComment({ comment, entry, mentions, by: user })).catch((error) => log.error('onComment failed:', error));
          return Response.json({ comment });
        }
        case 'PATCH /entries/:id/comments/:c':
        case 'DELETE /entries/:id/comments/:c': {
          const drive = await load({ ids: [id] });
          const entry = core.getEntry(drive, id);
          const comment = await commentById(commentId);
          if (!comment || comment.entry !== id) throw new Refused(404, 'no-comment', 'There is no such comment here.');
          if (request.method === 'DELETE') {
            // Its author's to take back, or the owner's, who may share it, to keep the place clean.
            if (comment.by !== user.id) await allow(user, 'share', entry, drive);
            for (const reply of await commentsOn(id)) if (reply.replyTo === comment.id) await unsay(reply.id);
            await unsay(comment.id);
            return Response.json({ removed: comment.id });
          }
          const asked = await body<{ text?: unknown; resolved?: unknown }>();
          let next = comment;
          if (asked.text !== undefined) {
            if (comment.by !== user.id) throw new Refused(403, 'forbidden', 'Only who said it may change what it says.');
            next = { ...next, text: core.commentText(asked.text), edited: now() };
          }
          if (asked.resolved !== undefined) {
            await allow(user, 'comment', entry, drive);
            const { resolved: _, ...rest } = next;
            next = asked.resolved === true ? { ...rest, resolved: { by: user.id, at: now() } } : rest;
          }
          await keepComment(next);
          return Response.json({ comment: next });
        }
        case 'PUT /entries/:id/hold':
        case 'DELETE /entries/:id/hold': {
          const asked = request.method === 'PUT' ? await body<{ reason?: string }>() : null;
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, 'configure', core.getEntry(drive, id), drive);
                const next = core.setHold(drive, id, asked ? { reason: asked.reason } : null, context());
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );
        }
        case 'GET /export': {
          // Everything of a person: what they own, at its place, as an archive holds it; what they said and did; their settings.
          const who = url.searchParams.get('user') || user.id;
          const drive = await load(both(await find.owned(who), await find.sharedWith(core.shareNamesOf(who === user.id ? user : who))));
          if (who !== user.id) await allow(user, 'configure', null, drive);
          const tops = [...drive.entries.values()].filter((entry) => entry.owner === who && (entry.parent === null || drive.entries.get(entry.parent)?.owner !== who));
          const comments = store.commentsBy ? await store.commentsBy(who) : [...ownComments.values()].filter((c) => c.by === who);
          const activity = store.activityBy ? await store.activityBy(who, 10_000) : ownActivity.filter((a) => a.by === who).reverse();
          return Response.json({
            person: who,
            at: now(),
            pack: core.packOf(
              drive,
              tops.map((entry) => entry.id),
              (entry) => entry.owner === who,
            ),
            entries: [...drive.entries.values()].filter((entry) => entry.owner === who),
            shared: core.sharedWith(drive, who === user.id ? user : who).map((entry) => entry.id),
            comments,
            activity,
            settings: core.readPersonalSettings(await getSetting(`person:${who}`)),
          });
        }
        case 'POST /entries/:id/versions/:v/restore':
          return Response.json(
            await change(
              async (drive) => {
                await allow(user, 'upload', core.getEntry(drive, id), drive);
                const next = core.restoreVersion(drive, id, versionId, newId(), context());
                return { drive: next, answer: { entry: core.getEntry(next, id) } };
              },
              user.id,
              { ids: [id] },
            ),
          );
      }
      return Response.json({ error: 'no-route', message: `No ${request.method} ${path}.` }, { status: 404 });
    } catch (error) {
      return answerTo(error, log);
    }
  };

  // A page of another origin, as a desktop application's or one of another domain: answered as the browser asks
  // first, and told it may read the answers. Only those listed; with them, cookies too, for a page that sends them.
  const origins = new Set(options.cors?.origins ?? []);
  const measured = async (request: Request): Promise<Response> => {
    if (!options.onRequest) return withOrigin(request);
    const started = performance.now();
    const answered = await withOrigin(request).catch((error) => answerTo(error, log));
    try {
      const path = new URL(request.url).pathname.slice(base.length) || '/';
      options.onRequest({ method: request.method, route: routeOf(request.method, path), status: answered.status, ms: performance.now() - started, user: askedBy.get(request) ?? null });
    } catch (error) {
      log.error('onRequest failed:', error);
    }
    return answered;
  };
  return Object.assign(measured, {
    idle: () => (derivers || deriving.length ? new Promise<void>((done) => idleWaiters.push(done)) : Promise.resolve()),
  });

  async function withOrigin(request: Request): Promise<Response> {
    const origin = request.headers.get('origin');
    const allowed = origin && origins.has(origin) ? origin : null;
    if (!allowed) return answer(request);
    const told = { 'access-control-allow-origin': allowed, 'access-control-allow-credentials': 'true', vary: 'Origin' };
    if (request.method === 'OPTIONS' && request.headers.get('access-control-request-method'))
      return new Response(null, {
        status: 204,
        headers: {
          ...told,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '',
          'access-control-max-age': '600',
        },
      });
    const answered = await answer(request);
    const headers = new Headers(answered.headers);
    for (const [name, value] of Object.entries(told)) headers.set(name, value);
    // The ETag of a part sent to the server's own storage, which the page reads to put the parts together.
    headers.set('access-control-expose-headers', 'ETag, Retry-After');
    return new Response(answered.body, { status: answered.status, statusText: answered.statusText, headers });
  }

  /** What a link reads: the entry it was made for and what is inside it, to anyone who has its address, while it lasts. */
  async function viaLink(path: string, url: URL, request: Request): Promise<Response> {
    const [, , token = '', rest] = path.split('/');
    const sealed = openToken<LinkToken>(options.secret, decodeURIComponent(token));
    // What the link is on, and what of it this request reads: a folder in it, a file, or some of it.
    const holder = sealed?.purpose === 'link' ? await find.withLink(sealed.link) : {};
    const top = holder.entries?.[0]?.id;
    const listed = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    const drive = await load(
      both(holder, {
        ids: [url.searchParams.get('folder'), url.searchParams.get('id'), ...listed],
        children: rest === undefined ? [url.searchParams.get('folder') || top] : [],
        subtrees: rest === 'zip' ? (listed.length ? listed : [top]) : [],
      }),
    );
    const root = sealed?.purpose === 'link' ? core.linked(drive, sealed.link, now()) : null;
    // A request closed, by its owner or by having all it asked for, says so: who was sending knows it is not a mistake.
    if (!root && sealed?.purpose === 'link' && core.linkOf(drive, sealed.link)?.closed) throw new Refused(410, 'request-closed', 'This request for files is closed.');
    // One answer for a link changed, out of date, taken back or in the trash: which, is not for whoever holds it.
    if (!root) throw new Refused(404, 'no-link', 'This link does not work any more.');
    const link = core.linkOf(drive, sealed!.link)!;
    await throttle('links', link.id);
    // A link with a password: asked for at every request, kept apart from the drive, compared in constant time.
    if (link.locked) {
      const given = request.headers.get('x-link-password');
      if (!given) throw new Refused(401, 'link-password', 'This link asks for its password.');
      // Wrong ones counted by the link, and by the address when it is known: past them, not even a right one is tried.
      const guesser = `${link.id}:${options.clientIp?.(request) ?? ''}`;
      await throttle('linkPassword', guesser, { peek: true });
      if (!(await passwordIs(await getSetting(`link:${link.id}`), given))) {
        await throttle('linkPassword', guesser);
        // A moment before each wrong one, against guessing.
        await new Promise((done) => setTimeout(done, 400));
        throw new Refused(401, 'link-password-wrong', 'That is not the password.');
      }
    }
    // A link that shows who sees it: their name asked for at every request, as its password is; the first look kept.
    const viewer = link.watermark ? decoded(request.headers.get('x-link-viewer') ?? '').slice(0, 100) : '';
    if (link.watermark && rest !== 'uploads' && rest !== 'sent' && !viewer) throw new Refused(401, 'link-viewer', 'Say who you are to see it.');
    if (link.watermark && viewer && rest === undefined && !url.searchParams.get('folder'))
      await change(async (current) => ({ drive: core.viewedLink(current, link.id, viewer, now()), answer: null }), 'drive', { ids: [root.id] });
    // Only to be seen: nothing of it saved through it.
    const toSave = (rest === 'download' || rest === 'urls') && url.searchParams.get('inline') !== '1';
    if (link.viewOnly && (toSave || rest === 'zip')) throw new Refused(403, 'view-only', 'This link is only to see what it shares.');
    /** One more use of a link that has a number of them: a file of it, or an archive of it, downloaded. Seeing a file in the page is not one. */
    const spend = async () => {
      if (link.uses !== undefined && (link.used ?? 0) < link.uses) await change(async (current) => ({ drive: core.useLink(current, link.id, now()), answer: null }), 'drive', { ids: [root.id] });
    };
    // A file just sent taken back by who sent it, with the receipt its upload gave them: for a few minutes.
    if (rest === 'sent' && request.method === 'DELETE') {
      const receipt = openToken<ReceiptToken>(options.secret, decodeURIComponent(path.split('/')[4] ?? ''));
      if (receipt?.purpose !== 'receipt' || receipt.link !== link.id) throw new Refused(403, 'bad-token', 'That file can no longer be taken back.');
      const keys = await change(
        async (current) => {
          const file = core.getFile(current, receipt.file);
          if (!core.isWithin(current, file.id, root.id)) throw new Refused(403, 'bad-token', 'That file can no longer be taken back.');
          const trashed = core.moveToTrash(current, file.id, { by: `link:${link.id}`, at: now() });
          let removed: { drive: Drive; keys: string[] };
          try {
            const gone = core.deleteForever(trashed, file.id, await keeping());
            removed = { drive: gone.drive, keys: gone.keys };
          } catch {
            // Kept by a rule of days or a hold: in the trash of its owner, then.
            removed = { drive: trashed, keys: [] };
          }
          const item = file.fields?.item ? link.request?.items?.find((one) => one.label === file.fields!.item)?.id : undefined;
          return { drive: core.retracted(removed.drive, link.id, item), answer: removed.keys };
        },
        `link:${link.id}`,
        { ids: [receipt.file] },
      );
      if (keys.length) await options.storage.remove(keys).catch((error) => log.error('The bytes of a file taken back could not be taken away:', error));
      return Response.json({ ok: true });
    }
    // A request for files: what is in it is not for whoever sends them.
    if (link.uploads === 'only' && rest !== undefined && rest !== 'uploads') throw new Refused(403, 'forbidden', 'This link only takes files.');
    if (rest === 'uploads') {
      if (!link.uploads || root.kind !== 'folder') throw new Refused(403, 'forbidden', 'This link does not take files.');
      await throttle('uploads', `link:${link.id}`);
      // The routes of an upload, as one who may only put files in this folder; whose they are is its owner's.
      const who: User = { id: `link:${link.id}` };
      // Sent encoded, so a name in any language goes in a header.
      const from = decoded(request.headers.get('x-link-name') ?? '').slice(0, 100);
      // What they wrote to its questions, as JSON, encoded the same.
      const answers = (() => {
        try {
          const said = JSON.parse(decoded(request.headers.get('x-link-answers') ?? '') || '{}');
          return typeof said === 'object' && said !== null && !Array.isArray(said) ? (said as Record<string, unknown>) : {};
        } catch {
          throw new Refused(400, 'bad-answers', 'What was written does not read.');
        }
      })();
      const item = (request.headers.get('x-link-item') ?? '').trim();
      const expires = (request.headers.get('x-link-expires') ?? '').trim();
      throughLinks.set(who, { root, owner: root.owner, link, answers, ...(from ? { from } : {}), ...(item ? { item } : {}), ...(expires ? { expires } : {}) });
      const sub = path.split('/')[4];
      const inner = new Request(`${url.origin}${base}/uploads${sub ? `/${sub}` : ''}`, { method: request.method, headers: request.headers, body: await request.arrayBuffer() });
      linkUsers.set(inner, who);
      return answer(inner);
    }
    const inside = (id: string | null) => {
      const entry = id ? core.getEntry(drive, id) : root;
      if (!core.isWithin(drive, entry.id, root.id) || core.isTrashed(drive, entry.id)) throw new Refused(404, 'no-link', 'That is not in what this link reads.');
      return entry;
    };
    if (rest === undefined) {
      const folder = inside(url.searchParams.get('folder'));
      const path = [...core.ancestors(drive, folder.id), folder].filter((entry) => core.isWithin(drive, entry.id, root.id));
      // What whoever opens it is told: what it takes and asks, what came of each document, whose it is, in their colour.
      const ask = link.request;
      const what = {
        uploads: link.uploads ?? null,
        ...(link.viewOnly ? { viewOnly: true } : {}),
        ...(link.watermark ? { watermark: true } : {}),
        owner: root.owner,
        expires: link.expires,
        brand: (await driveSettings()).brand,
        company: (await driveSettings()).company ?? null,
        ...(ask
          ? {
              request: {
                ...(ask.title ? { title: ask.title } : {}),
                ...(ask.message ? { message: ask.message } : {}),
                ...(ask.askName ? { askName: true } : {}),
                ...(ask.accept ? { accept: ask.accept } : {}),
                ...(ask.maxSize ? { maxSize: ask.maxSize } : {}),
                ...(ask.maxFiles ? { maxFiles: ask.maxFiles, left: Math.max(0, ask.maxFiles - (link.got?.files ?? 0)) } : {}),
                // What a document is checked for is not its sender's to read.
                ...(ask.items ? { items: ask.items.map((one) => ({ id: one.id, label: one.label, ...(one.expires ? { expires: true } : {}), received: link.got?.items?.[one.id] ?? 0 })) } : {}),
                ...(ask.questions ? { questions: ask.questions.map((one) => ({ id: one.id, label: one.label, ...(one.required ? { required: true } : {}) })) } : {}),
              },
            }
          : {}),
      };
      // A request for files sees its folder, and nothing in it.
      if (link.uploads === 'only') return Response.json({ root: bare(root), folder: bare(root), path: [bare(root)], entries: [], link: what });
      return Response.json({ root: bare(root), folder: bare(folder), path: path.map(bare), entries: folder.kind === 'folder' ? core.children(drive, folder.id).map(bare) : [], link: what });
    }
    if (rest === 'download') {
      const file = inside(url.searchParams.get('id'));
      if (file.kind !== 'file') throw new Refused(400, 'not-a-file', `${file.name} is a folder.`);
      const inline = url.searchParams.get('inline') === '1';
      if (!inline) await spend();
      return Response.json({ url: await options.storage.downloadUrl(file.versions[0].key, file.name, file.type, base, inline) });
    }
    // An archive of some of what it reads, or of all of it, and the addresses of its files a few at a time.
    const asked = () => (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    if (rest === 'zip') {
      await throttle('zip', `link:${link.id}`);
      const ids = asked().length ? asked() : [root.id];
      for (const id of ids) inside(id);
      if (ids.reduce((sum, id) => sum + core.subtree(drive, id).length, 0) > ZIP_AT_ONCE) throw new Refused(413, 'too-many', `Up to ${ZIP_AT_ONCE} files and folders in one archive.`);
      await spend();
      return Response.json(core.packOf(drive, ids, (entry) => core.isWithin(drive, entry.id, root.id)));
    }
    if (rest === 'urls') {
      const ids = asked().slice(0, URLS_AT_ONCE);
      if (url.searchParams.get('inline') !== '1') await spend();
      const urls: Record<string, Address> = {};
      for (const id of ids) {
        const entry = drive.entries.get(id);
        if (entry?.kind === 'file' && core.isWithin(drive, id, root.id) && !core.isTrashed(drive, id)) urls[id] = await addressOf(entry, url.searchParams.get('inline') === '1');
      }
      return Response.json({ urls });
    }
    throw new Refused(404, 'no-route', 'No such route.');
  }
}
