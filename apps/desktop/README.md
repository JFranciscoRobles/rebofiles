# Desktop

The drive in a window of its own, on a Mac first: Tauri around the page of
`@rebofiles/drive`, against any ReboFiles server. The first time, it asks for
the address of the server's routes and, when the server asks for one, a token;
it keeps them, tries them again at every start, and asks again when they no
longer work. **Server → Change Server…** (⇧⌘K) asks for another.

Everything the drive does in a browser it does here: uploads in parts,
resumed after a cut; the viewer and Word documents through Rebodocs, made new
and compared between versions; fields of one's own on each file; the .zip;
sharing. What it downloads goes to Downloads, a name taken made free as
the drive does it, "report (2).pdf".

## Running it

Rust, and on a Mac Xcode's command-line tools. From the root:

```bash
npm run dev             # the playground, the server it connects to: http://localhost:5180/api/files
npm run desktop         # the window, its page from Vite at :5190
npm run build:desktop   # ReboFiles.app and a .dmg (on a Mac), in src-tauri/target/release/bundle
```

The playground lets the window in already. Another server lets it in with
`cors` on `createDriveHandler`, with the origins of the window on a Mac and on
Windows, and of its page while it is made:

```ts
createDriveHandler({ ...options, cors: { origins: ['tauri://localhost', 'http://tauri.localhost', 'http://localhost:5190'] } });
```

And a bucket the same, in its rule of origins (`apps/storage/cors.json`), as
the bytes go to it from the window straight.

The token goes as `Authorization: Bearer …`, for an `identify` that reads one.
A server whose session is only a cookie needs a token for the window: the
cookies of another origin do not go with its requests.

## A folder kept in sync

**Server → Sync a Folder…** (⇧⌘S) asks which folder of this computer,
`~/ReboFiles` unless said, and keeps it the same as the drive while the
window is open, with `@rebofiles/sync`: when it starts, when the drive tells
a change, when the window comes back to the front, and every half a minute.
The chip at the bottom says how the last run went; a click on it opens the
dialog again, to stop it. The disk is read and written by the application's
own commands (`src-tauri/src/sync.rs`), which never leave that folder; what
is taken away goes to `.rebofiles/removed/` inside it.

## Other systems, and signing

`.github/workflows/desktop.yml` builds and tests it on a Mac, Windows and
Linux: a .dmg, an installer of Windows, a .deb and an AppImage. Signed and
notarized when the certificates are given to it as secrets (`APPLE_*`,
`WINDOWS_CERTIFICATE`); unsigned otherwise, which runs with a warning the
first time.

## What it does not do yet

- Sign in through the server's page, for a server of cookies only.
- Windows and Linux: built by the workflow, not used there by hand yet.
- Its sync watches the disk every half a minute, not as each file changes.
