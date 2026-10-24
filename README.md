<h1 align="center">ReboFiles</h1>

<p align="center">
  A file drive for the browser, built into your application, on your own storage.<br>
  Folders, upload, previews, versions, the trash and sharing, in packages you take one at a time.
</p>

---

ReboFiles is the drive of the Rebo suite, beside
[Rebodocs](https://www.rebodocs.com). The bytes go straight from the browser
to your bucket and back, at addresses the server signs for a few minutes; the
server keeps the entries (folders, names, owners, the trash, versions) in a
store of your choosing, and asks your application who may do what.

It is early: `core`, `server` and `react` are written and tested, nothing
is on npm yet. [ROADMAP.md](ROADMAP.md) says what is next and what is checked.

## Quick start

```ts
// app/api/files/[...path]/route.ts, in Next.js
import { createDriveHandler, s3Storage, s3OptionsFrom, sqliteMetadata } from '@rebofiles/server';

const handle = createDriveHandler({
  storage: s3Storage(s3OptionsFrom(process.env)),
  metadata: await sqliteMetadata('drive.sqlite'),
  identify: async (request) => (await session(request))?.user ?? null,
  authorize: (user, action, entry) => true, // your rules
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE, handle as PUT };
```

## Packages

| Package | What it is | Runs in |
| --- | --- | --- |
| [`@rebofiles/core`](packages/core) | The model of a drive: folders, names, moving, the trash, versions, search. | Anywhere, no DOM |
| [`@rebofiles/server`](packages/server) | The routes, `authorize()`, the bytes on S3 or the disk, the metadata in memory or SQLite. | Node 22.12+ |
| [`@rebofiles/react`](packages/react) | `<FileDrive>`, and the hooks it is built from. | React 18+ |

`drive`, `desktop` and `mcp` follow; see the roadmap.

## Development

```bash
npm install
npm run dev         # the playground, at http://localhost:5180: the drive on this computer, in storage/
npm run demo        # the demo of the landing, at http://localhost:5181: entirely in the browser
npm run site        # the landing page, at http://localhost:5182 (Next.js; npm run build:site makes it static, in apps/site/out)
npm test            # Vitest
npm run typecheck   # tsc, over every package
npm run lint        # Biome
```

[CONTRIBUTING.md](CONTRIBUTING.md) has where things go and the conventions.

## License

MIT. Anyone may use it for anything.
