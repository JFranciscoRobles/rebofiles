// The reference of the documentation, in one place: the props of
// <FileDrive> and the options of mountDrive, the hooks, the client, the
// options of the server and the packages. The pages show it, and ⌘K finds it.
// Written from the sources (packages/drive/src/screen.ts, packages/react,
// packages/drive/src/client.ts, packages/server/src/api.ts): change them
// together.

export type PropGroup = 'Server' | 'Look' | 'Files' | 'Word documents' | 'Events';

export interface Prop {
  name: string;
  type: string;
  group: PropGroup;
  does: string;
}

/** What <FileDrive> takes, and mountDrive with it: the same, but `logo`, a Node there and a ReactNode here. */
export const PROPS: Prop[] = [
  { name: 'base', type: 'string', group: 'Server', does: 'Where the routes of @rebofiles/server are. `/api/files` unless said.' },
  { name: 'client', type: 'DriveClient', group: 'Server', does: 'A client of your own instead of `base`: the drive kept in the page (`createMemoryClient`), or one shared with the rest of the page.' },
  { name: 'headers', type: '() => Record<string, string>', group: 'Server', does: 'Headers for every request to your server, such as a token of the session; never sent to the bucket. May be async.' },
  { name: 'linkAddress', type: '(token) => string', group: 'Server', does: 'Where a link of the drive points: your page with <SharedLink>. This page with `?link=` unless given.' },
  { name: 'settings', type: 'boolean', group: 'Server', does: '`false` leaves out the screen of settings and the button that opens it.' },
  { name: 'language', type: "'en' | 'es' | 'zh'", group: 'Look', does: 'Under each person’s own choice, over the drive’s. English unless given.' },
  { name: 'texts', type: 'Texts', group: 'Look', does: 'The words of another language, with the keys of `TEXTS.en`.' },
  { name: 'theme', type: "'light' | 'dark' | 'auto'", group: 'Look', does: 'Under each person’s own choice, over the drive’s. `auto` follows the system.' },
  { name: 'title', type: 'string', group: 'Look', does: 'The name over the drive: your application’s, or “Files”.' },
  { name: 'logo', type: 'ReactNode', group: 'Look', does: 'What goes before the title; ReboFiles’ mark unless given. A Node for mountDrive.' },
  { name: 'defaultView', type: "'list' | 'grid'", group: 'Look', does: 'How a folder is shown the first time.' },
  { name: 'layout', type: "'full' | 'compact'", group: 'Look', does: '`compact`: no column on the left; New and the places in a strip over the list, for a drive in a smaller part of a page.' },
  { name: 'className', type: 'string', group: 'Look', does: 'A class of your own on `.rf-drive`, for its custom properties.' },
  {
    name: 'chrome',
    type: 'boolean',
    group: 'Look',
    does: '`false` leaves out its bar and its sections, for your application’s own around it: it drives it with `go`, `search`, `upload`, `newFolder`, `openSettings`.',
  },
  { name: 'root', type: 'EntryId', group: 'Look', does: 'The folder it is kept in, as the files of one record of yours: it starts there, its path starts there, nothing above it.' },
  {
    name: 'onState',
    type: '(state) => void',
    group: 'Look',
    does: 'Where it is, each time that changes: the section, the folder and its path, what is searched, how many, the space; for your own bar.',
  },
  { name: 'controls', type: 'RefObject<DriveControls>', group: 'Look', does: 'React: the drive’s `go`, `search`, `upload`, `newFolder` and `openSettings`, put in it while it is there.' },
  { name: 'checkUploads', type: 'boolean', group: 'Files', does: '`false` uploads without looking for the same file, or one of its name, in the drive first: a taken name is made free with “(2)”.' },
  { name: 'requestTemplates', type: 'boolean', group: 'Files', does: '`false` leaves out the templates of requests: to start one from, and to save one as.' },
  { name: 'qr', type: 'boolean', group: 'Files', does: '`false` leaves out the QR code of a request made.' },
  { name: 'onOpen', type: '(file, url) => void', group: 'Files', does: 'A file opened by a double click or Enter, your own way. Unless given, the drive’s viewer shows it.' },
  {
    name: 'fields',
    type: "'show' | 'edit' | false",
    group: 'Files',
    does: 'The fields of your application on an entry, in its details: shown (as it comes), changed there by who may rename it (`edit`), or left out.',
  },
  { name: 'previewDocument', type: '(bytes) => DocumentPreview', group: 'Word documents', does: 'The details of a .docx: its title and first paragraphs. `previewDocx`.' },
  { name: 'viewDocument', type: '(element, bytes) => ShownDocument', group: 'Word documents', does: 'The viewer of a .docx: its pages, one by one or all, with Rebodocs’ zoom and print. `viewDocx`.' },
  { name: 'thumbDocument', type: '(bytes) => Promise<HTMLElement>', group: 'Word documents', does: 'Its first page drawn in the grid, until a picture of it is made. `thumbDocx`.' },
  {
    name: 'pictureDocument',
    type: '(bytes, size, type, quality) => Promise<Blob>',
    group: 'Word documents',
    does: 'Its first page as a picture, made at upload and kept as its thumbnail in the drive’s sizes. `pictureOfDocx`.',
  },
  { name: 'textDocument', type: '(bytes) => string', group: 'Word documents', does: 'What is written in it, sent at upload, for a search to find it by. `textOfDocx`.' },
  { name: 'onOpenDocument', type: '(file, url) => void', group: 'Word documents', does: 'Gives a .docx an “Open in Rebodocs” button, called with an address to read it from.' },
  {
    name: 'compareDocument',
    type: '(element, before, after) => ShownDocument',
    group: 'Word documents',
    does: '“Compare” on each version but the current, in the history: what changed, over its pages. `compareDocx`.',
  },
  {
    name: 'newDocument',
    type: '() => Uint8Array',
    group: 'Word documents',
    does: '“New document” in the Upload menu: an empty .docx named by the person, in the folder they are in, then opened. `newDocx`.',
  },
  { name: 'onChange', type: '() => void', group: 'Events', does: 'After every change made from the drive, for what else in the page shows it (mountDrive; in React, the provider tells the hooks).' },
  { name: 'live', type: 'boolean', group: 'Events', does: 'What others change, shown as it happens, from the server’s `/events`. `true` unless said; in React, the provider’s.' },
];

