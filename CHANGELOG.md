# Changelog

Every package of ReboFiles is released at the same version. Before 1.0, a
minor version (0.x.0) may change the API; such changes are listed under
**Changed** with what to do about them.

## Unreleased

### Added

- **The drive a piece at a time.** SQLite, Postgres and the store in memory
  answer what each request needs (`scoped` of a store: an entry and the
  folders above it, what is in a folder, a search, the trash…), and the drive
  is never loaded whole: two hundred thousand entries listed in milliseconds.
  The columns and tables they are asked by are added to a database made before
  them, and filled once. What another process changed is told from the
  activity the store keeps (`activityAfter`).
- **Pictures and text made by the server** (`derive`, and `deriveAll()` of
  `@rebofiles/server/derive`): the smaller pictures and placeholder of a
  picture with sharp, a PDF's first page and its text with pdf.js, the text of
  a Word document and of a text, for what the page did not make (it says what
  it made, `madeHere`). PDFs now show their first page in the grid and the
  list, and are found by their words. A storage may `write`.
- **Only what changed is sent.** A version keeps the SHA-256 of its parts
  (`partHashes`), and the parts a new one shares with it are copied in the
  storage (`copyPart`: S3's UploadPartCopy, a copy on the disk). The sync
  sends so.
- **Comments.** Threads with replies, resolved, edited and taken back, in the
  details of the drive, with `useComments`, the client, and the assistant's
  `list_comments` and `add_comment`; `onComment` with whom a comment names
  with an @. The role of commenter now has something to do.
- **Groups.** What is shared with `group:<id>` is shared with whoever
  `identify` says is in it (`User.groups`).
- **Retention, holds and export.** `retentionDays` keeps everything made a
  minimum of days; a legal hold (`PUT /entries/:id/hold`) keeps a folder from
  the trash and from being deleted; `GET /export` and **Download my data**
  give a person everything of theirs.
- **The server says of itself**: `onChange` for each thing done, a `logger`,
  `onRequest` and `openTelemetry(meter)`, and `limits` of requests by person,
  by link and by address, with a `limiter` of one's own for many processes.
- **WebKit and Firefox** in the tests and the workflow; in WebKit, Escape and
  the focus as Safari leaves them, after a click.

- **Changes as they happen.** `GET /events` of the server, a stream of
  server-sent events: each change told to each one watching as far as they
  may see it, the folders they may list and the entries they may read; one of
  another process on the same store within two seconds, from its revision
  (`live: { poll }`, `live: false` for none). `client.watch()` reads it with
  `fetch`, so it carries the headers, and comes back after a cut. The drive,
  `<FileDrive>` and every hook under a `DriveProvider` ask again a moment
  after; the drive kept in the page tells the same.
- **Folders of thousands.** From 200 entries, the list and the grid put in
  the page only what is in sight, with the room of the rest kept; the keyboard
  goes through all, each with `aria-posinset` and `aria-setsize`.
- **Uploads checked.** `beforeUpload` of the server, before an upload is
  given addresses; `inspect`, once its bytes arrived and before it is listed,
  with a `read` of them, its bytes taken away when it refuses. `checkType()`
  refuses a program, and a file whose bytes are not those of its extension;
  `clamav()` asks clamd; `inspectAll()` asks several. `typeOfBytes()`. A
  storage may `read` and `sweepUploads`; both of the server do.
- **Uploads left halfway swept.** Past the life of their tokens, by the server
  every ten minutes, from a bucket (under its prefix) and from the disk.
- **`@rebofiles/sync`.** A folder of the disk kept as a folder of the drive,
  both ways, with conflicts kept twice, moves followed and a disk found empty
  refused: `syncOnce`, `nodeFolder`, `watchSync`, and `rebofiles-sync` as a
  command. In the desktop application, **Server → Sync a Folder…**.
- **The refusals of the server in every language.** In Spanish and Chinese,
  the drive says them by their code; `refusalText(error, language)`.
- **Examples** of the server in Next.js, Express, Hono and Fastify, and of who
  asks from Auth.js, Clerk or a JWT of your own, in `examples/`, each served
  and asked over HTTP by its tests; a page of the documentation shows them.
- **Documentation:** Frameworks and sign-in, Checking uploads, Live changes
  and large folders, Sync a folder, Going to production, in English, Spanish
  and Mandarin; the routes and the tools of the assistant described in each
  language; `llms.txt` in each (`/es/llms.txt`, `/zh/llms.txt`).
- **CI and releases.** GitHub Actions for the lint, types, tests, builds and
  Chrome on every push; the desktop application on a Mac, Windows and Linux;
  a release by hand. Changesets with the six packages in one `fixed` group.

- **`@rebofiles/core`, the model of a drive.** A `Drive` is an immutable
  value of entries, folders and files, each in a folder or at the top.
  `createFolder`, `addFile`, `rename`, `move`, `moveToTrash`, `restore`,
  `deleteForever`, `emptyTrash`, `addVersion`, `restoreVersion`; `children`,
  `ancestors`, `trash`, `recent`, `search`; `changes` says what an
  operation touched, for a store to write only that. Names are checked as
  the strictest file system would take them, and two that differ only in
  case or in how an accent is written are the same name; a name that comes
  with something new is made free with "(2)", one a person gives is refused
  when taken unless `ifTaken: 'keep-both'`. A refusal is a `DriveError` with
  a `code`.
- **`@rebofiles/server`, the backend.** `createDriveHandler` takes a Request
  and gives a Response, for Next.js, Bun, Deno or Workers; `nodeHandler` puts
  it on `node:http`. Every route asks `identify` and `authorize`. Uploads go
  straight from the browser to the bucket, a file larger than 8 MiB in parts,
  each address signed for its exact length; the server checks the size that
  arrived before the file is listed. `s3Storage` signs for anything that
  speaks S3, with no SDK; `diskStorage` keeps the bytes in a folder and serves
  its own addresses. `memoryMetadata` and `sqliteMetadata` (Node's
  `node:sqlite`) keep the entries.
- **`@rebofiles/react`, the drive on a page.** `<FileDrive>`: the search, My
  files, Recent and the Trash, the list and the grid, the details of what is
  selected with a preview (pictures, PDF, the beginning of a text) and its
  versions, uploads by button or by dropping files, moving by dragging onto a
  folder or from a dialog, renaming, the trash with its restore. The arrows,
  Enter, Delete and F2 in the list. In English and Spanish. Its colours, radii
  and fonts are custom properties on `.rf-drive`. "Open in Rebodocs" for Word
  documents, with `onOpenDocument`. The hooks it is built from: `useEntries`,
  `useEntry`, `useActions`, `useUploads`, under a `DriveProvider`; and
  `createDriveClient`, one function per route.
- **Downloads shown in the page.** `GET /entries/:id/download?inline=1` signs
  an address that shows the file rather than saving it, for previews.
  `diskStorage` takes a `label`.
- **The playground** (`npm run dev`): the drive on this computer, the bytes in
  `storage/files` and the entries in `storage/drive.sqlite`.
- **Word documents with Rebodocs.** `previewDocument` on `<FileDrive>`, and
  `previewDocx` of `@rebofiles/react/rebodocs`: the title and the first
  paragraphs as a small page, read with `@rebodocs/core`, an optional peer.
  In the playground, "Open in Rebodocs" opens `DocsEditor`, and each save is
  a new version of the file. `useActions().upload`, for a file or a new
  version of one. A `<FileDrive>` inside a `DriveProvider` of the
  application's uses it. The details say a type as a person does ("Word
  document").
- **`npm run sample -- out.docx`**: a Word document made in code, for the
  tests and the playground.
- **A drive kept in the page.** `createMemoryClient` answers as the server
  does, from core, with the bytes as Blobs: for demos, stories and tests.
  `apply(change, by)` makes a change as someone else.
- **The demo** (`npm run demo`): Acme's drive of the landing, entirely in the
  browser. Its Word documents, PDFs and pictures are made in the page;
  Word documents are previewed and opened in Rebodocs; three seconds in,
  Claude renames a contract and says so in a card. `DemoDrive` is the
  component the landing puts in its frame.
- **The landing page** (`apps/site`, `npm run site`): the design of the
  handoff in Next.js 16 and Tailwind 4, laid out as Rebodocs' site is, with
  the demo in its frame. What is not written yet says the version it comes
  in, and until the packages are on npm (`PUBLISHED` in `lib/home.ts`) it
  shows no command to install them. Built as plain files, to put on any host.
- **Builds to publish** (`npm run build:packages`), made as Rebodocs makes
  its own: each package's `dist/` is the package, with its types, and was
  installed from its tarball in an empty project and used there.
- **Against a real bucket** (`apps/storage`, `npm run storage`): the drive
  with its bytes in the bucket `.env` says (R2, S3, MinIO), with its
  `.env.example` and `cors.json`. `npm run storage:check` goes the whole way a
  file goes from Node, a small file, one in parts, a version, a download shown
  in the page and the deletion, and says what the bucket answered when it
  refuses; `npm run storage:seed` puts a few files there.
- **Getting started and the status page** on the site (`/docs/`, `/status/`):
  a drive in a Next.js application on R2, from the bucket and its rule of
  origins to the route, `authorize()`, the page and what to do when something
  fails; and what is tested, checked by hand, not yet, its limits and the
  roadmap, from `components/docs/status/data.ts`.
- **An upload given up.** `POST /uploads/abort` takes away what of an upload
  arrived, and the client asks it when a part fails or the upload is
  stopped, sending no more parts; the server gives up one it cannot finish.
  The bytes of a version already kept are never taken. A storage of your own
  needs `abortUpload(key, state, size)`.
- **Deleting in one request.** `s3Storage` deletes up to a thousand keys at
  once, with DeleteObjects, instead of one request for each.
- **Tests in Chrome** (`npm run test:browser`): the playground driven by
  Playwright, in the Chrome of the machine, on a port and a folder of its own.
  The playground takes `PORT` and `REBOFILES_STORAGE`.
- **Metadata on Postgres.** `postgresMetadata(db)` keeps the entries in one
  table of jsonb, made the first time, with the driver of the application:
  anything with `query(text, values)` that answers `{ rows }`, as `pg`,
  Neon or PGlite do. A change is one statement. Given a pool, each change
  holds a lock of the database, so any number of servers may share a drive;
  a `MetadataStore` of your own may give `lock(work)` for the same.
- **Sharing.** An entry shared with someone, or with everyone signed in, as
  viewer, commenter or editor, with what is inside it (`share`, `unshare`,
  `accessOf`, `allows`, `sharedWith` in core). `byRoles` is an `authorize`
  from the drive itself. Shared with me, as a route, a method of the client
  and a section of `<FileDrive>`, whose details have **Share**: the people,
  their roles, and links.
- **Links.** Read an entry and what is inside it without signing in, until
  they expire, from a day to ninety, or are removed. Their token is signed by
  the server and the same every time. `createLinkClient` reads through one,
  and `<SharedLink>` shows it; `linkAddress` on `<FileDrive>` says where.

- **The drive with the keyboard alone.** The Upload menu goes round with the
  arrows, Home and End, as a menu does, and Escape gives the focus back to
  its button. Inside the move dialog, going into a folder puts the focus on
  its first folder, or on "Move here", rather than nowhere. Kept by a test in
  Chrome that makes, opens, uploads, renames, moves and trashes without a click.
- **`@rebofiles/drive`, the drive without a framework.** `mountDrive(element,
  options)` is the whole screen, and `mountSharedLink` what a link shows,
  with no framework; and the client, the drive kept in the page, the words
  and the stylesheet, moved here from `@rebofiles/react`, which gives them
  again. `<FileDrive>` and `<SharedLink>` mount them. The playground has a
  page with no framework, `vanilla.html`.
- **The guide to the hooks** (`/docs/hooks/`): each hook, and a whole drive
  built from them alone, in a look of its own (`apps/playground/headless.html`),
  tested in Chrome.
- **`@rebofiles/mcp`, the drive for an assistant.** Tools to list, search,
  read (text, and Word documents with Rebodocs), see Recent and Shared with
  me, make folders, write text files and new versions of them, rename, move,
  and put in the trash and take out; not to delete for good nor to share.
  They ask the drive's routes as the person the assistant works for, so
  `authorize` decides for it as for them. `createMcpHandler` serves them over
  HTTP, `rebofiles-mcp` over stdio; the protocol is spoken without its SDK.
  The playground serves them at `/api/mcp`.
- **Several picked at once.** ⌘ or Ctrl and a click add one or take it out,
  Shift a range; a box to tick on each, seen under the mouse; Shift and the
  arrows, ⌘/Ctrl+A for all, Space with ⌘/Ctrl and the arrows. A bar over the
  list says how many, with what may be done to all of them: download, move,
  put in the trash, or, in the trash, restore and delete for good; dragged,
  they go together. Done one after another, said once, with how many could
  not be done and why.
- **A viewer in the drive.** A file opened is shown over the drive, not in a
  tab: a picture at its large size (a click for its real size), a PDF in the
  browser's own viewer, video and audio, Markdown as a page (made of
  elements, never of HTML, its links only to http, https and mail), a CSV as
  a table, JSON laid out, code and text; a Word document in its pages, by
  Rebodocs' editor read only, with `viewDocument: viewDocx` of
  `@rebofiles/drive/rebodocs`: one page under another, each whole on the
  screen, with Rebodocs' bar floating over them (the page one is on, the
  fit, the zoom), whose grid of pages sets all of them out at once, as large
  as lets them all fit (at the editor's least zoom, a quarter, for a long
  one); printed from the viewer as its pages are shown. A first page lying
  down is shown whole in its thumbnail. Its thumbnail, in the grid and the
  details, is the top of its first page as Rebodocs draws it, large, its
  side margins left out. It is a picture made when the document is uploaded
  (`pictureDocument: pictureOfDocx`): its first page drawn by Rebodocs'
  editor, in an SVG with the editor's stylesheet, onto a canvas, in the two
  sizes the grid and the details show, as WebP where the browser writes it
  (a third lighter than JPEG for a page of text: 184 KB to 120 KB for a
  contract), JPEG where it does not, PNG when the settings keep the
  original's type, and kept with its version as images' copies are. A
  document uploaded before gets them the first time it is shown, drawn live
  meanwhile (`thumbDocument: thumbDocx`), when the one looking may upload. A picture is always whole on the
  screen, with nothing to scroll; a click shows its real size. The arrows go to the files before and after;
  a tab of its own, when wanted, is a button away. New kinds: `video`,
  `audio`, and code among `text`.
