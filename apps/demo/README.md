# Demo

The drive entirely in the browser: Acme's files kept in the page with
`createMemoryClient`, no server. Word documents are previewed and opened in
Rebodocs, and three seconds in, Claude renames a contract through MCP. It is
the one on the landing.

```bash
npm run demo    # from the root: http://localhost:5181
```

`?lang=es` in Spanish, `?view=grid` with the grid, `?claude=0` without Claude.

The files are made in the page (`src/files.ts`): the Word documents with
Rebodocs' engine, the PDFs written by hand, the pictures drawn on a canvas.
None is a real document. Nothing outlives the page.

`DemoDrive` is the component the landing puts in its frame.