export interface Hook {
  name: string;
  short: string;
  gives: string;
}

export const HOOKS: Hook[] = [
  {
    name: 'DriveProvider',
    short: 'The client and the words, for every hook under it.',
    gives: '`base`, `client`, `headers`, `language`, `texts`, `live`; a <FileDrive> inside it uses the same. Every hook asks again when someone else changes the drive.',
  },
  { name: 'useEntries', short: 'A folder, Recent, the trash, Shared with me or a search.', gives: '`entries`, `path`, `folder`, `loading`, `error`, `refresh`: asked again after every change.' },
  { name: 'useEntry', short: 'One entry as it is now, and where it is.', gives: '`entry`, `path`, `trashed`, `loading`, `error`.' },
  {
    name: 'useActions',
    short: 'What changes the drive, telling every hook after.',
    gives: '`createFolder`, `rename`, `move`, `moveToTrash`, `restore`, `deleteForever`, `emptyTrash`, `restoreVersion`, `upload`, `url`.',
  },
  {
    name: 'useUploads',
    short: 'Files going up, three at a time, with the time each has left.',
    gives: '`uploads`, `summary`, `upload`, `retry`, `stop`, `stopAll`, `decide`, `dismiss`, `clear`; `{ check: true }` to ask about what is there already.',
  },
  { name: 'useSettings', short: 'The drive’s settings and the person’s own.', gives: '`settings`, `drive`, `mine`, `canConfigure`, `save`, `saveMine`.' },
  { name: 'useComments', short: 'What is said of an entry, and saying more.', gives: '`comments`, `loading`, `error`, `add`, `edit`, `resolve`, `remove`.' },
  { name: 'useDrive', short: 'The provider itself.', gives: '`client`, `t`, `locale`, `changed()`: every route as a function, and the drive’s words.' },
];

export interface Method {
  name: string;
  signature: string;
  does: string;
  group: 'Reading' | 'Changing' | 'Uploads' | 'Sharing' | 'Requests' | 'Files' | 'Settings' | 'Live' | 'Comments' | 'Keeping' | 'Told' | 'Looking after';
}