- **Settings, on a screen of their own.** A button at the top of the drive
  opens them over it, as Rebodocs' menu is over a document, the parts down
  one side: Language, Appearance and Pictures. Each person chooses their own
  language and theme; whoever may `configure` the drive (`admin` with
  `byRoles`) its language, theme, the colour of its brand, from swatches or
  any other, and its pictures. Saved as they are chosen, by the metadata
  store (`getSetting`, `setSetting`; a table in SQLite and Postgres), through
  `GET` and `PUT /settings` and `PUT /settings/mine`. `useSettings` in React.
- **Pictures in four sizes.** An image uploaded is made smaller in the page
  in the drive's four sizes, 160, 480, 1024 and 2048 pixels unless changed,
  as JPEG by default or as the type of the original, and the copies are sent
  after it and kept with its version (`renditions`); the original stays as it
  came. The grid and the preview show them; `url(id, { size })` and
  `download?size=` give the smallest that shows a picture at a size.
- **Space for each person, and the trash emptying itself.** In Storage, in
  the settings, whoever configures the drive gives each person a quota and
  a number of days after which the trash deletes for good what has been in
  it (`quota`, `trashDays`; none unless set). An upload past one's quota is
  refused before anything goes (`over-quota`); the side of the drive shows
  the space one uses, of how much (`GET /usage`, `usageOf`). The trash is
  looked at now and then as requests come (`purgeTrash`), the bytes going
  with what goes.
