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
| `previewDocument` | Reads a Word document for its preview: `previewDocx` of `@rebofiles/react/rebodocs`. |
| `linkAddress` | Where a link of the drive points: the page of yours with `<SharedLink>`. This page with `?link=` unless given. |

`theme="dark"` shows it dark, and `"auto"` as the system is; light unless
said. Its colours, radii and fonts are custom properties on `.rf-drive`
(`--rf-brand`, `--rf-radius`, `--rf-font`…): change them on the element, or
on a `className` of your own.

## Sharing

**Share**, in the details, gives an entry to someone by their id, as viewer,
commenter or editor, or to everyone signed in, and makes links that anyone
may open for seven days without signing in. What others share is in
**Shared with me**. The server decides with `byRoles` of `@rebofiles/server`.

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
| `useEntries(view)` | A folder, the recent files, the trash or a search, asked again after every change. |
| `useEntry(id)` | One entry as it is now, and where it is. |
| `useActions()` | `createFolder`, `rename`, `move`, `moveToTrash`, `restore`, `deleteForever`, `emptyTrash`, `restoreVersion`, `upload`, `url`. |
| `useUploads()` | Files sent one after another, in parts, with what has gone of each. |

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
axe; the client is tested in `@rebofiles/drive`. Not on npm yet.

## Where it can improve

- **Choosing several entries** at once, to move or trash them together.
- **Uploads that resume** after the page is closed.

## License

MIT
