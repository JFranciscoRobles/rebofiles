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
| `apps/desktop` | `packages/desktop` + `apps/desktop` | The sync engine as a package; the Tauri application that uses it. |
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
- **The status page** is `StatusPage.tsx` plus `data.ts`: the numbers come
  from running the commands, with the date they were taken (`MEASURED`).
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

Taken on October 25, 2026, by running `npm test`, every one passing:

- `packages/core` · 44 · Names, the tree, renaming and moving, the trash, versions, search, changes; the top of the drive for each owner, roles inherited down the tree, Shared with me, links.
- `packages/server` · 39 · The routes on the disk and on an S3 kept in memory, uploads in parts and given up, deleting in one request, who may do what, sharing with two people through the routes and links read without signing in, SQLite across two processes, Postgres on PGlite, and the signature against AWS's example. One more, two processes on one Postgres, runs with `REBOFILES_TEST_POSTGRES`: passed on Postgres 16 on October 25, 2026, twenty folders made at once by two pools, twenty names.
- `packages/drive` · 19 · The client against the routes: folders, sharing, links, uploads in parts with progress, the headers a bucket signed, an upload given up, versions, refusals, the trash; sizes, dates and kinds of file; the preview of a Word document; the drive kept in the page.
- `packages/mcp` · 10 · The protocol and every tool over HTTP and stdio against a drive in the same process: two people's assistants, each seeing and doing only what its person may; Word documents read with Rebodocs. Driven also by the protocol's official SDK as a client, over stdio from the command installed from its tarball and over HTTP from the playground, on October 25, 2026.

### The interface

`npm run test:browser` · 19 · The playground in Chrome with Playwright, real clicks and keys: a folder made and opened, a text and a file in parts uploaded, the preview, a second upload as "(2)", renaming with F2, the trash with Delete and back, search, moving from the dialog, emptying the trash, the drive in Spanish at the width of a phone with no sideways scroll. Ana sharing a folder with Bea as an editor, Bea finding it in Shared with me and putting a file in it, a link copied and opened by someone signed out, until it is taken back. The drive with the keyboard alone: the menu by its arrows, folders made and opened, an upload, F2, moving from the dialog, the trash, and where one is said at each step. axe, by WCAG 2.2 AA, on every state reached: empty and with files, the list and the grid, each dialog, the trash, Shared with me, a search, Spanish at the width of a phone, a link signed out, and the same in the dark theme, chosen and as the system is. The drive on a page with no framework, with no module of React loaded; and a whole drive built from the hooks alone.

By hand:

Driven in Chrome without a window, with real clicks and keys, on the playground: a folder made, two files uploaded into it, a text previewed, a second upload with the same name as "(2)", renaming with F2, the trash with Delete and back, search, moving from the dialog, the grid with a picture, and the drive in Spanish at the width of a phone. A Word document uploaded, previewed as a page, opened in Rebodocs, changed, saved with ⌘S, and back in the drive as its second version. The demo: Acme's files made in the page, a Word document and a PDF previewed, Claude's rename and its card, the grid with pictures, an upload in steps, the trash emptied. The landing built as plain files and seen at the width of a desktop and of a phone, the demo working in its frame, with no errors in the page and no sideways scroll.

## What is not

- `Other buckets.` Cloudflare R2 only, on October 25, 2026: `npm run storage:check` from Node (one PUT, parts, versions, a download shown in the page, an upload given up, the deletion in one request), and the page by hand with its rule of origins. Not AWS, MinIO or Backblaze yet.
- `Other browsers.` Chrome only; not Safari or Firefox, and not on a real phone.
- `Two processes on SQLite.` SQLite was opened by two handlers one after the other, not at once; for more than one process, Postgres.

## Known limits

Storage

- An upload that fails or is stopped is given up, and what of it arrived taken away; one left when the page is closed halfway stays in the bucket until a lifecycle rule of the bucket takes it.

Metadata

- The whole drive is loaded on each request, and each change copies the map of entries: fine for tens of thousands of entries.
- Changes are put in order inside one process only, but on Postgres with a pool, where a lock of the database orders them across processes.

Uploads

- Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.
- No resuming yet after the page is closed.

Sharing

- People are named by the id the application gives them; there are no groups but everyone signed in (`*`).
- Links are for viewers only. A commenter may do what a viewer may, as there is nothing to comment on yet.
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
17. Google Cloud Storage and Azure Blob. (R2, MinIO and Backblaze are S3
    already.)

### 0.6.0 · The desktop

18. **`desktop`:** a folder of the disk kept like a folder of the drive,
    first one way, then both. Two changes to one file keep both, the second
    as a copy beside it.
19. ✅ **`apps/desktop`:** the Tauri application, on a Mac first: the drive
    in a window, against a server. The sync of 18 goes into it once made.

### 1.0.0

20. **Use it in a real application,** and fix what that shows.
21. The API settled, and kept from then on.

## Contributing

`CONTRIBUTING.md` copied from Rebodocs' and changed where the packages
differ: where things go, the conventions, the tests.

## License

MIT. Anyone may use it for anything.
