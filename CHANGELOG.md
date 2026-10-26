# Changelog

Every package of ReboFiles is released at the same version. Before 1.0, a
minor version (0.x.0) may change the API; such changes are listed under
**Changed** with what to do about them.

## Unreleased

### Added

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
- **What a screen reader is told.** Where one is and how many items are
  there, once a view has loaded; an upload's progress as a progress bar, no
  longer read out at every step; a failed upload as an alert.

### Changed

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

### Fixed

- **A view said loading while it is.** In the render after the view changes,
  `useEntries` gave the last view's entries as if they were this one's.

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

