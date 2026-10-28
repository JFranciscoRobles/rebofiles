# ReboFiles: roadmap

ReboFiles is a file drive for the browser, built into an application and
kept on the application's own storage. This file says how the repository is
laid out, so that it is kept the way Rebodocs is, and in what order the work
goes. Once the site exists, its last part becomes the status page
(`apps/site/components/docs/status/`), with the same sections as Rebodocs'.

## The repository

The same shape as `JFranciscoRobles/rebodocs`, piece for piece, so that one
habit serves both.

| Rebodocs | ReboFiles | What it holds |
| --- | --- | --- |
| `packages/core` | `packages/core` | The model of a drive: the tree, names, moving, the trash, versions, search. Pure functions over an immutable model, no DOM, no runtime dependencies. |
| `packages/editor` | `packages/drive` | What a person sees and touches, without a framework, using only the public API of core. Every text through `t()`, in Spanish and English. |
| `packages/react` | `packages/react` | `<FileDrive>` and the headless hooks (`DriveProvider`, `useFolder`, `useFile`, `useUpload`). No logic of its own: it mounts the drive and exposes it. |
| `packages/collab` | `packages/server` | The routes, `authorize()`, and the two adapters: the bytes (S3, disk) and the metadata (memory, SQLite, Postgres). |
| `packages/mcp` | `packages/mcp` | The tools for an assistant: list, search, read, move, rename, trash. |
| `apps/desktop` | `packages/sync` + `apps/desktop` | The sync engine as a package (`@rebofiles/sync`, as `@rebofiles/desktop` is the application's name); the Tauri application that uses it. |
| `apps/site` | `apps/site` | Next.js 16 and Tailwind 4, the landing of the handoff, the docs, the status page. |
| `apps/demo` | `apps/demo` | The drive running entirely in the browser, on memory: the one on the landing. |
| `apps/playground` | `apps/playground` | `npm run dev`: the drive against a local server and a folder of the disk. |
| `apps/storage` | `apps/storage` | Against a real bucket (R2, S3, MinIO), with its `.env.example`, `cors` and `seed`. |
| `apps/crm` | `apps/crm` | Later: inside an application of records, with "Open in Rebodocs". |
| `test-documents/` | `test-files/` | Files of every type the previews read, made in code, none from a real person. (`/files/` is ignored by git, for real ones.) |
| `tools/` | `tools/` | `api-report.mjs`, `package.mjs`, `a11y-audit.mjs`, copied as they are. |

At the root, the same files: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
`LICENSE` (MIT), `THIRD_PARTY_NOTICES.md`, `biome.json` (200 wide),
`vitest.config.ts` (projects `node` and `browser`), `tsconfig.json` (strict),
and `package.json` as an npm workspace of `packages/*` and `apps/*`, Node
22.12 or later, with the same script names (`dev`, `demo`, `storage`,
`desktop`, `test`, `test:browser`, `typecheck`, `lint`, `format`, `api`,
`coverage`).

The same rules:

- **One version for every package**, as in Rebodocs. Before 1.0 a minor
  version may change the API, and `CHANGELOG.md` says what to do about it
  under **Changed**.
- **Each package's README** has the sections of Rebodocs' (Install, Usage,
  What is in it, The API, Status, License) and ends with **Where it can
  improve**.
- **The documentation** is laid out as Rebodocs': a bar with ⌘K, the pages
  by group beside them, “On this page”, and the page before and after. Each
  page is `apps/site/components/docs/pages/*.tsx`; the reference is
  `reference.ts`, and the routes are read from the comment of
  `packages/server/src/api.ts`. The status page is `status/data.ts`: the
  numbers come from running the commands, with the date they were taken
  (`MEASURED`).
- **Rebodocs is optional.** `@rebodocs/core` is an optional peer dependency,
  for previews of DOCX; "Open in Rebodocs" is a callback the application
  gives (`onOpenDocument`), not an import.

## Decided before the first line

- **Where the metadata lives.** A bucket has no folders, owners, permissions
  or trash. Those go in a metadata adapter, beside the bytes adapter; the key
  of a file in the bucket is its id, never its path, so moving and renaming
  never touch the bytes.
- **The bytes never pass through the server.** Uploads go straight to the
  bucket in parts, with signed addresses; downloads too. The server signs and
  records; it does not carry. On disk, the server does carry, and says so.
- **Who may do what is the application's.** `authorize(user, action, file)`
  is asked on every route, as Rebodocs' collaboration server asks its
  backend.

## What is checked

Taken on October 28, 2026, by running `npm test`, every one passing:

- `packages/core` · 72 · Names, the tree, renaming and moving, the trash and the trash that empties itself, versions, search, changes; the top of the drive for each owner, roles inherited down the tree, Shared with me and what is new in it, links with a password or a number of uses; settings, space, archives, activity told from two drives, text found in a file, folder colours and placeholders. Requests for files read as given, and shares that end.
- `packages/server` · 159 · The routes on the disk and on an S3 kept in memory, uploads in parts, resumed and given up, quotas, deleting in one request, who may do what, sharing with two people and links read without signing in, with a password or for one download, news of what is shared and `onShare`, the same file found again, settings, pictures in sizes, addresses good for an hour, the drive held in memory, activity and text on memory, SQLite, Postgres on PGlite and in the process, pages of another origin, and the signature against AWS's example. One more, two processes on one Postgres, runs with `REBOFILES_TEST_POSTGRES`: passed on Postgres 16 on October 25, 2026, twenty folders made at once by two pools, twenty names. Uploads refused before and after they arrive (beforeUpload, the type of their bytes, a ClamAV that knows EICAR, and one that is down); uploads left halfway swept from a bucket and the disk; the events, each told only what they may see, from this process and from another on the same SQLite, and the client coming back after a cut. The drive a piece at a time: what SQLite and Postgres answer to each query is what the drive held whole answers, rows of before filled once, and two hundred thousand entries on SQLite listed in 22 ms, never read whole. Comments, a legal hold, a minimum of days, everything of a person exported; onChange, the logger, OpenTelemetry, limits; only the parts of a version that changed sent; pictures and text made by the server with sharp and pdf.js. Copies of a file; requests for files sent signed out, looked at, and reminded of by email; the people and groups of a directory; webhooks signed and tried again; and `onRead` told who read what.
- `packages/drive` · 46 · The client against the routes and against a bucket: folders, sharing, links, uploads in parts with progress, resumed after a cut, the headers a bucket signed, versions, refusals, the trash; the queue of uploads, three at a time, its speed and time left, the same file or name asked about; folders of the computer read as they were; the .zip written and read back; the text of a file; sizes, dates and kinds of file; the drive kept in the page; what the server refused, said in each language. A QR code drawn as SVG.
- `packages/mcp` · 19 · The protocol and every tool over HTTP and stdio against a drive in the same process: two people's assistants, each seeing and doing only what its person may; activity, a search by what is written, folder colours; Word documents read and edited with Rebodocs, each change a version. Driven also by the protocol's official SDK as a client.
- `packages/react` · 10 · The hooks in components, against the drive kept in the page: a folder, a search, Recent and the trash asked again after a change; a view loading as itself; useEntry after a rename; settings and the language following them; uploads and their end; what someone else changed shown without asking; and `<FileDrive>` beside the hooks.
- `packages/sync` · 8 · A folder of the disk and a drive behind its routes kept the same: made, changed, moved, renamed and taken away on each side; both changed kept twice; a folder and a file of one name; the files of the systems left out; a disk found empty refused; a sync that goes on, run by the events and by the disk.
- `examples` · 5 · Next.js, Express, Hono and Fastify, each served on a port and asked over HTTP: a folder, a file of two parts uploaded and read back, the events of a change; and who asks from a JWT, a forged one refused.
- `apps/desktop` · 5 · Which server the window is of, kept and tried; and, in Rust (`cargo test`), a name taken in Downloads made free, a path of the folder synced that would leave it refused, and what is listed, moved and taken away there.

### The interface

`npm run test:browser` · 72 · The playground in Chrome with Playwright, real clicks and keys: a folder made and opened, uploads in parts, the preview and the viewer, "(2)" when asked, renaming with F2, the trash with Delete and back, search by name and by what is written, moving, emptying the trash, the drive in Spanish at the width of a phone. Sharing with Bea, a link opened signed out until it is taken back, one with a password, what is new in Shared with me. The panel of uploads, several at once, stopped, resumed; folders dropped; the same file and the same name asked about; .zip of what is picked and of a link's folder, and what it left out. The list in an order of one's choosing, the menu of an entry, undo; settings, storage and quotas; activity; folder colours and pictures shown blurred while they come. The keyboard alone; axe, by WCAG 2.2 AA, on every state, light and dark; the drive with no framework, and a whole drive built from the hooks alone; the demo's Claude through the MCP tools. A folder made and renamed in one window seen in another without loading again; a folder of four hundred, of which only what is in sight is in the page, gone through with the keyboard, in the list and the grid. A copy made from the menu; a share for a week, until when; requests for files sent signed out, with documents and photos, and looked at in Received; the drive without its own bar, driven by the application’s, and kept in a folder.

By hand:

Driven in Chrome on the playground and against Cloudflare R2: a Word document uploaded, previewed as a page, its first page made a picture, opened in Rebodocs, changed, saved with ⌘S, and back as its second version; pictures in four sizes; a .zip of six files. The demo: Acme's files made in the page, Claude's rename and its card. The landing built as plain files and seen at the width of a desktop and of a phone. The desktop application built as ReboFiles.app on a Mac, its page against the playground from another origin, an upload in parts through it.

## What is not

- `Other buckets.` Cloudflare R2 only, on October 25, 2026: `npm run storage:check` from Node (one PUT, parts, versions, a download shown in the page, an upload given up, the deletion in one request), and the page by hand with its rule of origins. Not AWS, MinIO or Backblaze yet. Azure against Azurite only, Microsoft's emulator, from Node; Google Cloud Storage against an S3 kept in memory only: neither against the real service, nor from a page.
- `Other browsers.` Chrome and WebKit (Safari's engine, the desktop window's) by the tests, every one in each. Firefox in the workflow only: Playwright's Firefox does not start on this Mac. Not on a real phone.
- `Two processes on SQLite.` SQLite was opened by two handlers one after the other for changes; the events of one were seen by the other. For more than one process that writes, Postgres.
- `Windows and Linux.` The Desktop workflow builds and tests the application on both; it has not run yet, and nobody has used it there.
- `The workflows.` CI, Desktop and Release are written; none has run on GitHub yet.

## Known limits

Storage

- An upload left halfway stays in the bucket as parts for a day, to be gone on with; after that the server sweeps it, as requests come.

Metadata

- SQLite, Postgres and memory are asked a piece at a time (two hundred thousand entries listed in milliseconds); a store of one's own without `scoped` is held whole in memory.
- Changes are put in order inside one process only, but on Postgres with a pool, where a lock of the database orders them across processes.

Uploads

- Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.
- The same file is told by a SHA-256 made in the page, up to 64 MiB; a larger one only by its name.
- A PDF's first page and its text are made by the server with `derive` (pdf.js); without it, none.

Sharing

- People and groups (`group:sales`) are named by the ids the application gives them; who is in a group is the application's, given by `identify`.
- Links are for viewers only.
- An editor who moves something of someone else's to the top of the drive puts it in its owner's My files.
- Sharing is asked of `byRoles`, or of an `authorize()` of the application's that asks it; one that answers yes to all lets anyone share anything.

## Roadmap

In the order it is built. Each version is published to npm when its last
item is checked, and not before; until 0.1.0 is on npm, the landing shows no
install command.

### 0.1.0 · A drive that works

1. ✅ **`core`:** the tree, names that do not repeat in a folder (`contract (2).docx`),
   moving, renaming, the trash with its restore, versions, search by name.
2. ✅ **`server`:** the routes, `authorize()`, bytes on S3 and on disk,
   metadata in memory and SQLite, uploads in parts with signed addresses.
   Tested against an S3 kept in memory, as `apps/storage` is in Rebodocs.
3. ✅ **`react`:** `<FileDrive>` with the list and the grid, folders, search,
   upload, the details panel and its versions, the trash.
4. ✅ **Previews** of pictures and PDF with what the browser has; of DOCX with
   `@rebodocs/core` when it is installed. "Open in Rebodocs".
5. ✅ **`apps/demo`, `apps/playground`, `apps/storage`**, and the storage one
   run by hand against Cloudflare R2 (`npm run storage:check`, then the page).
6. ✅ **`apps/site`:** the landing of the handoff, Getting started (`/docs/`),
   and the status page (`/status/`, from `components/docs/status/data.ts`).

Builds to publish are made (`npm run build:packages`) and were installed
from their tarballs in an empty project: a server on `node:http`, the client
uploading and reading back over the network, `<FileDrive>` rendered on a
server, the preview of a Word document, a strict typecheck.

### 0.2.0 · Sharing

7. ✅ Owner, editor, commenter and viewer, on files and folders, inherited
   down the tree (`byRoles`). "Shared with me", and My files of one's own
   (`top: 'everyone'` for one drive of a whole team).
8. ✅ Links with an expiry, signed by the server, taken back by removing them;
   `<SharedLink>` for who opens one.
9. ✅ Metadata on Postgres (`postgresMetadata`), with a lock of the database
   for more than one process.

### 0.3.0 · Your own UI

10. ✅ **`drive`** split out of `react`, without a framework, as `editor` is in
    Rebodocs: `mountDrive`, which `<FileDrive>` mounts.
11. ✅ The headless hooks, documented with a whole drive screen built from them
    (`/docs/hooks/`, `apps/playground/headless.html`).
12. ✅ **Accessible:** every action from the keyboard, what a screen reader is
    told, axe on every page with a drive, a dark theme (`theme`). Tests in
    Chrome with Playwright.

### 0.4.0 · Assistants

13. ✅ **`mcp`:** the tools, with `authorize()` asked for the assistant too,
    over HTTP and stdio.
14. ✅ Claude in the demo, as on the landing: a rename it makes, and seen.
15. ✅ Rebodocs' MCP and ReboFiles' together: find a contract, open it, change
    it, save it as a new version.

### 0.5.0 · Big files and other storage

16. ✅ Uploads that resume after a cut, and files of several gigabytes.
17. ✅ Google Cloud Storage and Azure Blob: `gcsStorage` through GCS's XML
    API, `azureStorage` with SAS addresses, tried against Azurite. (R2, MinIO
    and Backblaze are S3 already.)

### 0.6.0 · The desktop

18. ✅ **`sync`:** a folder of the disk kept like a folder of the drive, both
    ways (`@rebofiles/sync`, `rebofiles-sync`). Two changes to one file keep
    both, the second as a copy beside it.
19. ✅ **`apps/desktop`:** the Tauri application, on a Mac first: the drive
    in a window, against a server, and the sync of 18 in it (Server → Sync a
    Folder…). Built for Windows and Linux by the Desktop workflow; signed
    when it is given the certificates.

### 1.0.0

20. **Use it in a real application,** and fix what that shows.
21. The API settled, and kept from then on.

### After 1.0 · Vaults, encrypted end to end

A folder whose files the page encrypts before they go and decrypts when they
come back: neither the server, nor the bucket, nor the database sees what is
in them, and a leak of either gives away only ciphertext. Opt-in, a folder at
a time ("New vault"), as it costs what the server does with the bytes: its
pictures and text (`derive`), the checks (`inspect`), search by what is
written, the same bytes found across the drive, the assistant. Holds, the
days things are kept, the trash, versions, activity and quotas stay, being
metadata. A package of its own, `@rebofiles/vault`.

22. **A vault of one's own.** A key for each file (AES-256-GCM), wrapped by
    the vault's, wrapped by the person's; each part encrypted apart, so
    uploads straight to the bucket, resuming and `copyPart` go on as they
    are, and blocks of 64 KiB inside a part for seeking in a video. The
    person's key unlocked by a passkey (WebAuthn's PRF) or a phrase
    (Argon2id), apart from the application's sign-in, with a recovery key to
    keep; nothing brings it back without them, unless a drive chooses a key
    of its administrator's. The pictures and text the page makes, encrypted
    too; the hashes of parts keyed (HMAC), for only what changed to be sent.
    Names stay readable by the server. WebCrypto only, the same code in the
    page, Node and the desktop. Rebodocs makes, writes and reads in the page,
    as it does now.
23. **Shared.** Each person's public key on the server, and a vault's key
    wrapped for each who may open it; groups with a key of their own; a
    fingerprint to compare, as a server could hand over a key not theirs.
    Taking someone out turns the vault's key over, for what comes after.
    Links carry the key in the address's fragment (`#k=`), which never
    reaches the server.
24. **Names and comments encrypted too,** and search by name from an index
    kept encrypted, read in the page.
25. **Out of the browser:** the sync and the desktop with the keys in the
    system's keychain, and an assistant given a vault's key by hand.

What it does not keep from: a server that hands the page code of its own,
as any encryption in a web page cannot; the desktop application, with its
code inside it, does. Learnt from MEGA, whose keys were recovered in 2022
through their own unauthenticated wrapping: authenticated encryption
everywhere, keys wrapped included, a key for each use, formats with a
version, and an audit by others before it is called secure. 22 first, tried
in an application, before the rest.

## Contributing

`CONTRIBUTING.md` copied from Rebodocs' and changed where the packages
differ: where things go, the conventions, the tests.

## License

MIT. Anyone may use it for anything.
