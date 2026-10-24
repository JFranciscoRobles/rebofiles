# Contributing

## Setting up

```bash
npm install
npm test            # Vitest
npm run typecheck   # tsc, over every package
npm run lint        # Biome: the format and the lint rules, as biome.json says
npm run format      # Biome, writing: the format and the fixes that are safe
npm run coverage    # what the tests reach, file by file
```

The format is Biome's, 200 characters wide; `npm run format` before a
commit leaves nothing for `npm run lint` to say about it.

Node 22.12 or later. The repository is an npm workspace; packages import each
other as source, so there is no build step while developing.

## Where things go

- A rule about the drive (what a move does, when two names are the same,
  what emptying the trash deletes) belongs in `packages/core`, as a pure
  function with a test.
- What reaches a storage or a database, and who may do what, belongs in
  `packages/server`, using only the public API of core.
- What a person sees or touches will belong in `packages/drive`;
  `packages/react` will hold no logic of its own: it mounts the drive and
  exposes it.

Each package's README ends with a list of where it can improve. Those are
good places to start.

## Conventions

- **TypeScript, strict.** No `any`.
- **The model is immutable.** An operation returns a new `Drive` and shares
  what it did not change. Never mutate one.
- **Comments say why, not what**, in plain English, in the voice of the ones
  already there.
- **No runtime dependencies.** core has none and server has only core: S3 is
  signed with `node:crypto`, SQLite is `node:sqlite`.

## Tests

- Changes to core need a test in `packages/core/test`.
- Changes to the server are tested through its routes, as a browser would ask
  them, on the disk and on an S3 kept in memory (`packages/server/test/helpers.ts`).
- A signature is tested against AWS's own examples.

## Publishing

Every package is built as Rebodocs builds its own (`tools/package.mjs`): its
code in files of its own, its types beside them, and a `package.json` of its
own in `dist/`, which is what goes to npm. The `package.json` beside the
sources stays the one the repository uses.

```bash
npm run build:packages                          # dist/ of every package
npm publish ./packages/core/dist                # then server, react, in that order
```

Before a release: `npm test`, `npm run typecheck`, `npm run lint`; the
version of every package moved together; the heading of **Unreleased** in
`CHANGELOG.md` turned into the version and its date; `PUBLISHED` turned on in
`apps/site/lib/home.ts`.

## Files

**Never commit a real file.** `/files/` is ignored by git for that reason.
Tests make their bytes in code.

## Commits

One change per commit, with a message that says what changed and why.
