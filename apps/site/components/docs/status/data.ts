// What the status page says, as it was measured: the numbers come from running
// `npm test`, not from memory. Run it again and update them, with the "What is
// checked" of ROADMAP.md, which says the same in the same order.

/** When the numbers below were taken. */
export const MEASURED = 'October 26, 2026';

export const TESTS: { where: string; count: number; what: string }[] = [
  {
    where: 'packages/core',
    count: 63,
    what: 'Names, the tree, renaming and moving, the trash and the trash that empties itself, versions, search, changes; the top of the drive for each owner, roles down the tree, Shared with me and what is new in it, links with a password or a number of uses; settings, space, archives, activity, text found in a file, folder colours and placeholders.',
  },
  {
    where: 'packages/server',
    count: 89,
    what: 'The routes on the disk and on an S3 kept in memory, uploads in parts, resumed and given up, quotas, who may do what, sharing and links read without signing in, with a password or for one download, news of what is shared, the same file found again, settings, pictures in sizes, addresses good for an hour, the drive held in memory, activity and text on memory, SQLite and Postgres on PGlite, pages of another origin, and the signature against AWS’s example. Uploads refused before and after they arrive: by beforeUpload, by the type their bytes are, by a ClamAV that knows EICAR, and while it is down; uploads left halfway swept from a bucket and the disk. The events: each told only what they may see, from this process and from another on the same SQLite, and the client coming back after a cut.',
  },
  {
    where: 'packages/drive',
    count: 40,
    what: 'The client against the routes and against a bucket: uploads in parts with progress, resumed after a cut, the headers a bucket signed, versions, refusals; the queue of uploads, three at a time, its speed and time left, the same file or name asked about; folders of the computer read as they were; the .zip written and read back; the text of a file; the drive kept in the page; what the server refused, said in each language.',
  },
  {
    where: 'packages/react',
    count: 9,
    what: 'The hooks in components, against the drive kept in the page: a folder, a search, Recent and the trash asked again after a change through useActions; a view loading as itself, not as the last; useEntry after a rename; settings and the language following them; uploads and their end; what someone else changed shown without asking; and <FileDrive> beside the hooks.',
  },
  {
    where: 'packages/sync',
    count: 8,
    what: 'A folder of the disk and a drive behind its routes kept the same: what is made, changed, moved, renamed and taken away on each side, both changed as a conflict kept twice, a folder and a file of one name, the files of the systems left out, a disk found empty refused; and a sync that goes on, run by the drive’s events and by a file of the disk.',
  },
  {
    where: 'examples',
    count: 5,
    what: 'Next.js, Express, Hono and Fastify, each served on a port and asked over HTTP: a folder, a file of two parts uploaded and read back, and the events of a change; and who asks from a JWT, a forged one refused.',
  },
  {
    where: 'packages/mcp',
    count: 19,
    what: 'The protocol and every tool over HTTP and stdio, two people’s assistants each doing only what its person may; activity, a search by what is written, folder colours; Rebodocs’ tools on the drive’s Word documents, each change a version; and driven by the official SDK as a client.',
  },
  {
    where: 'apps/desktop',
    count: 5,
    what: 'Which server the window is of, kept between starts and tried before it is taken; and in Rust (cargo test), a name taken in Downloads made free, a path of the folder synced that would leave it refused, and what is listed, moved and taken away there.',
  },
  {
    where: 'npm run test:browser',
    count: 50,
    what: 'The playground in Chrome with Playwright: uploads in parts, several at once, stopped and resumed, folders dropped, the same file and the same name asked about; the preview and the viewer; .zip downloads; search by name and by what is written; sharing with Bea, links signed out, one with a password, what is new in Shared with me; the list in an order of one’s choosing, its menu, undo; settings and quotas; activity; folder colours and pictures shown blurred; the keyboard alone; axe on every state, light and dark; the drive with no framework and from the hooks alone; the demo’s Claude through the MCP tools; a folder made and renamed in one window seen in another without loading again; a folder of four hundred, of which only what is in sight is in the page, gone through with the keyboard and the grid.',
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
    'Pictures',
    'Against R2: a picture uploaded in four sizes and its placeholder, the grid reading the small ones from addresses good for an hour; a Word document’s first page made a picture at upload; a .zip of six files.',
  ],
  [
    'The desktop',
    'ReboFiles.app built on a Mac with Tauri and started; its page against the playground from another origin, an upload in parts through it. Its sync of a folder built and its commands tested in Rust; not driven in the window yet.',
  ],
  [
    'The documentation',
    'axe on each page of the documentation added on October 26, 2026, in English, Spanish and Mandarin, at the width of a desktop and of a phone: nothing found, nothing wider than the screen.',
  ],
  [
    'The builds',
    'Each package built as it goes to npm and installed from its tarball in an empty project: a server on node:http, the client uploading and reading back over the network, <FileDrive> rendered on a server, a strict typecheck.',
  ],
];

export const NOT_CHECKED: [string, string][] = [
  ['Other buckets', 'Cloudflare R2 only. Not AWS, MinIO or Backblaze yet.'],
  ['Other browsers', 'Chrome only; not Safari or Firefox, and not on a real phone. The desktop window, Safari’s engine, started but not driven by tests.'],
  ['Two processes on SQLite', 'Opened by two handlers one after the other for changes; the events of one seen by the other. For more than one process that writes, Postgres.'],
  ['Windows and Linux', 'The Desktop workflow builds and tests the application on both; it has not run yet, and nobody has used it there.'],
  ['The workflows', 'CI, Desktop and Release are written; none has run on GitHub yet.'],
];

export const LIMITS: { area: string; items: string[] }[] = [
  {
    area: 'Storage',
    items: ['An upload left halfway stays in the bucket as parts for a day, to be gone on with; after that the server sweeps it, as requests come.'],
  },
  {
    area: 'Metadata',
    items: [
      'The drive is held in memory and read again when the store says it changed: fine for a team and well beyond, not for millions of entries.',
      'Changes are put in order inside one process only, but on Postgres with a pool, where a lock of the database orders them across processes.',
      'The changes of another process are seen by the events within two seconds, from the revision of the store.',
    ],
  },
  {
    area: 'Sync',
    items: [
      'A folder renamed on the disk is sent again as a new one; its old one goes to the trash.',
      'A file goes whole each time, not the part of it that changed.',
      'In the desktop application, the disk is looked at every half a minute and when the window comes to the front, not as each file changes.',
    ],
  },
  {
    area: 'Uploads',
    items: [
      'Files of up to 5 GiB unless `maxSize` says otherwise; an upload is good for a day.',
      'The same file is told by a SHA-256 made in the page, up to 64 MiB; a larger one only by its name.',
      'PDFs get no picture of their first page, and their text is not read for a search.',
    ],
  },
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
  {
    version: '0.6.0',
    name: 'The desktop',
    items: [
      { what: '@rebofiles/sync: a folder of the disk kept like a folder of the drive, in the window and as a command', done: true },
      { what: 'The Tauri application, on a Mac first: the drive in a window, against a server', done: true },
    ],
  },
  { version: '1.0.0', name: 'Settled', items: [{ what: 'Used in a real application, and fixed where that shows' }, { what: 'The API settled, and kept from then on' }] },
];