- **Links with a password, or for one download.** Sharing a link, one
  chooses how long it lasts (a day, a week, a month), a password, and
  whether it is good for one download only (`createLink(id, days, {
  password, once })`). The server keeps only what scrypt makes of the
  password, apart from the drive, and asks for it at every request
  (`x-link-password`; `link-password`, `link-password-wrong`, a moment late
  against guessing); the page of the link asks for it first. A link of one
  download is taken by downloading a file or an archive of it, not by
  looking or seeing a file in the page, and still works a quarter of an hour
  after, for the files of that download (`uses`, `used`, `spent`,
  `useLink`, `LINK_GRACE`). The dialog marks each link with what it has.
- **Told of what is shared.** `onShare` on the server is called with each
  entry shared, or a role changed (`first`), with who and by whom: for the
  application to send a mail or a notice; its failure is not the share's.
  Beside Shared with me, the drive counts what was shared since one last
  looked there (`GET /shared/new`, `POST /shared/seen`, `sharedSince`),
  asked after each change, when the page is seen again and every minute.
- **Activity.** What each person did, kept as each change is: made,
  uploaded, a new version, renamed, moved, put in the trash and back,
  deleted, shared and no longer, a link made and taken back. Told by core
  from the drive before and after a change (`activityOf`), so whatever
  changed it is in it, the trash emptying itself too. The details of a file
  or a folder have an Activity tab, a folder's with what was done right
  inside it (`GET /entries/:id/activity`, `client.activity`); an assistant
  reads it with `get_activity`. Kept by the store (`record`, `activity`;
  a table of its own on SQLite and Postgres), else in the process.
