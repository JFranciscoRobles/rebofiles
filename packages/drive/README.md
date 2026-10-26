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
