# Changesets

What goes in the next version, one file each: `npx changeset` asks which
packages it touches and whether it is a patch, a minor or a major, and writes
it here.

The six packages are one group (`fixed` in `config.json`): whatever a change
touches, all of them go to the same version, as the roadmap says. The apps are
left out; they are never published.

- `npm run version` takes the files here, raises the version of every package
  (and the versions they ask of each other), and deletes them. What they said
  goes in `CHANGELOG.md` by hand, under the new version, in its words: what was
  added, what changed and what to do about it.
- `npm run release` builds the packages and publishes each `dist/`, as
  `tools/package.mjs` makes it. Only by hand, or by the Release workflow run by
  hand: nothing is published by a push.