- **The same file, or the same name, asked about before it goes.** Each
  file is looked for in the drive before it is uploaded: its SHA-256, made
  in the page for one of up to 64 MiB (`hashOf`) and kept with its version
  (`sha256`), finds the same bytes anywhere one may read (`POST
  /duplicates`, `filesByHash`); else a file of its name where it goes. The
  panel of uploads asks: for the same bytes, upload anyway or skip; for a
  name, replace (a new version of it), keep both, or skip; and "do the
  same for all the others". `createUploads({ check })`, `lookInDrive`,
  `decide`; `useUploads({ check: true })` in React; `checkUploads: false`
  to upload without asking, as before.
- **Search by what is written in a file.** As a file is uploaded, the page
  reads its text: a text file by its type or its name, the first 2 MiB; a
  Word document with `textOfDocx` of `@rebofiles/drive/rebodocs`
  (`textDocument`); and sends it after it (`text`, `PUT
  /entries/:id/text`), kept with the version it is of, the first 100,000
  characters. A search shows what is found by its name first, then by its
  text, with a piece of the text around what was found under its name
  (`GET /search/text`, `searchText`, `textMatch`); every word, without case
  or accents, as for names. The store keeps the texts (`keepText`,
  `findText`): SQLite in a table of its full-text search, Postgres with a
  `tsvector`. An assistant searches them with `search_text`, and what it
  writes is kept to be found. PDFs are not read yet.
