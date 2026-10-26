<h1 align="center">@rebofiles/drive</h1>

<p align="center">
  A file drive for the browser without a framework: the whole interface mounted on an element, and the client of @rebofiles/server it is built on. No dependencies but core.
</p>

---

What `@rebofiles/react`'s `<FileDrive>` mounts, for a page with no framework,
or with one that is not React: Vue, Svelte, Angular or none.

## Install

```bash
npm install @rebofiles/drive
```

## Usage

```ts
import { mountDrive } from '@rebofiles/drive';
import { previewDocx } from '@rebofiles/drive/rebodocs'; // needs @rebodocs/core

const drive = mountDrive(document.getElementById('files')!, {
  base: '/api/files',
  title: 'Acme Files',
  language: 'es',
  theme: 'auto',
  previewDocument: previewDocx,
  onOpenDocument: (file, url) => openInRebodocs(file, url),
});

drive.refresh();  // after a change made elsewhere
drive.destroy();
```

The element takes the drive's height: give it one. Everything `<FileDrive>`
takes, `mountDrive` takes: `client`, `headers`, `texts`, `logo` (a Node),
`defaultView`, `onOpen`, `linkAddress`, `className`; and `onChange`, called
after each change made from it, for what else in the page shows the drive.

`mountSharedLink(element, { token })` is what someone sent a link sees.

## Picking several, and the viewer

⌘ or Ctrl with a click adds one to what is picked, Shift picks a range, and a
box to tick shows on each under the mouse; with the keyboard, Shift and the
arrows, ⌘/Ctrl+A, and Space. A bar over the list then does to all of them
what can be done: download, move, the trash, restore, delete for good.

A file opened, by a double click or Enter, is shown over the drive: pictures,
PDF, video, audio, Markdown, CSV, JSON, code and text, and Word documents in
their pages with `viewDocument: viewDocx` (from `@rebofiles/drive/rebodocs`,
with `@rebodocs/editor` installed); ← and → go to the next. `onOpen` opens
files your own way instead.

## Download as .zip

Several picked, or a folder, are downloaded as one .zip made in the page:
`downloadZip(client, ids, { name, onProgress, signal })`. The server says
what goes in it (`client.pack(ids)`), and each file's bytes go from where
they are into the archive as they are read (`writeZip(items, sink)`), text
deflated, ZIP64 when it is large. Past 500 MB, where the browser lets a page
write a file, it is written to one the person chooses.

## Settings

A button at the top of the drive opens its settings, a screen of their own
over it, as Rebodocs' menu is over a document: the language and the theme
each person chooses for themselves, and, for whoever may configure the drive,
its language and theme, the colour of its brand, and the pictures. Each
change is saved as it is made. When an image is uploaded, `renditionsOf`
makes copies of it in the drive's four sizes (160, 480, 1024 and 2048 pixels
unless changed) in the page, as JPEG or as the original's type, and the client
sends them after it; the grid and the preview show those. A person's own come
first, then the `language` and `theme` the application gives, then the
drive's. `settings: false` leaves all of it out.

## What is in it

| Area | What it is |
| --- | --- |
| **The screen** | `mountDrive`, `mountSharedLink`: the search, My files, Shared with me, Recent and the Trash, the list and the grid, details, previews and versions, sharing and links, uploads by button or by dropping, moving by dragging or from a dialog. |
| **The client** | `createDriveClient`, one function per route of @rebofiles/server; `createLinkClient` for a link; `createMemoryClient`, the drive kept in the page, for demos and tests. |
| **Words** | `TEXTS` in English and Spanish, `translator`, `formatSize`, `formatDate`. |
| **Files** | `kindOf`, `badgeOf`; `previewDocx` of `./rebodocs`. |
| **The look** | `CSS`, scoped to `.rf-drive`, its colours, radii and fonts as custom properties, light and dark. |

The screen renders itself again after each change, and changes only what
differs in the page (`src/dom.ts`), so the focus, a selection in a field and
what is scrolled stay where they were.

## Status

The client tested against the routes in `test/client.test.ts`, on the disk
and on an S3 kept in memory; the drive kept in the page in `test/memory.test.ts`.
The screen driven in Chrome by `npm run test:browser`: through `<FileDrive>`
by every test there, and on a page with no framework at all
(`apps/playground/vanilla.html`), with axe. Not on npm yet.

## Where it can improve

- **Choosing several entries** at once, to move or trash them together.
- **A long folder** is rendered whole; thousands of entries would want only
  what is seen drawn.
- **Uploads that resume** after the page is closed.

## License

MIT. Anyone may use it for anything.
