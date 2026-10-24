<h1 align="center">@rebofiles/core</h1>

<p align="center">
  The model of a drive: folders, names, moving, the trash, versions and search. No DOM, no Node APIs, no dependencies.
</p>

---

Everything about a drive that does not need a screen, a bucket or a
database: what an entry is, where it is, what an operation does to it and
what it refuses. The server, the interface and the assistant's tools are
built on it.

## Install

```bash
npm install @rebofiles/core
```

## Usage

```ts
import { emptyDrive, createFolder, addFile, move, moveToTrash, emptyTrash, children, search, changes } from '@rebofiles/core';

const ana = { by: 'ana', at: new Date().toISOString() };
let drive = emptyDrive();
drive = createFolder(drive, { id: 'f1', name: 'Clients', parent: null }, ana);
drive = addFile(drive, { id: 'a1', name: 'contract.docx', parent: null, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', version: { id: 'v1', key: 'a1/v1', size: 48_000 } }, ana);

const before = drive;
drive = move(drive, 'a1', 'f1', ana);
changes(before, drive); // { put: [the contract], removed: [] }: what a store writes

children(drive, 'f1'); // [contract.docx]
search(drive, 'CONTRACT'); // without minding case or accents

drive = moveToTrash(drive, 'f1', ana); // the folder, and what is in it
const { keys } = emptyTrash(drive); // the bytes to delete from the bucket
```

A `Drive` is an immutable value. Every operation returns a new one sharing
the entries it did not touch, and throws a `DriveError` with a `code` when
it cannot be done.

## What is in it

| Area | What it does |
| --- | --- |
| **The tree** | `children`, `ancestors`, `isWithin`, `subtree`, `recent`. Folders first, then files, by name as a person sorts them. |
| **Names** | `nameProblem`, `sameName`, `uniqueName`, `splitName`. A name a file system would refuse is refused; two that differ only in case or in how an accent is written are the same. |
| **Changes** | `createFolder`, `addFile`, `rename`, `move`, with `ifTaken: 'keep-both'` to add "(2)". |
| **The trash** | `moveToTrash`, `restore`, `deleteForever`, `emptyTrash`, `trash`, `isTrashed`. What is inside a trashed folder goes with it; deleting gives the storage keys no version uses any more. |
| **Versions** | `addVersion`, `restoreVersion` (a new version with the old bytes, the storage untouched), `versionNumber`. |
| **Search** | `search`, every word somewhere in the name, inside a folder or in the trash. |
| **Stores** | `changes`, `driveOf`: what changed between two drives, and a drive again from the entries a store keeps. |

## Status

Tested in `test/core.test.ts`. Not on npm yet.

## Where it can improve

- **Large drives.** Each operation copies the map of entries, and listing a
  folder goes through all of them: fine for tens of thousands, not for
  millions. An index by folder would fix both.
- **Sharing.** Owners only; roles come in 0.2.

## License

MIT
