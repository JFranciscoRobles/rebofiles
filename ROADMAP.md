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

Taken on October 24, 2026, by running `npm test`, every one passing:

- `packages/core` · 31 · Names, the tree, renaming and moving, the trash, versions, search, changes.
- `packages/server` · 19 · The routes on the disk and on an S3 kept in memory, uploads in parts, who may do what, SQLite across two processes, and the signature against AWS's example.
- `packages/react` · 13 · The client against the routes: folders, uploads in parts with progress, versions, refusals, the trash; sizes, dates and kinds of file; the preview of a Word document; the drive kept in the page.

### The interface

Driven in Chrome without a window, with real clicks and keys, on the playground: a folder made, two files uploaded into it, a text previewed, a second upload with the same name as "(2)", renaming with F2, the trash with Delete and back, search, moving from the dialog, the grid with a picture, and the drive in Spanish at the width of a phone. A Word document uploaded, previewed as a page, opened in Rebodocs, changed, saved with ⌘S, and back in the drive as its second version. The demo: Acme's files made in the page, a Word document and a PDF previewed, Claude's rename and its card, the grid with pictures, an upload in steps, the trash emptied. The landing built as plain files and seen at the width of a desktop and of a phone, the demo working in its frame, with no errors in the page and no sideways scroll.

## What is not

- `A real bucket.` The S3 storage is tested against one kept in memory, which does not check signatures; nothing has been sent to R2, AWS or MinIO yet.
- `Other browsers.` Chrome only; not Safari or Firefox, and not on a real phone.
- `Tests in a browser.` The walk through the interface was a script run by hand, not a test the repository keeps.
- `Two processes on one database.` SQLite was opened by two handlers one after the other, not at once.

## Known limits

Storage

- A part left halfway by an upload never finished stays in the bucket until a lifecycle rule of the bucket takes it.
- Deleting is one request per key.

Metadata

- The whole drive is loaded on each request, and each change copies the map of entries: fine for tens of thousands of entries.
- Changes are put in order inside one process only.

Uploads

- Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.
- No resuming yet after the page is closed.

Sharing

- Owners only, and what `authorize()` decides. Roles come in 0.2.

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
5. **`apps/demo` ✅, `apps/playground` ✅, `apps/storage`**, and the storage one
   run by hand against Cloudflare R2.
6. **`apps/site`:** the landing of the handoff ✅, Getting started, and the
   status page. Until those two are written, the landing links to the README
   and to this file.

Builds to publish are made (`npm run build:packages`) and were installed
from their tarballs in an empty project: a server on `node:http`, the client
uploading and reading back over the network, `<FileDrive>` rendered on a
server, the preview of a Word document, a strict typecheck.

### 0.2.0 · Sharing

7. Owner, editor, commenter and viewer, on files and folders, inherited down
   the tree. "Shared with me" and "Recent".
8. Links with an expiry, signed by the server.
9. Metadata on Postgres.

### 0.3.0 · Your own UI

10. **`drive`** split out of `react`, without a framework, as `editor` is in
    Rebodocs.
11. The headless hooks, documented with a whole drive screen built from them.
12. **Accessible:** every action from the keyboard, what a screen reader is
    told, axe on every page with a drive, a dark theme. Tests in Chrome with
    Playwright.

### 0.4.0 · Assistants

13. **`mcp`:** the tools, with `authorize()` asked for the assistant too.
14. Claude in the demo, as on the landing: a rename it makes, and seen.
15. Rebodocs' MCP and ReboFiles' together: find a contract, open it, change
    it, save it as a new version.

### 0.5.0 · Big files and other storage

16. Uploads that resume after a cut, and files of several gigabytes.
17. Google Cloud Storage and Azure Blob. (R2, MinIO and Backblaze are S3
    already.)

### 0.6.0 · The desktop

18. **`desktop`:** a folder of the disk kept like a folder of the drive,
    first one way, then both. Two changes to one file keep both, the second
    as a copy beside it.
19. **`apps/desktop`:** the Tauri application, on a Mac first.

### 1.0.0

20. **Use it in a real application,** and fix what that shows.
21. The API settled, and kept from then on.

## Contributing

`CONTRIBUTING.md` copied from Rebodocs' and changed where the packages
differ: where things go, the conventions, the tests.

## License

MIT. Anyone may use it for anything.
