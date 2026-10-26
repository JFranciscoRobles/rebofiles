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

## What is in it

| Area | What it does |
| --- | --- |
| **Routes** | Listing, search, folders, uploads in parts, renaming, moving, the trash, versions, downloads. The list is at the top of `src/api.ts`. |
| **Who may** | `identify(request)` says who is asking; `authorize(user, action, entry, drive)` is asked on every route, also again when an upload finishes. |
| **Bytes** | `s3Storage` for AWS S3, Cloudflare R2, MinIO, Backblaze B2; `diskStorage` for a folder. |
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
- **The whole drive loaded on each request.** Fine for a team, not for a
  drive of millions of entries.
- **Uploads left when the page is closed halfway** stay in the bucket as
  parts until a lifecycle rule takes them; one that fails or is stopped is
  given up.

## License

MIT
