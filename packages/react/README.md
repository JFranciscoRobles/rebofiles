<h1 align="center">@rebofiles/react</h1>

<p align="center">
  The drive as a React component, or as headless hooks: folders, upload, previews, versions and the trash, against @rebofiles/server.
</p>

---

## Install

```bash
npm install @rebofiles/react
```

## The whole drive

```tsx
'use client';
import { FileDrive } from '@rebofiles/react';

export default function Files() {
  return (
    <div style={{ height: '100vh' }}>
      <FileDrive base="/api/files" title="Acme Files" language="es" onOpenDocument={(file, url) => router.push(`/docs/${file.id}`)} />
    </div>
  );
}
```

That is the search, the sections (My files, Recent, Trash), the list and the
grid, the details with previews and versions, uploads by button or by
dropping files, and moving by dragging or from a dialog. Keys in the list:
the arrows, Enter to open, Delete for the trash, F2 to rename.

| Prop | What it does |
| --- | --- |
| `base` | Where the routes of @rebofiles/server are. `/api/files` unless said. |
| `headers` | Headers for every request to the server, such as a token of the session. |
| `language`, `texts` | `'en'` or `'es'`, or texts of your own with the same keys. |
| `title`, `logo` | What goes in the top bar. |
| `defaultView` | `'list'` or `'grid'`. |
| `theme` | `'light'` (the default), `'dark'`, or `'auto'` as the system is. Also on `<SharedLink>`. |
| `onOpen` | A file opened. Unless given, it opens in a new tab as the browser shows it. |
| `onOpenDocument` | Gives Word documents an "Open in Rebodocs" button. |
| `previewDocument`, `viewDocument`, `thumbDocument`, `pictureDocument`, `textDocument` | Word documents read by Rebodocs, of `@rebofiles/react/rebodocs`: `previewDocx`, `viewDocx`, `thumbDocx`, `pictureOfDocx`, `textOfDocx`, for the details, the viewer, the grid, the picture made at upload and the search. |
| `checkUploads` | `false` to upload without looking for the same file, or one of its name, in the drive first. |
| `settings` | `false` to leave out the screen of settings and its button. |
| `linkAddress` | Where a link of the drive points: the page of yours with `<SharedLink>`. This page with `?link=` unless given. |

`theme="dark"` shows it dark, and `"auto"` as the system is; light unless
said. Its colours, radii and fonts are custom properties on `.rf-drive`
(`--rf-brand`, `--rf-radius`, `--rf-font`…): change them on the element, or
on a `className` of your own.

## Inside your application's own bar

`chrome={false}` leaves out the drive's bar (title, search, notifications,
settings) and its sections, for an application that puts its own around it.
It drives the drive through `controls`, and shows where it is from `onState`.

```tsx
import { FileDrive, type DriveControls, type DriveState } from '@rebofiles/react';

const drive = useRef<DriveControls>(null);
const [state, setState] = useState<DriveState | null>(null);

<button onClick={() => drive.current?.upload()}>Upload</button>
<button onClick={() => drive.current?.share()}>Share</button>
<FileDrive chrome={false} controls={drive} onState={setState} />
```

`controls` gives `go(section, folder)`, `search(query)`, `upload()`,
`newFolder()`, `requestFiles()` and `share()` (of the folder shown) and
`openSettings()`. `onState` is told the section, the folder and its path,
what is searched, how many are shown, the space used, and what is new.

`root={folderId}` keeps the drive in one folder, as the files of one record of
yours (a client, a property): it starts there, its path starts there, and
nothing above it is gone to.

## Sharing

**Share**, in the details, gives an entry to someone by their id, as viewer,
commenter or editor, or to everyone signed in, and makes links that anyone
may open without signing in, for a day, a week or a month, with a password
or for one download when asked. What others share is in **Shared with me**,
with how many are new beside it. The server decides with `byRoles` of
`@rebofiles/server`, and tells your application of each share (`onShare`).

A link opens in a page of yours, with what it reads and nothing to change:

```tsx
import { SharedLink } from '@rebofiles/react';

<SharedLink base="/api/files" token={new URLSearchParams(location.search).get('link')!} />
```

## With Rebodocs

```tsx
import { previewDocx } from '@rebofiles/react/rebodocs'; // needs @rebodocs/core

<FileDrive previewDocument={previewDocx} onOpenDocument={(file, url) => open(file, url)} />
```

A Word document is previewed as a small page, its title and first
paragraphs, read with Rebodocs' engine; the import is apart from the rest of
the package, so a drive without Rebodocs does not carry it. The playground
opens the document in `DocsEditor` and sends each save back as a new version
with `useActions().upload(file, { file: id })` (`apps/playground/src/Editor.tsx`).

