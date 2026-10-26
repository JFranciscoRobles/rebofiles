// What the status page says, as it was measured: the numbers come from running
// `npm test`, not from memory. Run it again and update them, with the "What is
// checked" of ROADMAP.md, which says the same in the same order.

/** When the numbers below were taken. */
export const MEASURED = 'October 25, 2026';

export const TESTS: { where: string; count: number; what: string }[] = [
  { where: 'packages/core', count: 31, what: 'Names, the tree, renaming and moving, the trash, versions, search, changes.' },
  {
    where: 'packages/server',
    count: 23,
    what: 'The routes on the disk and on an S3 kept in memory, uploads in parts and given up, deleting in one request, who may do what, SQLite across two processes, and the signature against AWS’s example.',
  },
  {
    where: 'packages/react',
    count: 16,
    what: 'The client against the routes and against a bucket: folders, uploads in parts with progress, the headers a bucket signed, an upload given up, versions, refusals, the trash; sizes, dates and kinds of file; the preview of a Word document; the drive kept in the page.',
  },
  {
    where: 'npm run test:browser',
    count: 7,
    what: 'The playground in Chrome with Playwright: a folder, uploads in parts, the preview, “(2)”, F2, the trash and back, search, moving, emptying the trash, Spanish at the width of a phone.',
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
  ['Two processes on one database', 'SQLite was opened by two handlers one after the other, not at once.'],
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
    items: ['The whole drive is loaded on each request, and each change copies the map of entries: fine for tens of thousands of entries.', 'Changes are put in order inside one process only.'],
  },
  { area: 'Uploads', items: ['Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.', 'No resuming yet after the page is closed.'] },
  { area: 'Sharing', items: ['Owners only, and what `authorize()` decides. Roles come in 0.2.'] },
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
    items: [{ what: 'Owner, editor, commenter and viewer, inherited down the tree; “Shared with me”' }, { what: 'Links with an expiry, signed by the server' }, { what: 'Metadata on Postgres' }],
  },
  {
    version: '0.3.0',
    name: 'Your own UI',
    items: [
      { what: '@rebofiles/drive split out of react, without a framework' },
      { what: 'The headless hooks, documented with a whole screen built from them' },
      { what: 'Accessible: every action from the keyboard, screen readers, axe, a dark theme; Playwright' },
    ],
  },
  {
    version: '0.4.0',
    name: 'Assistants',
    items: [{ what: '@rebofiles/mcp, with authorize() asked for the assistant too' }, { what: 'Claude in the demo' }, { what: 'Rebodocs’ MCP and ReboFiles’ together' }],
  },
  { version: '0.5.0', name: 'Big files and other storage', items: [{ what: 'Uploads that resume after a cut, files of several gigabytes' }, { what: 'Google Cloud Storage and Azure Blob' }] },
  { version: '0.6.0', name: 'The desktop', items: [{ what: '@rebofiles/desktop: a folder of the disk kept like a folder of the drive' }, { what: 'The Tauri application, on a Mac first' }] },
  { version: '1.0.0', name: 'Settled', items: [{ what: 'Used in a real application, and fixed where that shows' }, { what: 'The API settled, and kept from then on' }] },
];