- **The desktop application** (`apps/desktop`, `npm run desktop`). Tauri
  around the page of the drive, on a Mac first, against any ReboFiles
  server: its address and a token asked the first time, kept, tried at
  every start; Server → Change Server… for another; what is downloaded
  goes to Downloads, a name taken made free. Builds as ReboFiles.app
  (`npm run build:desktop`). The sync of a folder of the disk is the next
  step, not in it.
- **`cors` on the server.** `createDriveHandler({ cors: { origins } })`
  lets pages of those origins use the routes: the browser's question
  first answered, and the ETag of a part readable. For the desktop window,
  and for a page of another domain.
- **Folders in colours.** A folder is given one of nine colours, or the
  drive's own, from its details or its menu, several at once, and undone
  from the toast; each has its pair for the dark theme (`color`,
  `FOLDER_COLORS`, `setColor`, `PATCH /entries/:id { color }`,
  `client.setColor`; `set_folder_color` for an assistant). In the activity
  too.
- **Pictures shown blurred while they come.** As a picture (or the first
  page of a Word document) is uploaded, a tiny one of it, 16 pixels on its
  longest side, a few hundred bytes as a data: URL, is kept with its
  version (`placeholder`, `placeholderOf`, `setPlaceholder`, `PUT
  /entries/:id/placeholder`). The grid, the details and the viewer show
  it blurred where the picture will be, under it, until it has come.
- **More ways to put the list in order.** By type, by when it was made and
  by colour, besides name, owner, modified and size; the choice of order
  in the list as well as in the grid; and the folders first or among the
  files ("Folders first"), kept for the next visit.
- **Folders of the computer, uploaded as they were.** Dropped on the drive,
  or chosen with "Upload a folder", a folder goes up with all that is in it:
  its folders made top down, the empty ones too, "(2)" for a name taken, and
  each file into its own (`readDropped`, `readChosen`).
- **A link's folder as a .zip.** Someone with a link to a folder downloads
  it whole, or a folder in it, without signing in (`/links/:token/zip` and
  `/links/:token/urls`, which keep to what the link reads).
- **What a .zip left out, on its own.** A file that could not be read while
  a .zip was made is said in its toast, with a button that downloads those
  in a .zip of their own.
- **The list in an order of one's choosing, and one kind of file.** A click
  on a column of the list (name, owner, modified, size) puts it in that
  order, a second the other way; in the grid, a choice of the order. Folders
  go first whatever it is, and Recent and a search keep the server's order
  until one is chosen. A choice of the kind shows only folders, documents,
  PDFs, spreadsheets, pictures, videos, audio, text or the rest. The order is
  kept in the browser for the next visit.
