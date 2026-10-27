<h1 align="center">@rebofiles/server</h1>

<p align="center">
  The backend of a drive: its routes, who may do what, the bytes on S3 or the disk, the metadata in memory, SQLite or Postgres. No dependencies but core.
</p>

---

The bytes do not pass through it. The browser asks where to send a file,
sends it to the bucket at addresses signed for its exact length, and says
when it is done; the server checks what arrived and lists it. A download is
an address signed for a few minutes. On the disk, which a browser cannot
reach, the server carries the bytes itself, at addresses of its own.

## Install

```bash
npm install @rebofiles/server
```

## Usage

```ts
import { createServer } from 'node:http';
import { createDriveHandler, diskStorage, memoryMetadata, nodeHandler, everyone } from '@rebofiles/server';

const handle = createDriveHandler({
  storage: diskStorage({ folder: './storage', secret: process.env.REBOFILES_SECRET! }),
  metadata: memoryMetadata(),
  ...everyone(), // only on your own machine: no sign-in, everyone may do everything
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

createServer(nodeHandler(handle)).listen(3000);
```

`createDriveHandler` takes a `Request` and gives a `Response`, so the same
handler is a Next.js route handler, a Bun or Deno server, or a Worker.

## On Postgres

For more than one process, or a host without a disk of its own. The driver is
yours: `postgresMetadata` takes anything with `query(text, values)` that
answers `{ rows }`, and makes its table the first time.

```ts
import pg from 'pg';
import { postgresMetadata } from '@rebofiles/server';

const metadata = await postgresMetadata(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
```

Given a pool (anything with `connect()` as well), each change holds a lock of
the database while it reads and writes the drive, so two servers never change
it at once: without one, two folders made at the same moment could both be
"(2)". A change is written in one statement, so it is whole or not at all.
Neon's `Pool` is `pg`'s; with `postgres.js`, `{ query: (text, values) =>
sql.unsafe(text, values).then((rows) => ({ rows })) }` works, on one process.
`{ table: 'acme_files' }` for a table of another name.

## Settings, and pictures in four sizes

`GET /settings` gives the drive's settings, the one asking's own over them,
and whether they may change the drive's: `PUT /settings`, for whoever
`authorize` lets `configure` (with `byRoles`, a user `identify` gives as
`{ id, admin: true }`); `PUT /settings/mine` for one's own language and
theme. They are kept by the metadata store (a table beside the entries in
SQLite and Postgres), and `settings` on `createDriveHandler` gives the
defaults: language, theme, the colour of the brand, and the four sizes
pictures are made in, as JPEG (the default) or as the original's type.

The browser makes the smaller pictures when an image is uploaded and sends
them as `POST /uploads` with `{ rendition: { file, version, size, width,
height } }`; they are kept with the version, the original untouched, and
`GET /entries/:id/download?size=320` gives the smallest that shows it at
that size. They come back with a version restored and go with the file.

## Space, the trash, and what comes in twice

`quota` and `trashDays` in the settings give each person the bytes they may
keep (every version counted) and the days the trash keeps what is put in it.
An upload past one's quota is refused before anything goes (`413
over-quota`; `GET /usage` says how much is used, of how much); the trash is
looked at every ten minutes, as requests come, and what has been in it long
enough is deleted, its bytes with it. The page may send the SHA-256 of a file
as it uploads it (`sha256` on `POST /uploads`), kept with the version, and
`POST /duplicates { hashes }` says which files have those bytes already,
among what the one asking may read.

## Links, news and activity

`POST /entries/:id/links { days, password, once }` makes a link for a day
to ninety, opened only with its password when one is given (kept as scrypt
makes it, apart from the drive, asked as `x-link-password` at every request)
and good for one download when `once`, which still works a quarter of an
hour after, for the files of that download. `onShare(event)` is called with
each share, to tell the person by mail or as yours does; `GET /shared/new`
counts what is new in Shared with me since `POST /shared/seen`. Every change,
whatever made it, is kept as activity (`GET /entries/:id/activity`), by the
store in a table of its own.

## Pages of another origin

The desktop application, or a page of another domain, is let in with `cors:
{ origins: ['tauri://localhost', 'https://app.example.com'] }`: the browser's
question answered first, and the `ETag` of a part readable. Only those
listed; a bucket needs the same in its own rule of origins.

## Uploads checked

Two moments to refuse a file: `beforeUpload`, before it is given addresses,
with what the page says of it; and `inspect`, once its bytes are in the
storage and before it is listed, with a `read` of them. What `inspect`
refuses is taken out of the storage.

```ts
import { Refused, checkType, clamav, inspectAll } from '@rebofiles/server';