A `<FileDrive>` inside a `<DriveProvider>` of your own uses that one, so the
rest of the page can change the drive and see it change.

## Headless

The component is built from these and nothing else.

```tsx
import { DriveProvider, useEntries, useActions, useUploads } from '@rebofiles/react';

function Folder({ id }: { id: string | null }) {
  const { entries, path, loading } = useEntries({ section: 'files', folder: id });
  const { moveToTrash } = useActions();
  const { upload, uploads } = useUploads();
  // …your own interface
}
```

| Hook | What it gives |
| --- | --- |
| `useEntries(view)` | A folder, the recent files, the starred, what came through requests (`'received'`), Shared with me, the trash or a search, asked again after every change. |
| `useEntry(id)` | One entry as it is now, and where it is; null while it loads. |
| `useActions()` | `createFolder`, `rename`, `move`, `moveToTrash`, `restore`, `deleteForever`, `emptyTrash`, `restoreVersion`, `copy`, `star`, `setColor`, `setFields`, `review`, `share`, `unshare`, `createLink`, `removeLink`, `linkToken`, `upload`, `url`. |
| `useUploads({ check })` | Files sent three at a time, in parts, with what has gone of each, how fast and how long it has left (`uploads`, `summary`); `retry`, `stop`, `stopAll`, `dismiss`, `clear`. With `check: true`, each looked for in the drive first and asked about (`decide`). |
| `useSettings()` | The drive's settings and the person's own, and `save`, `saveMine`. |
| `useComments(id)` | What is said of an entry, each thread with its replies; `add`, `edit`, `resolve`, `remove`. |
| `useActivity(id)` | Who did what to an entry, the newest first. |
| `useTextSearch(query)` | The files with these words written inside, each with a piece of its text (`entry`, `snippet`). |
| `useNotifications()` | What the one asking was told, how many are new (`unseen`), and `saw()`. |
| `useRequests()` | The requests for files one has made, each with its folder, link and token; `remind(folder, link)`. |
| `useExpiring(days)` | The files whose field `expires` comes within so many days, or passed: the soonest first. |
| `useWithField(name, value)` | The entries with a field of this value: the files of one record of yours. |
| `usePeople(query)` | Who matches what is typed, from your directory, to share with. |
| `useDrive()` | The provider itself: `client`, every route as a function; `revision`, which goes up after each change; and `changed()`, to tell every hook to ask again. |

Every hook asks again when someone else changes the drive, a moment after,
from the server's `/events` (`<DriveProvider live={false}>` for none). Those
that take a query give nothing, without asking, for an empty one.

### What has no hook of its own

The space used, names of people by their ids, a link changed, an archive, a
legal hold are the client's: `useDrive()` gives
it, with `revision` to ask again when the drive changes and `changed()` to
tell every hook after a change of yours.

```tsx
function Space() {
  const { client, revision } = useDrive();
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof client.usage>> | null>(null);
  useEffect(() => void client.usage().then(setUsage), [client, revision]);
  return usage && <meter value={usage.used} max={usage.quota ?? usage.used} />;
}
```

Every function of the client is in the reference of the documentation.

## Settings of your own

`useSettings()` gives the drive as the one asking sees it, the drive's and
their own, whether they may configure it, and `save` and `saveMine`.
`useUploads` makes the smaller pictures of an image as the settings say.
`<FileDrive>` has the whole screen of settings behind its button.

## Without a server

`createMemoryClient({ drive, blobs, user })` keeps the drive in the page, with
the same client and the same refusals as the server's, the bytes as Blobs
and their addresses as `blob:` ones. For a demo, a story or a test:

```tsx
<FileDrive client={createMemoryClient({ user: 'You' })} />
```

`apply(change, by)` makes a change as someone else, such as an assistant.
`apps/demo` is built on it.

## Without React

`<FileDrive>` is the drive of [`@rebofiles/drive`](../drive), mounted on an
element: the same screen with no framework, which this package gives React's
provider, words and changes. `createDriveClient({ base })`, from there too, is
the client the hooks use: one function per route, and
`upload(file, { parent, onProgress })`.

## Status

The component and the hooks driven in Chrome by `npm run test:browser`, with
axe; the client is tested in `@rebofiles/drive`. On npm.

## Where it can improve

- **More of the client as hooks:** the space used and the screens of whoever
  looks after the drive are in the client of `useDrive()`, not yet hooks of
  their own.

## License

MIT