- **A menu of each entry.** A right click on one, or Shift+F10 or the menu
  key on the one the keyboard is on, opens what can be done to it, or to all
  that is picked: open, download, rename, move, share, the trash; in the
  trash, restore and delete for good. The arrows go round it, Escape gives
  the keyboard back to the list.
- **Undo.** Putting in the trash, moving and renaming say so in a toast
  with Undo, for seven seconds, and ⌘Z or Ctrl+Z does it too.
- **Uploads in a panel, several at once, with how long each has left.**
  Three files go up at once (each in parts, three at once too), the others
  waiting their turn; a card at the foot of the drive lists every one, with
  how much has gone, how fast and how long it has left, worked out from the
  last few seconds, and the same for all of them in its title. Each can be
  stopped, one stopped or failed sent again from what arrived, all stopped
  at once; the card folds, and closes once they are up, while the drive goes
  on being used. `createUploads` holds it, for the screen and for
  `useUploads`, which now gives `summary`, `stop`, `stopAll` and `clear`,
  and each upload its `speed` and `remaining`.
- **Download as .zip.** Several picked, or a folder from its details, go
  in one .zip made in the page: the server says what goes in it and at
  which path (`POST /zip`, `packOf` in core), asking `authorize` for each
  entry, and the bytes come straight from where they are, their addresses
  asked for a few at a time so a long one does not outlive them. Written as
  it comes (`writeZip`), nothing of a file held whole: text deflated by the
  browser's CompressionStream, what is compressed already kept as it is,
  names in UTF-8, ZIP64 past 4 GiB or 65,535 files. Past 500 MB, where the
  browser can, it is written to a file the person chooses as it is made.
  Its progress in the status bar, with Cancel; a file that cannot be read is
  left out and said. No dependency. Checked against R2, and with unzip,
  Python's zipfile and macOS' ditto.
- **The drive held in memory.** The server reads the drive whole once and
  holds it, reading it again only when the store's revision changed, by this
  process or another: a number in a row of its own in SQLite and Postgres,
  one more in the same statement that writes. Listing a folder of a drive of
  20,000 entries went from 36 ms to 0.7. A store of your own gives
  `revision()` to have it; without it, the drive is read on every request,
  as before.
- **Addresses that are asked for together, and kept.** `POST /urls` (and
  `client.urls(ids, { inline, size })`) gives the addresses of many files at
  once: a grid of pictures asks once, not once for each. Every address says
  until when it is good (`expires`), and the drive asks for another before
  then; a picture that did not load is asked for again, those that fail
  together in one request. An address to show a file (`inline`) is signed
  from the start of the hour, the same all of it, good for two, and comes
  with `Cache-Control: private, max-age=7200`: the browser keeps what it read
  instead of reading it again. One to download it is good for 15 minutes, as
  before. Checked on R2.
- **Uploads that go on after a cut.** A part that fails is tried again by
  itself, up to five times, waiting longer each time, after asking the
  server what arrived (`POST /uploads/resume`) and taking new addresses for
  the rest, so a file of hours does not run out of them. One that cannot go
  on keeps what arrived: "Try again" in the drive (`retry` of `useUploads`)
  sends the rest, and so does uploading the same file to the same place
  after the page was closed, as the client remembers it in localStorage
  (`remember`). Stopped by the person, it is given up. Storages say what
  arrived with `resumeUpload`: S3 lists the parts, the disk looks at them.
  Checked against R2.
- **Files of many gigabytes.** Parts are larger than 8 MiB when 10,000 of
  them would not hold a file, as S3 puts no more together.
- **Claude in the demo, through the MCP tools.** Its rename on the landing
  is the calls an assistant makes (`search`, `read_document`, `rename`),
  answered by the tools of `@rebofiles/mcp` and Rebodocs over the drive in
  the page, as Claude; each is shown in its card as it is made. The tools
  run in a page too now: `serveStdio` asks for Node's readline only when it
  is called.
- **Word documents of the drive, edited by an assistant.** With
  `@rebodocs/mcp` installed beside `@rebofiles/mcp`, Rebodocs' tools are
  served on the drive's `.docx` files, each given the id of one as
  `document`: read it, fill a template, put a clause in its place, track a
  change, add a note, compare with an earlier version, put in a picture of
  the drive. Each change is saved at once as a new version of the file, as
  the person, and is refused when someone saved another meanwhile;
  `restore_version`, a new tool of the drive, undoes it, and
  `create_document` starts one. Without Rebodocs the tools are the drive's
  alone.
