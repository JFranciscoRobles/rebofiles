# Desktop

The drive in a window of its own, on a Mac first: Tauri around the page of
`@rebofiles/drive`, against any ReboFiles server. The first time, it asks for
the address of the server's routes and, when the server asks for one, a token;
it keeps them, tries them again at every start, and asks again when they no
longer work. **Server → Change Server…** (⇧⌘K) asks for another.

Everything the drive does in a browser it does here: uploads in parts,
resumed after a cut; the viewer and Word documents through Rebodocs; the
.zip; sharing. What it downloads goes to Downloads, a name taken made free as
the drive does it, "report (2).pdf".

## Running it

Rust, and on a Mac Xcode's command-line tools. From the root:

```bash
npm run dev             # the playground, the server it connects to: http://localhost:5180/api/files
npm run desktop         # the window, its page from Vite at :5190
npm run build:desktop   # ReboFiles.app and a .dmg, in src-tauri/target/release/bundle
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

## What it does not do yet

- **Keep a folder of the disk like a folder of the drive.** That is the sync
  engine of the roadmap (`packages/desktop`), the next step.
- Sign in through the server's page, for a server of cookies only.
- Windows and Linux: built the same way, not tried.
- Signed and notarized: `npm run build:desktop` makes an application for this
  computer; one for others needs an Apple Developer ID.
