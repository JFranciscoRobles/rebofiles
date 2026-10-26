# Demo

The drive entirely in the browser: Acme's files kept in the page with
`createMemoryClient`, no server. Word documents are previewed and opened in
Rebodocs, and three seconds in, Claude renames a contract through MCP: it
searches for it, reads its client with Rebodocs' `read_document` and renames
it, each a JSON-RPC message answered by the real tools of `@rebofiles/mcp`
over the drive in the page (`src/routes.ts` answers the server's routes
there). Its card shows each call as it is made. It is the one on the
landing.

```bash
npm run demo    # from the root: http://localhost:5181
```

`?lang=es` in Spanish, `?view=grid` with the grid, `?claude=0` without Claude.

The files are made in the page (`src/files.ts`): the Word documents with
Rebodocs' engine, the PDFs written by hand, the pictures drawn on a canvas.
None is a real document. Nothing outlives the page.

`DemoDrive` is the component the landing puts in its frame.

`npm run test:browser` goes through Claude's rename in Chrome
(`test/claude.spec.ts`), and through it being left alone when the person
renamed the contract first.