- **A dark theme.** `theme="dark"`, or `"auto"` as the system is, on
  `<FileDrive>` and `<SharedLink>`; light unless said. Every colour of the
  drive is a custom property now, the kinds of file, shadows and the toast
  among them, and the dark ones read at 4.5:1 or more, as axe checks. A page
  previewed stays paper, with the ink of paper.
- **What a screen reader is told.** Where one is and how many items are
  there, once a view has loaded; an upload's progress as a progress bar, no
  longer read out at every step; a failed upload as an alert.

### Changed

- **Word documents in Rebodocs' viewer.** `viewDocx`, `thumbDocx` and
  `pictureOfDocx` are those of `@rebodocs/viewer` (0.12), which grew out of
  them: the optional peer of `@rebofiles/drive/rebodocs` is now
  `@rebodocs/viewer` in the place of `@rebodocs/editor`, and every peer on
  Rebodocs asks for 0.12.0 or later. `pageWidthToFit` is no longer exported:
  it is the viewer's. The bar over the pages has the class `dx-viewer-bar`.
- `nodeHandler` takes the path from `originalUrl` when there is one, so
  `app.use('/api/files', …)` of Express works as it reads; and ends an
  answer that goes on (the events) when the page is gone.
- `<FileDrive>` takes `live`, for its provider; the drive it mounts does not
  watch on its own inside one.

- **An address to show a file is good for one to two hours**, from the start
  of its hour, instead of 15 minutes, so the browser can keep what it read.
  One to download a file is still good for 15 minutes.
- **Uploads go three at a time**, not one after another, and their progress
  is in a panel of its own, not in the status bar.
- **Downloading several downloads one .zip**, not each file in turn.
- **A file opened is shown in the drive**, not in a new tab. Give `onOpen`
  to open it your own way, as before.
- **The language and theme of `<FileDrive>`** are over the drive's settings
  and under each person's own: the provider's `language` no longer defaults
  to English, and `theme` no longer to light, so the drive's settings say
  them when the application does not.
- **A failed upload is not given up.** What arrived stays, to be gone on
  with; only one stopped by the person is given up. Set a lifecycle rule on
  the bucket for those never gone on with.
- **Rebodocs 0.11.** The optional peers on `@rebodocs/core` ask for 0.11.0
  or later, the version `@rebodocs/mcp` is made with.

- **My files is one's own.** At the top of the drive the server lists only
  what the one asking owns; what others share is in Shared with me. For one
  drive of a whole team, as before, give `top: 'everyone'` to
  `createDriveHandler` (and to `createMemoryClient`).
- **The top of the drive is each owner's for names.** A name someone else
  has there is free, and not told: two people may both have "Contracts".
  `takenBy` and `uniqueName` take the owner as a last argument.
- **One's trash** lists what one owns or put there, not what others threw
  away in a folder shared with one, and emptying it empties that: before,
  anyone's trash in the drive stopped one from emptying one's own.
  `trash(drive, user)` and `emptyTrash(drive, user)` in core.
- **Where an entry is** (`path`) starts from where it was shared with the one
  asking, not from folders they may not read.
- **`Action`** comes from core and has `comment` and `share`. An `authorize`
  of your own is now asked `share` for sharing and links: answer it.
- **`DriveErrorCode`** has `invalid-share`: a map of every code needs it.
- **`react-dom` is a peer of `@rebofiles/react`**, which puts a logo of
  React's inside the drive with a portal.

### Fixed

- **A view said loading while it is.** In the render after the view changes,
  `useEntries` gave the last view's entries as if they were this one's; and
  `useEntry(id)` the last entry until the one asked for came, so what was
  done to "it" was done to the one before.

- **The client outside a browser.** An address a storage on the disk makes
  is relative; it is now taken relative to `base` when that is a whole
  address, so the client works in Node and on a server, not only in a page.
- **A file of one part, sent to a bucket.** Its type is signed with its
  address, but the part went without it, which a real bucket refuses. Each
  part now goes with the type the server was told. The S3 kept in memory for
  the tests refuses a header signed and not sent, as S3 does.
- **R2 and a text file.** Cloudflare compressed its answer to the HEAD the
  server makes to see what arrived, and left out the length, so every text
  file was refused as empty. The server now asks the bucket for answers not
  compressed.

