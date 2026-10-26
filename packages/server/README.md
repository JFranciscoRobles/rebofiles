<h1 align="center">@rebofiles/server</h1>

<p align="center">
  The backend of a drive: its routes, who may do what, the bytes on S3 or the disk, the metadata in memory or SQLite. No dependencies but core.
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

## What is in it

| Area | What it does |
| --- | --- |
| **Routes** | Listing, search, folders, uploads in parts, renaming, moving, the trash, versions, downloads. The list is at the top of `src/api.ts`. |
| **Who may** | `identify(request)` says who is asking; `authorize(user, action, entry, drive)` is asked on every route, also again when an upload finishes. |
| **Bytes** | `s3Storage` for AWS S3, Cloudflare R2, MinIO, Backblaze B2; `diskStorage` for a folder. |
| **Metadata** | `memoryMetadata`, `sqliteMetadata`. Changes go one at a time and write only what changed. |

## Status

Tested through its routes in `test/api.test.ts`, on the disk and on an S3
kept in memory; the signature against AWS's example. Run against Cloudflare
R2 with `npm run storage:check` and by hand in the page (`apps/storage`); not
against AWS or MinIO yet. Not on npm yet.

## Where it can improve

- **Other buckets.** R2 is checked; AWS and MinIO not yet.
- **One process.** Changes are put in order inside a process; two processes
  on one database need a lock of the database.
- **The whole drive loaded on each request.** Fine for a team, not for a
  drive of millions of entries.
- **Uploads left when the page is closed halfway** stay in the bucket as
  parts until a lifecycle rule takes them; one that fails or is stopped is
  given up.
- **Postgres**, in 0.2.

## License

MIT