/** The client of the routes, `createDriveClient({ base })`, and what `createMemoryClient` answers the same way. */
export const CLIENT: Method[] = [
  { group: 'Reading', name: 'list', signature: 'list(folder)', does: 'What is in a folder, or at the top with null, and the path down to it.' },
  { group: 'Reading', name: 'entry', signature: 'entry(id)', does: 'One entry, where it is, and whether it is in the trash.' },
  { group: 'Reading', name: 'recent', signature: 'recent()', does: 'The files changed last.' },
  { group: 'Reading', name: 'trash', signature: 'trash()', does: 'What is in one’s trash.' },
  { group: 'Reading', name: 'shared', signature: 'shared()', does: 'What others shared with the one asking.' },
  { group: 'Reading', name: 'sharedNew', signature: 'sharedNew()', does: 'How many of those are new since they last looked.' },
  { group: 'Reading', name: 'search', signature: 'search(query, { within, trashed })', does: 'By name: every word, any case, with or without accents.' },
  { group: 'Reading', name: 'searchText', signature: 'searchText(query)', does: 'By what is written in files, each with a piece of its text.' },
  { group: 'Reading', name: 'activity', signature: 'activity(id, limit?)', does: 'Who did what to an entry, and in a folder; the newest first.' },
  { group: 'Reading', name: 'usage', signature: 'usage()', does: 'The bytes one keeps, and how many one may.' },
  { group: 'Reading', name: 'starred', signature: 'starred()', does: 'What the one asking starred, the last starred first.' },
  { group: 'Reading', name: 'withField', signature: 'withField(name, value)', does: 'What has a field set to a value, of what one may read: the files of a client, of a case.' },
  { group: 'Changing', name: 'createFolder', signature: 'createFolder(name, parent)', does: 'A folder; “(2)” when the name is taken.' },
  { group: 'Changing', name: 'rename', signature: "rename(id, name, 'keep-both'?)", does: 'Refused when the name is taken there, unless both are kept.' },
  { group: 'Changing', name: 'move', signature: "move(id, parent, 'keep-both'?)", does: 'Into another folder, or to the top.' },
  { group: 'Changing', name: 'setColor', signature: 'setColor(id, color | null)', does: 'A folder in one of the drive’s nine colours, or its own again.' },
  { group: 'Changing', name: 'copy', signature: 'copy(id, parent?)', does: 'A copy of a file, its bytes copied in the storage: beside it, or at one’s own top where one may not put it.' },
  { group: 'Changing', name: 'setFields', signature: 'setFields(id, { name: value | null })', does: 'Fields of your application on an entry, each to its text, or taken away with null.' },
  { group: 'Changing', name: 'star', signature: 'star(id, starred?)', does: 'Starred by the one asking, or no longer with `false`: their own, seen by nobody else.' },
  { group: 'Changing', name: 'moveToTrash', signature: 'moveToTrash(id)', does: 'Into the trash, with what is inside it.' },
  { group: 'Changing', name: 'restore', signature: 'restore(id)', does: 'Out of the trash, back where it was.' },
  { group: 'Changing', name: 'deleteForever', signature: 'deleteForever(id)', does: 'Gone, its bytes too.' },
  { group: 'Changing', name: 'emptyTrash', signature: 'emptyTrash()', does: 'One’s whole trash, gone.' },
  { group: 'Changing', name: 'restoreVersion', signature: 'restoreVersion(id, version)', does: 'An old version back, as a new one, without sending its bytes again.' },
  {
    group: 'Uploads',
    name: 'upload',
    signature: 'upload(file, { parent, file, onProgress, signal, images, text, sha256 })',
    does: 'A file in parts, resumed after a cut; `file` for a new version; its smaller pictures, placeholder and text sent after it.',
  },
  { group: 'Uploads', name: 'duplicates', signature: 'duplicates(hashes)', does: 'The files with these bytes already, of what one may read.' },
  {
    group: 'Sharing',
    name: 'share',
    signature: 'share(id, who, role, days?)',
    does: 'With someone, or everyone signed in as `*`, as viewer, commenter or editor; for `days`, for good with null, as before unless said.',
  },
  { group: 'Sharing', name: 'unshare', signature: 'unshare(id, who)', does: 'No longer; anyone may leave what was shared with them.' },
  { group: 'Sharing', name: 'people', signature: 'people(query)', does: 'Who matches what is typed, people and groups, as the application finds them (`people` of the server).' },
  { group: 'Sharing', name: 'names', signature: 'names(ids)', does: 'How each of these is called, people and `group:` ids; one not known left out.' },
  {
    group: 'Sharing',
    name: 'createLink',
    signature: 'createLink(id, days, { password, once, uploads, request })',
    does: 'A link to read it without signing in, and its token; of a folder, one that takes files too (`also`) or only (`only`); with `request`, the documents it asks for, a folder for each person and the names they are kept by.',
  },
  {
    group: 'Sharing',
    name: 'updateLink',
    signature: 'updateLink(id, link, { days, uploads, request, closed })',
    does: 'A link changed: for days from now, what it takes and asks; closed, or opened again.',
  },
  { group: 'Requests', name: 'received', signature: 'received()', does: 'What came through one’s requests for files, the newest first.' },
  { group: 'Requests', name: 'requests', signature: 'requests()', does: 'One’s requests for files: each folder, its link, its token and what came.' },
  { group: 'Requests', name: 'remind', signature: 'remind(id, link)', does: 'Whom a request was sent to, reminded now of what is missing, with the server’s `reminders`.' },
  { group: 'Requests', name: 'expiring', signature: 'expiring(days?)', does: 'Files one may read whose field `expires` comes within so many days (15), or passed; the soonest first.' },
  { group: 'Requests', name: 'review', signature: 'review(id, status, reason?)', does: 'A file that came accepted, or returned with a reason the sender’s page shows; looked at no more with null.' },
  { group: 'Sharing', name: 'linkToken', signature: 'linkToken(id, link)', does: 'The token of a link made before: the same every time.' },
  { group: 'Sharing', name: 'removeLink', signature: 'removeLink(id, link)', does: 'Taken back.' },
  { group: 'Files', name: 'url', signature: 'url(id, { version, inline, size })', does: 'An address to read a file from: a download, or to show it at a size.' },
  { group: 'Files', name: 'urls', signature: 'urls(ids, { inline, size })', does: 'Those of many files at once, each with until when it is good.' },
  { group: 'Files', name: 'pack', signature: 'pack(ids)', does: 'What an archive of some entries holds, for `downloadZip`.' },
  { group: 'Settings', name: 'settings', signature: 'settings()', does: 'The drive’s settings, one’s own, and whether one may change the drive’s.' },
  { group: 'Settings', name: 'saveSettings', signature: 'saveSettings(settings)', does: 'The drive’s, for whoever may configure it.' },
  { group: 'Settings', name: 'saveMySettings', signature: 'saveMySettings(mine)', does: 'One’s own language and theme.' },
  { group: 'Comments', name: 'comments', signature: 'comments(id)', does: 'What is said of an entry, each thread with its replies under it.' },
  { group: 'Comments', name: 'addComment', signature: 'addComment(id, text, replyTo?)', does: 'A comment, or a reply under one; whom it names with @ are told.' },
  { group: 'Comments', name: 'editComment', signature: 'editComment(id, comment, text)', does: 'What one’s own comment says.' },
  { group: 'Comments', name: 'resolveComment', signature: 'resolveComment(id, comment, resolved?)', does: 'A thread dealt with, or open again.' },
  { group: 'Comments', name: 'removeComment', signature: 'removeComment(id, comment)', does: 'Taken back, with its replies: by its author, or the owner.' },
  { group: 'Keeping', name: 'hold', signature: 'hold(id, reason?)', does: 'A legal hold: neither it nor what is in it trashed or deleted until released. For who may configure.' },
  { group: 'Keeping', name: 'release', signature: 'release(id)', does: 'The hold taken off.' },
  { group: 'Keeping', name: 'exportPerson', signature: 'exportPerson(user?)', does: 'Everything of a person, for a .zip: what they own, said and did.' },
  {
    group: 'Told',
    name: 'notifications',
    signature: 'notifications()',
    does: 'What the one asking was told (shared with them or a group of theirs, named in a comment), the newest first, and how many are new.',
  },
  { group: 'Told', name: 'sawNotifications', signature: 'sawNotifications()', does: 'They looked: none is new any more.' },
  { group: 'Looking after', name: 'adminUsage', signature: 'adminUsage()', does: 'For who may configure: the files, folders and bytes of each person, and of the whole drive.' },
  {
    group: 'Looking after',
    name: 'adminRequests',
    signature: 'adminRequests()',
    does: 'For who may configure: every request for files open, whom it was sent to and what is still missing, to remind them.',
  },
  { group: 'Looking after', name: 'adminActivity', signature: 'adminActivity(limit?)', does: 'For who may configure: what was done anywhere in the drive, the newest first.' },
  {
    group: 'Live',
    name: 'watch',
    signature: 'watch(onChange, { onState })',
    does: 'What anyone changes, as it happens: the folders and entries of each change one may see. Comes back by itself after a cut. Returns what stops it.',
  },
];

