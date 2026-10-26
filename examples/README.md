# Examples

The server of a drive in each framework, and who is asking from each way of
signing in. Each is served on a port and asked over HTTP by
[`test/frameworks.test.ts`](test/frameworks.test.ts): a folder made, a file
of two parts uploaded and read back, and the events of a change.

| | |
| --- | --- |
| [`drive.ts`](drive.ts) | The drive all of them serve: a bucket when `S3_BUCKET` says one, else the disk; SQLite. |
| [`nextjs/`](nextjs/app/api/files/[...path]/route.ts) | One route handler of the App Router. |
| [`express/`](express/server.ts) | Mounted before the parsers of the body. |
| [`hono/`](hono/server.ts) | Hono's request is the drive's. |
| [`fastify/`](fastify/server.ts) | In a plugin with no parser of its own. |
| [`auth/dev.ts`](auth/dev.ts) | Anyone as anyone, for this computer; refuses to run in production. |
| [`auth/jwt.ts`](auth/jwt.ts) | A token of your own, in a cookie or as Bearer. Tested. |
| [`auth/authjs.ts`](auth/authjs.ts), [`auth/clerk.ts`](auth/clerk.ts) | Auth.js and Clerk, written to their documentation; not run here, as they need accounts of theirs. |

```bash
npx tsx examples/express/server.ts    # or hono, fastify: the drive at http://localhost:3000/api/files
```

In an application of your own, `drive.ts` and the file of your framework are
what you copy; the imports of `@rebofiles/server` are the package's.
