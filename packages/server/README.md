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
| **Bytes** | `s3Storage` for AWS S3, Cloudflare R2, MinIO, Backblaze B2; `diskStorage` for a folder. |
| **Text** | Files found by what is written in them: `PUT /entries/:id/text` with what the page read, `GET /search/text`. SQLite's full-text search, Postgres's `tsvector`. |
| **Activity** | Who did what, from each change: `GET /entries/:id/activity`, kept by the store in a table of its own. |
| **Metadata** | `memoryMetadata`, `sqliteMetadata`, `postgresMetadata`. Changes go one at a time and write only what changed; on Postgres with a pool, one at a time across processes too. |

## Status

Tested through its routes in `test/api.test.ts`, on the disk and on an S3
kept in memory; the signature against AWS's example. Postgres in
`test/postgres.test.ts`, on PGlite, and two processes on one Postgres 16 with
`REBOFILES_TEST_POSTGRES`. Run against Cloudflare
R2 with `npm run storage:check` and by hand in the page (`apps/storage`); not
against AWS or MinIO yet. Not on npm yet.

## Where it can improve

- **Other buckets.** R2 is checked; AWS and MinIO not yet.
- **One process on SQLite.** Changes are put in order inside a process; for
  more, Postgres with a pool.
- **The whole drive in memory.** It is read once and held, read again only
  when the store's revision says it changed (a listing of 20,000 entries
  went from 36 ms to under 1); but a change still loads it whole once in
  every other process, and it is all in memory: fine for a team and well
  beyond, not for millions of entries, which would need the store asked by
  folder.
- **Uploads left halfway** stay in the bucket as parts, for a day, to be
  gone on with (`POST /uploads/resume`); one never gone on with waits for a
  lifecycle rule of the bucket ("abort incomplete multipart uploads after 1
  day"). One stopped by the person is given up at once.

## License

MIT