export interface ServerOption {
  name: string;
  type: string;
  does: string;
}

export const SERVER_OPTIONS: ServerOption[] = [
  { name: 'storage', type: 'Storage', does: 'Where the bytes are: `s3Storage(s3OptionsFrom(process.env))`, `gcsStorage(…)`, `azureStorage(…)` or `diskStorage({ folder, secret })`.' },
  { name: 'metadata', type: 'MetadataStore', does: 'Where the entries are: `memoryMetadata()`, `sqliteMetadata(path)` or `postgresMetadata(pool)`.' },
  { name: 'identify', type: '(request) => User | null', does: 'Who is asking, from your session; null answers 401. `{ id, admin: true }` may configure the drive with `byRoles`.' },
  { name: 'authorize', type: '(user, action, entry, drive) => boolean', does: 'Asked on every route; false answers 403. `byRoles`, or rules of yours around it.' },
  { name: 'secret', type: 'string', does: 'What tokens are signed with: long, random, the same in every process.' },
  { name: 'base', type: 'string', does: 'The path the routes are under: `/api/files`.' },
  { name: 'top', type: "'own' | 'everyone'", does: 'What My files shows at the top: each person’s own (the default), or everything one may read, for one drive of a whole team.' },
  { name: 'maxSize', type: 'number', does: 'The largest file taken, in bytes; 5 GiB unless said.' },
  {
    name: 'settings',
    type: 'Partial<DriveSettings>',
    does: 'The defaults until someone changes them: language, theme, brand colour, pictures, `quota`, `trashDays`, and `company`, the name the page of a request for files shows.',
  },
  { name: 'cors', type: '{ origins: string[] }', does: 'Pages of other origins that may use the routes: the desktop window, a page of another domain.' },
  { name: 'onShare', type: '(event) => void', does: 'Each share kept, with who, by whom and whether it is the first: to tell the person.' },
  {
    name: 'beforeUpload',
    type: '(upload, drive) => boolean | void',
    does: 'Asked before an upload is given addresses, with its name, type, size and folder: throw a `Refused`, or return false, to refuse it.',
  },
  {
    name: 'inspect',
    type: '(upload, drive) => boolean | void',
    does: 'Asked once the bytes arrived, before the file is listed, with a `read` of them: `checkType()`, `clamav()`, or yours. A refusal takes the bytes away.',
  },
  { name: 'live', type: 'false | { poll }', does: 'Changes told at `/events` as they happen; those of another process on the same store within `poll` ms (2000). `false` for none.' },
  {
    name: 'derive',
    type: 'Derive',
    does: 'What the server makes of a file once kept, for what the page did not: pictures, a placeholder, its text (of a PDF, a Word document, a workbook; of a picture with `ocr()`). `deriveAll()` of `@rebofiles/server/derive`.',
  },
  { name: 'onChange', type: '({ activity, entry }) => void', does: 'Each thing done to the drive, as its activity says it: for webhooks, an audit, another index, counting space.' },
  { name: 'onComment', type: '({ comment, entry, mentions, by }) => void', does: 'Each comment made, with whom it names with an @: to tell them.' },
  {
    name: 'onReceived',
    type: '({ entry, from, item, request, got }) => void',
    does: 'Each file that came through a request for files, with who sent it, for which document, and what came so far: to tell the owner.',
  },
  { name: 'onReview', type: '({ entry, status, reason, from, by }) => void', does: 'Each file accepted or returned: to tell whoever sent it.' },
  {
    name: 'reminders',
    type: '{ send(reminder) }',
    does: 'Whom a request was sent to, reminded every `remind` days of what is missing, and at once: `mailReminders({ mail: resend(…), url })`, or yours.',
  },
  { name: 'check', type: 'false | ({ entry, item, text }) => …', does: 'What is written in what came, against the `words` and `find` of its document: `checkWritten` unless yours; `false` for none.' },
  { name: 'expiring', type: 'false | { field, days, onExpiring }', does: 'The owner of a file whose field `expires` comes within `days` (15) told in the bell, and `onExpiring`; `false` for none.' },
  {
    name: 'onRead',
    type: '({ action, user, link, entries, path }) => void',
    does: 'Each thing opened, seen or taken: a folder listed, a file seen or downloaded, an archive; by someone or through a link. For an audit.',
  },
  {
    name: 'people',
    type: '{ search(query, user), names?(ids, user) }',
    does: 'Who is who, from your directory: the people and groups that match what is typed where something is shared, and their names, shown in place of ids.',
  },
  { name: 'logger', type: 'Logger', does: 'Where what went wrong and was not answered for is written: `pino()`, `console` unless given.' },
  { name: 'onRequest', type: '(done) => void', does: 'After every request, its route, status, time and who: for metrics, as `openTelemetry(meter)`.' },
  { name: 'limits', type: 'Limits | false', does: 'How many uploads, archives, text searches, wrong passwords of a link and requests each may make; a 429 past them.' },
  { name: 'limiter', type: 'Limiter', does: 'Where the counts of `limits` are kept: in the process unless given; Redis for more than one.' },
  { name: 'clientIp', type: '(request) => string', does: 'The address of who asks, to count wrong passwords of a link by it too.' },
  { name: 'now', type: '() => Date', does: 'The clock, for tests.' },
  { name: 'newId', type: '() => string', does: 'The ids of new entries; random UUIDs unless given.' },
];