createDriveHandler({
  // …
  beforeUpload: (upload) => {
    if (upload.type.startsWith('video/')) throw new Refused(415, 'no-videos', 'No videos here.');
  },
  inspect: inspectAll(checkType(), clamav({ port: 3310 })),
});
```

`checkType()` refuses a program, and a file whose bytes are not those of its
extension. `clamav()` asks clamd by INSTREAM; when it cannot be asked, the
file is refused with a 503, not let in unscanned.

## Changes as they happen

`GET /events` is a stream of server-sent events: each change told to each one
watching, as far as they may see it (the folders they may list, the entries
they may read). A change of another process on the same store is seen by its
revision within `live.poll` milliseconds (2000). `live: false` for none. The
client watches with `client.watch()`, and the drive and the hooks with it.

## A drive of any size

SQLite, Postgres and memory are asked a piece at a time (`scoped`): an entry
and the folders above it, what is in a folder, a search, the trash. The
drive is never loaded whole; two hundred thousand entries on SQLite list a
folder in 22 ms. A store of your own without `scoped` is held whole.

## Made by the server

`derive: deriveAll()` of `@rebofiles/server/derive` makes what no page made:
pictures and a placeholder with sharp, a PDF's first page and its text with
pdf.js, the text of Word documents, Excel workbooks and text files. `ocr()`
reads pictures and scanned PDFs with Tesseract, given to `deriveAll(…)`. Each
library is optional, imported when first needed.

## Starred, fields, notifications, the whole drive

`/starred` and `/entries/:id/star`, each person's own; fields of your
application on an entry (`PATCH /entries/:id { fields }`, `GET /fields`);
`/notifications` of what was shared with a person or a group of theirs and of
comments that name them; and, for who may configure, `/admin/usage` and
`/admin/activity`.

## Comments, groups, retention

`/entries/:id/comments` (threads, replies, resolved; `onComment` with the
@ names), shares with `group:<id>` reaching `User.groups`, `retentionDays`,
legal holds (`PUT /entries/:id/hold`) and `GET /export` of a person.

## Hooks, logs and limits

`onChange` for each thing done, `logger`, `onRequest` (`openTelemetry(meter)`),
and `limits` by person, by link and by address, a `limiter` of yours for
more than one process. A version whose parts are those of the one before is
sent without them (`partHashes`, `copyPart`).

## Addresses

The bytes are read from addresses the server signs. One to download a file
is good for 15 minutes; one to show it in the page (`inline=1`) is signed
from the start of the hour, the same all of it and good for two, with
`Cache-Control: private, max-age=7200`, so a browser keeps a thumbnail it has
read. Each answer says until when its address is good (`expires`), and
`POST /urls { ids, inline, size }` gives those of many files at once, and
`POST /zip { ids }` what an archive of some entries holds, folders with
what is in them, for the page to make it.

## What is in it

| Area | What it does |
| --- | --- |
| **Routes** | Listing, search, folders, uploads in parts, renaming, moving, the trash, versions, downloads. The list is at the top of `src/api.ts`. |
| **Who may** | `identify(request)` says who is asking; `authorize(user, action, entry, drive)` is asked on every route, also again when an upload finishes. `byRoles` is one from the drive itself: owners, and the roles of those it is shared with. |
| **Sharing** | `/shared`, `/entries/:id/shares`, and links: `/entries/:id/links` to make and take back, `/links/:token` to read without signing in, with a password or for one download if wanted. `/shared/new` counts what is new since one looked; `onShare` is called with each share, to tell the person as your application does. `top: 'own'` (the default) shows each person their own top of the drive; `'everyone'`, one drive for a team. |
| **Bytes** | `s3Storage` for AWS S3, Cloudflare R2, MinIO, Backblaze B2; `gcsStorage` for Google Cloud Storage; `azureStorage` for Azure Blob Storage; `diskStorage` for a folder. |
| **Text** | Files found by what is written in them: `PUT /entries/:id/text` with what the page read, `GET /search/text`. SQLite's full-text search, Postgres's `tsvector`. |
| **Activity** | Who did what, from each change: `GET /entries/:id/activity`, kept by the store in a table of its own. |
| **Looks** | A folder's colour (`PATCH /entries/:id { color }`), and a picture's placeholder, the tiny one shown blurred while it comes (`PUT /entries/:id/placeholder`). |
| **Metadata** | `memoryMetadata`, `sqliteMetadata`, `postgresMetadata`. Changes go one at a time and write only what changed; on Postgres with a pool, one at a time across processes too. |

## Status

Tested through its routes in `test/`, on the disk and on an S3 kept in
memory, the activity and the text on each store; the signature against
AWS's example. Postgres in
`test/postgres.test.ts`, on PGlite, and two processes on one Postgres 16 with
`REBOFILES_TEST_POSTGRES`. Run against Cloudflare
R2 with `npm run storage:check` and by hand in the page (`apps/storage`); not
against AWS or MinIO yet. Not on npm yet.

## Where it can improve

- **Other buckets.** R2 is checked; AWS and MinIO not yet. Azure against
  Azurite, its emulator; Google Cloud Storage against an S3 kept in memory.
- **One process on SQLite.** Changes are put in order inside a process; for
  more, Postgres with a pool.
- **The whole drive in memory.** It is read once and held, read again only
  when the store's revision says it changed (a listing of 20,000 entries
  went from 36 ms to under 1); but a change still loads it whole once in
  every other process, and it is all in memory: fine for a team and well
  beyond, not for millions of entries, which would need the store asked by
  folder.
- **Uploads left halfway** stay in the bucket as parts, for a day, to be
  gone on with (`POST /uploads/resume`); after that the server sweeps them
  every ten minutes, as requests come (`sweepUploads` of the storage). One
  stopped by the person is given up at once.
- **The events on a platform that cuts requests** (serverless functions):
  the page connects again, and a change in between is seen at the next one.

## License

MIT
