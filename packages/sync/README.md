# @rebofiles/sync

A folder of the disk kept as a folder of the drive, both ways: what changes
on one side goes to the other, what changed on both is kept twice, moves
are followed. The engine runs anywhere a folder can be read and written; on
Node, a folder of the disk and a sync that goes on. The desktop application
(`apps/desktop`) runs it in its window.

## Install

```bash
npm install @rebofiles/sync
```

## Usage

```bash
npx rebofiles-sync ~/ReboFiles --server https://app.example.com/api/files --token "$TOKEN"
npx rebofiles-sync ./Clients --server … --folder <id> --once
```

```ts
import { createDriveClient } from '@rebofiles/drive';
import { watchSync } from '@rebofiles/sync';

const client = createDriveClient({ base: 'https://app.example.com/api/files', headers: () => ({ authorization: `Bearer ${token}` }) });
const sync = watchSync({ client, folder: '/Users/ana/ReboFiles', onAction: console.log });
```

Elsewhere (a desktop application, a test), `syncOnce({ client, local, state })`
with a `LocalFolder` of your own: list, read, write, mkdir, remove, move, stat.

## What is in it

| | |
| --- | --- |
| `syncOnce` | One run: both sides listed, compared with the state the last run left, made the same. What it did, and the state for the next. |
| `nodeFolder` | A folder of the disk as a `LocalFolder`: files written beside and put in place whole; what is taken away kept in `.rebofiles/removed/`. |
| `watchSync` | Runs when the drive tells a change (its events), when a file of the disk changes, and every minute; the state in `.rebofiles/state.json`. |
| `rebofiles-sync` | The same as a command. |

Each run: new on one side is made on the other; changed on one side is sent
or taken; changed on both keeps the drive's at its name and the disk's
beside it as "name (conflict 2026-10-26 14.05).ext"; gone from the disk goes
to the drive's trash, gone from the drive is put aside on the disk, unless it
changed since on the other side. A move in the drive is a move on the disk;
a file moved on the disk is found by its size and time and moved in the
drive, with its versions. An empty folder of the disk where there were files
is taken for a disk not there: nothing is done (`allowEmpty`).

## Status

Tested in `test/` against a server behind its routes and a folder of the
disk: every rule above, and a sync that goes on. In the desktop application
its commands are tested in Rust; it has not been driven in the window by
tests. On npm.

## Where it can improve

- **A folder renamed on the disk** is sent again as a new one.
- **Whole files.** A change sends the file again, not the part of it.
- **Watching the disk in the desktop application.** It looks every half a
  minute and when the window comes to the front, not as each file changes.

## License

MIT