export interface PackageDoc {
  name: string;
  what: string;
  runs: string;
  install: string;
  /** What it gives, the first names. */
  gives: string[];
  /** Not written yet: the version it comes in. */
  comes?: string;
}

export const PACKAGE_DOCS: PackageDoc[] = [
  {
    name: '@rebofiles/react',
    what: 'The whole drive as <FileDrive>, the headless hooks it is built from, and <SharedLink> for a link.',
    runs: 'React 18+',
    install: 'npm install @rebofiles/react',
    gives: ['FileDrive', 'SharedLink', 'DriveProvider', 'useEntries', 'useEntry', 'useActions', 'useUploads', 'useSettings', 'useDrive', 'createMemoryClient'],
  },
  {
    name: '@rebofiles/drive',
    what: 'The whole drive without a framework, mounted on an element; the client of the routes; uploads, archives and pictures made in the page.',
    runs: 'Any browser',
    install: 'npm install @rebofiles/drive',
    gives: [
      'mountDrive',
      'mountSharedLink',
      'createDriveClient',
      'createLinkClient',
      'createMemoryClient',
      'createUploads',
      'refusalText',
      'lookInDrive',
      'downloadZip',
      'writeZip',
      'textOf',
      'hashOf',
      'CSS',
      'TEXTS',
    ],
  },
  {
    name: '@rebofiles/server',
    what: 'The routes, authorize(), signed addresses, the bytes on S3 or a disk, the metadata in memory, SQLite or Postgres.',
    runs: 'Node 22.12+',
    install: 'npm install @rebofiles/server',
    gives: [
      'createDriveHandler',
      'nodeHandler',
      'byRoles',
      'everyone',
      's3Storage',
      's3OptionsFrom',
      'diskStorage',
      'memoryMetadata',
      'sqliteMetadata',
      'postgresMetadata',
      'checkType',
      'clamav',
      'Refused',
      'openTelemetry',
      'deriveAll',
    ],
  },
  {
    name: '@rebofiles/core',
    what: 'The model of a drive as pure functions: the tree, names, the trash, versions, sharing, search, activity. No dependencies.',
    runs: 'Anywhere, no DOM',
    install: 'npm install @rebofiles/core',
    gives: ['emptyDrive', 'createFolder', 'addFile', 'move', 'rename', 'moveToTrash', 'addVersion', 'share', 'addLink', 'search', 'textMatch', 'activityOf', 'changes'],
  },
  {
    name: '@rebofiles/mcp',
    what: 'Tools for an AI assistant, over HTTP or stdio, with the user’s own rights; with Rebodocs, its Word documents edited, each change a version.',
    runs: 'Node 22.12+',
    install: 'npm install @rebofiles/mcp',
    gives: ['createMcpHandler', 'serveStdio', 'TOOLS', 'allTools', 'documentTools', 'driveAt'],
  },
  {
    name: '@rebofiles/sync',
    what: 'A folder of the disk kept as a folder of the drive, both ways: changes sent and taken, conflicts kept twice, moves followed. In the desktop application, and as a command.',
    runs: 'Node 22.12+, or a desktop app',
    install: 'npm install @rebofiles/sync',
    gives: ['syncOnce', 'watchSync', 'nodeFolder', 'loadState', 'saveState', 'rebofiles-sync'],
  },
];
