// What the status page says, as it was measured: the numbers come from running
// `npm test`, not from memory. Run it again and update them, with the "What is
// checked" of ROADMAP.md, which says the same in the same order.

/** When the numbers below were taken. */
export const MEASURED = 'October 25, 2026';

export const TESTS: { where: string; count: number; what: string }[] = [
  {
    where: 'packages/core',
    count: 49,
    what: 'Names, the tree, renaming and moving, the trash, versions, search, changes; the top of the drive for each owner, roles down the tree, Shared with me, links.',
  },
  {
    where: 'packages/server',
    count: 50,
    what: 'The routes on the disk and on an S3 kept in memory, uploads in parts and given up, deleting in one request, who may do what, sharing with two people and links read without signing in, SQLite across two processes, Postgres on PGlite, and the signature against AWS’s example.',
  },
  {
    where: 'packages/drive',
    count: 22,
    what: 'The client against the routes and against a bucket: folders, sharing, links, uploads in parts with progress, the headers a bucket signed, an upload given up, versions, refusals, the trash; sizes, dates and kinds of file; the preview of a Word document; the drive kept in the page.',
  },
  {
    where: 'packages/mcp',
    count: 19,
    what: 'The protocol and every tool over HTTP and stdio, two people’s assistants each doing only what its person may; Rebodocs’ tools on the drive’s Word documents, each change a version, a viewer reading and an editor writing, a save made meanwhile not written over, and none of them without Rebodocs; and driven by the official SDK as a client.',
  },
  {
    where: 'npm run test:browser',
    count: 26,
    what: 'The demo of the landing: Claude’s calls to the MCP tools, the rename seen, and left alone when the person renamed first. The playground in Chrome with Playwright: a folder, uploads in parts, the preview, “(2)”, F2, the trash and back, search, moving, emptying the trash, Spanish at the width of a phone; sharing with Bea, and a link opened signed out until it is taken back; the keyboard alone; axe on every state, light and dark; the drive with no framework; a drive from the hooks alone.',
  },
];

/** Checked by hand, each with what was done. */
export const CHECKED: [string, string][] = [
  [
    'Cloudflare R2',
    '`npm run storage:check` from Node: a file in one PUT, one of 16 MiB in parts, each read back byte for byte, a second version, a download shown in the page, an upload given up, the deletion in one request, seen in the bucket. Then the page against the same bucket, with its rule of origins.',
  ],
  [
    'The interface',
    'Driven in Chrome with real clicks and keys: a folder made, files uploaded into it, a text previewed, a second upload with the same name as “(2)”, renaming with F2, the trash with Delete and back, search, moving from the dialog, the grid, and the drive in Spanish at the width of a phone.',
  ],
  ['Postgres', 'Two pools on one Postgres 16, as two servers, making twenty folders of one name at once: twenty names, none given twice. Without the lock, ten.'],
  ['The site', 'axe on the landing, Getting started and this page, at the width of a desktop and of a phone, with motion and with less of it: nothing found.'],
  ['Rebodocs', 'A Word document uploaded, previewed as a page, opened in Rebodocs, changed, saved with ⌘S, and back in the drive as its second version.'],
  ['The demo', 'Acme’s files made in the page, a Word document and a PDF previewed, Claude’s rename and its card, an upload in steps, the trash emptied.'],
  [
    'The builds',
    'Each package built as it goes to npm and installed from its tarball in an empty project: a server on node:http, the client uploading and reading back over the network, <FileDrive> rendered on a server, a strict typecheck.',
  ],
];

export const NOT_CHECKED: [string, string][] = [
  ['Other buckets', 'Cloudflare R2 only. Not AWS, MinIO or Backblaze yet.'],
  ['Other browsers', 'Chrome only; not Safari or Firefox, and not on a real phone.'],
  ['Two processes on SQLite', 'Opened by two handlers one after the other, not at once; for more than one process, Postgres.'],
];

export const LIMITS: { area: string; items: string[] }[] = [
  {
    area: 'Storage',
    items: [
      'An upload that fails or is stopped is given up, and what of it arrived taken away; one left when the page is closed halfway stays in the bucket until a lifecycle rule of the bucket takes it.',
    ],
  },
  {
    area: 'Metadata',
    items: [
      'The whole drive is loaded on each request, and each change copies the map of entries: fine for tens of thousands of entries.',
      'Changes are put in order inside one process only, but on Postgres with a pool, where a lock of the database orders them across processes.',
    ],
  },
  { area: 'Uploads', items: ['Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.', 'No resuming yet after the page is closed.'] },
  {
    area: 'Sharing',
    items: [
      'People are named by the id the application gives them; no groups but everyone signed in.',
      'Links are for viewers only; a commenter has nothing to comment on yet.',
      'An editor who moves something of someone else’s to the top puts it in its owner’s My files.',
    ],
  },
];

export interface Milestone {
  version: string;
  name: string;
  items: { what: string; done?: boolean }[];
}

/** In the order it is built, as ROADMAP.md has it. */
export const ROADMAP: Milestone[] = [
  {
    version: '0.1.0',
    name: 'A drive that works',
    items: [
      { what: 'core: the tree, names that do not repeat in a folder, moving, renaming, the trash, versions, search', done: true },
      { what: 'server: the routes, authorize(), bytes on S3 and on disk, metadata in memory and SQLite, uploads in parts', done: true },
      { what: 'react: <FileDrive> with the list and the grid, folders, search, upload, details, versions, the trash', done: true },
      { what: 'Previews of pictures, PDF and DOCX; “Open in Rebodocs”', done: true },
      { what: 'The demo, the playground, and the drive run against Cloudflare R2', done: true },
      { what: 'The site: the landing, Getting started and this page', done: true },
      { what: 'Published to npm' },
    ],
  },
  {
    version: '0.2.0',
    name: 'Sharing',
    items: [
      { what: 'Owner, editor, commenter and viewer, inherited down the tree; “Shared with me”', done: true },
      { what: 'Links with an expiry, signed by the server', done: true },
      { what: 'Metadata on Postgres', done: true },
    ],
  },
  {
    version: '0.3.0',
    name: 'Your own UI',
    items: [
      { what: '@rebofiles/drive split out of react, without a framework', done: true },
      { what: 'The headless hooks, documented with a whole screen built from them', done: true },
      { what: 'Accessible: every action from the keyboard, screen readers, axe, a dark theme; Playwright', done: true },
    ],
  },
  {
    version: '0.4.0',
    name: 'Assistants',
    items: [
      { what: '@rebofiles/mcp, with authorize() asked for the assistant too', done: true },
      { what: 'Claude in the demo: its calls to the MCP tools, answered in the page', done: true },
      { what: 'Rebodocs’ MCP and ReboFiles’ together: the drive’s Word documents edited, each change a version', done: true },
    ],
  },
  {
    version: '0.5.0',
    name: 'Big files and other storage',
    items: [{ what: 'Uploads that resume after a cut, files of several gigabytes', done: true }, { what: 'Google Cloud Storage and Azure Blob' }],
  },
  { version: '0.6.0', name: 'The desktop', items: [{ what: '@rebofiles/desktop: a folder of the disk kept like a folder of the drive' }, { what: 'The Tauri application, on a Mac first' }] },
  { version: '1.0.0', name: 'Settled', items: [{ what: 'Used in a real application, and fixed where that shows' }, { what: 'The API settled, and kept from then on' }] },
];
