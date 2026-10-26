// Start: what ReboFiles is, the first drive running, and the demos of the repository.

import { LiveDemo } from '@/components/home/LiveDemo';
import { PUBLISHED, VERSION } from '@/lib/home';
import { REPO, hrefOf } from '@/lib/site';
import { InstallCommand } from '../frame/InstallCommand';
import { C, Callout, Cards, Code, DemoBox, type DocPage, List, P, Table } from '../ui';

export const index: DocPage = {
  title: 'What is ReboFiles',
  description: 'A file drive for the browser, built into your application, on your own storage: what it does, its packages, and what it is not.',
  source: 'apps/site/components/docs/pages/start.tsx',
  lead: (
    <>
      ReboFiles is a file manager for the browser that lives inside your application: folders, uploads, previews, versions, a trash and sharing, with the bytes in your own bucket and the entries in
      your own database. It is the drive of the Rebo suite, beside <a href="https://www.rebodocs.com">Rebodocs</a>, and comes as packages you take one at a time.
    </>
  ),
  tip: 'tip: the drive below is running — click around',
  sections: [
    {
      id: 'try',
      title: 'The drive, running',
      badge: 'Live',
      color: 'green',
      lead: 'The demo of the landing: the drive kept in this page, with Acme’s files made in it. Nothing leaves the browser.',
      body: (
        <DemoBox>
          {/* Wider than the column beside the menu: it scrolls sideways there, as it does on a phone. */}
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways, and a keyboard has to reach what is hidden (WCAG 2.1.1) */}
          <section className="overflow-x-auto" aria-label="The demo" tabIndex={0}>
            <LiveDemo />
          </section>
        </DemoBox>
      ),
    },
    {
      id: 'what-you-get',
      title: 'What you get',
      badge: 'Features',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>Uploads you can watch.</strong> Straight to the bucket in parts, three at a time, each with how long it has left; whole folders as they were; one cut goes on from where it was.
            </>,
            <>
              <strong>The same file caught.</strong> Its bytes, or its name, found in the drive before it goes: replaced as a new version, both kept, or skipped.
            </>,
            <>
              <strong>Folders and search.</strong> Nested folders, nine colours, the list in any order, search by name and by what is written inside files.
            </>,
            <>
              <strong>Previews and a viewer.</strong> Word documents page by page with Rebodocs, PDFs, pictures in four sizes and blurred while they come, video, audio and text.
            </>,
            <>
              <strong>Versions, the trash and space.</strong> Every save keeps the file before it; the trash empties itself after the days you say; a quota for each person.
            </>,
            <>
              <strong>Sharing.</strong> Viewer, commenter and editor, down the tree; links that expire, with a password or for one download; what is new in Shared with me.
            </>,
            <>
              <strong>Activity.</strong> Who did what to each file and folder, kept by your database.
            </>,
            <>
              <strong>.zip downloads</strong> of what is picked, a folder or a link’s folder, made in the page.
            </>,
            <>
              <strong>AI assistants.</strong> Tools for Claude over MCP, with the user’s own rights; Word documents edited through Rebodocs, each change a version.
            </>,
            <>
              <strong>Keyboard and screen readers</strong>, light and dark, English and Spanish, a screen of settings, and a desktop application.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'the-packages',
      title: 'The packages',
      badge: 'Pick',
      color: 'purple',
      body: (
        <>
          <Table
            label="Packages"
            columns={['Package', 'Take it when']}
            rows={[
              ['@rebofiles/react', 'You have a React or Next.js application and want the drive in a screen of it, whole or from hooks.'],
              ['@rebofiles/drive', 'Your page has no framework, or one that is not React: the same drive, mounted on an element.'],
              ['@rebofiles/server', 'Your backend keeps the entries and signs the addresses: one route, Request in and Response out.'],
              ['@rebofiles/core', 'You change a drive in code, in a job or a store of your own: the model as pure functions.'],
              ['@rebofiles/mcp', 'An AI assistant should find, read and file documents with the rights of its person.'],
            ]}
          />
          <P>
            <a href={hrefOf('packages')}>Packages</a> says what each holds and how they depend on each other.
          </P>
        </>
      ),
    },
    {
      id: 'how-it-is-built',
      title: 'How it is built',
      badge: 'Decided',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              <strong>The bytes never pass through your server.</strong> The browser sends them to the bucket at addresses the server signs for their exact length, and reads them back the same way.
            </>,
            <>
              <strong>The entries live in a store beside them.</strong> A bucket has no folders, owners or trash; the key of a file is its id, never its path, so moving and renaming never touch the
              bytes.
            </>,
            <>
              <strong>Who may do what is your application’s.</strong> <C>identify</C> and <C>authorize</C> are asked on every route; ReboFiles has no users of its own.
            </>,
            <>
              <strong>No runtime dependencies.</strong> S3 is signed with <C>node:crypto</C>, SQLite is <C>node:sqlite</C>, the .zip is written in the page.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'what-it-is-not',
      title: 'What it is not',
      badge: 'Plainly',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              <strong>Not a hosted service.</strong> There is nothing to sign up for: it is code you run, on storage you own.
            </>,
            <>
              <strong>Not finished.</strong> {PUBLISHED ? `It is on npm at ${VERSION}` : 'It is tested and not on npm yet'}, and it does not do everything:{' '}
              <a href={hrefOf('status')}>Status and roadmap</a> lists what is checked and what is missing.
            </>,
          ]}
        />
      ),
    },
  ],
};

const PAGE = `'use client';
import { FileDrive } from '@rebofiles/react';

export default function Files() {
  return (
    <div style={{ height: '100vh' }}>
      <FileDrive base="/api/files" title="Acme Files" language="en" />
    </div>
  );
}`;

const ROUTE = `import { byRoles, createDriveHandler, s3OptionsFrom, s3Storage, sqliteMetadata } from '@rebofiles/server';
import { session } from '@/lib/auth'; // your own

const handle = createDriveHandler({
  storage: s3Storage(s3OptionsFrom(process.env)),
  metadata: await sqliteMetadata('drive.sqlite'),
  identify: async (request) => {
    const user = await session(request);
    return user ? { id: user.id } : null;
  },
  authorize: byRoles,
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };`;

const MEMORY = `import { FileDrive, createMemoryClient } from '@rebofiles/react';

// No server: the drive kept in the page, with the same client and the same refusals.
<FileDrive client={createMemoryClient({ user: 'You' })} />`;

const REPOSITORY = `git clone ${REPO}
cd rebofiles && npm install
npm run dev        # the playground: the drive on this computer, at http://localhost:5180`;

const COMMANDS: [string, string][] = [
  ['npm run dev', 'The playground: the whole drive against a server in the same process, the bytes in a folder, the entries in SQLite. `?as=bea` is someone else.'],
  ['npm run demo', 'The demo of the landing: the drive kept in the page, with Claude’s calls to the MCP tools.'],
  ['npm run storage', 'The drive against a real bucket (R2, S3, MinIO), from `apps/storage/.env`.'],
  ['npm run storage:check', 'The whole way a file goes against that bucket, from Node, and everything deleted after.'],
  ['npm run desktop', 'The desktop application, with Tauri, against the playground.'],
  ['npm run site', 'This site.'],
  ['npm test', 'Every test of the packages, in Node.'],
  ['npm run test:browser', 'The drive in Chrome with Playwright, axe on every state.'],
  ['npm run typecheck', 'TypeScript, strict, on the packages and the applications.'],
  ['npm run lint', 'Biome.'],
];

export const gettingStarted: DocPage = {
  title: 'Getting started',
  description: 'A drive in a Next.js application: the page, the route, and where to go from there; the drive with no server at all; and the commands of the repository.',
  source: 'apps/site/components/docs/pages/start.tsx',
  lead: (
    <>
      Three pieces: <C>&lt;FileDrive&gt;</C> in a page, one route of your server that keeps the entries and asks your application who may do what, and a bucket that keeps the bytes. This page puts the
      first two in a Next.js application; <a href={hrefOf('storage')}>Storage</a> is the third.
    </>
  ),
  sections: [
    {
      id: 'install',
      title: 'Install',
      badge: 'npm',
      color: 'blue',
      lead: '@rebofiles/react for the page, @rebofiles/server for the route. React 18 or later, Node 22.12 or later.',
      body: PUBLISHED ? (
        <div className="mt-5">
          <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
        </div>
      ) : (
        <>
          <Callout title="Not on npm yet.">0.1.0 is published once what is left of it is done. Until then, everything here runs from the repository: see the last section.</Callout>
          <div className="mt-5">
            <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
          </div>
        </>
      ),
    },
    {
      id: 'the-page',
      title: 'The page',
      badge: 'React',
      color: 'purple',
      lead: 'The whole drive, in the height it is given.',
      body: (
        <>
          <Code lang="tsx" code={PAGE} file="app/files/page.tsx" />
          <P>
            That is the search, My files, Shared with me, Recent and the trash, the list and the grid, previews and the viewer, versions, activity, uploads by button or by dropping files and folders,
            and a screen of settings. <a href={hrefOf('react')}>React component</a> has every prop.
          </P>
        </>
      ),
    },
    {
      id: 'the-route',
      title: 'The route',
      badge: 'Server',
      color: 'pink',
      lead: 'createDriveHandler takes a Request and gives a Response, so it is a Next.js route handler as it is.',
      body: (
        <>
          <Code code={ROUTE} file="app/api/files/[...path]/route.ts" />
          <P>
            <C>identify</C> says who is asking, from your session; <C>byRoles</C> answers who may do what from the drive itself. <a href={hrefOf('server')}>The route</a> and{' '}
            <a href={hrefOf('authorize')}>Who may do what</a> go through both.
          </P>
        </>
      ),
    },
    {
      id: 'no-server',
      title: 'Without a server',
      badge: 'In the page',
      color: 'green',
      lead: 'For a demo, a story or a test: the drive kept in the page, the bytes as Blobs.',
      body: <Code lang="tsx" code={MEMORY} />,
    },
    {
      id: 'where-to-go-next',
      title: 'Where to go next',
      badge: 'Next',
      color: 'yellow',
      body: (
        <Cards
          items={[
            { title: 'Storage: S3 and disk', href: hrefOf('storage'), text: 'The bucket, its keys and its rule of origins.' },
            { title: 'Headless: your own UI', href: hrefOf('hooks'), text: 'The hooks the drive is built from, and a whole drive made of them.' },
            { title: 'Sharing and links', href: hrefOf('sharing'), text: 'Roles down the tree, links with a password, telling people.' },
            { title: 'AI assistants (MCP)', href: hrefOf('assistants'), text: 'Claude finding, reading and filing documents, with the user’s rights.' },
          ]}
        />
      ),
    },
    {
      id: 'run-the-repository',
      title: 'Run the repository',
      badge: 'Repository',
      color: 'orange',
      lead: 'Every package and every application, from source.',
      body: (
        <>
          <Code lang="bash" code={REPOSITORY} />
          <Table label="Commands" columns={['Command', 'What it does']} rows={COMMANDS.map(([command, does]) => [command, does])} />
        </>
      ),
    },
  ],
};

export const demos: DocPage = {
  title: 'Demos to run',
  description: 'The applications of the repository, what each shows and what it needs: the playground, the demo, a real bucket, the desktop, and the site.',
  source: 'apps/site/components/docs/pages/start.tsx',
  lead: (
    <>
      Each is a folder of <C>apps/</C>, started from the root of the repository. None needs an account but the one of a real bucket.
    </>
  ),
  sections: [
    {
      id: 'the-playground',
      title: 'The playground',
      badge: 'npm run dev',
      color: 'green',
      lead: 'The drive on this computer: the bytes in storage/files, the entries in SQLite, the server in the same process as the page.',
      body: (
        <List
          items={[
            <>
              <C>http://localhost:5180</C> is the drive in React; <C>/vanilla.html</C> without a framework; <C>/headless.html</C> built from the hooks alone.
            </>,
            <>
              <C>?as=bea</C> is someone else, to share with; <C>?lang=es</C> and <C>?theme=dark</C> as they say.
            </>,
            <>
              The tools for an assistant at <C>/api/mcp</C>: <C>claude mcp add --transport http rebofiles http://localhost:5180/api/mcp</C>.
            </>,
            <>A Word document opens in Rebodocs’ editor, and ⌘S saves it back as its next version.</>,
          ]}
        />
      ),
    },
    {
      id: 'the-demo',
      title: 'The demo',
      badge: 'npm run demo',
      color: 'blue',
      lead: 'The drive of the landing, kept in the page: Acme’s files made in it, and Claude renaming one through the MCP tools, answered in the page.',
      body: (
        <P>
          It is built on <C>createMemoryClient</C>, so it needs no server, and the browser tests go through it.
        </P>
      ),
    },
    {
      id: 'a-real-bucket',
      title: 'A real bucket',
      badge: 'npm run storage',
      color: 'yellow',
      lead: 'The drive against Cloudflare R2, AWS S3, MinIO or Backblaze, the entries in SQLite on this computer.',
      body: (
        <P>
          Copy <C>apps/storage/.env.example</C> to <C>.env</C>, fill it in, give the bucket the rule of origins in <C>apps/storage/cors.json</C>, then <C>npm run storage:check</C> goes the whole way a
          file goes from Node before the page tries it. <a href={hrefOf('storage')}>Storage</a> says how.
        </P>
      ),
    },
    {
      id: 'the-desktop',
      title: 'The desktop',
      badge: 'npm run desktop',
      color: 'purple',
      lead: 'The drive in a window of its own, with Tauri, against the playground or any server.',
      body: (
        <P>
          Rust and Xcode’s command-line tools on a Mac. <C>npm run build:desktop</C> makes ReboFiles.app. <a href={hrefOf('desktop')}>Desktop and other origins</a> says what the server needs.
        </P>
      ),
    },
    {
      id: 'the-site',
      title: 'This site',
      badge: 'npm run site',
      color: 'pink',
      body: (
        <P>
          The landing, with the demo in it, and these pages: Next.js and Tailwind, built as plain files. <a href="/demo/">/demo/</a> has the drive twice, in a tab each: <C>&lt;FileDrive&gt;</C> as it
          comes, and an interface of a creative suite’s look built on the headless hooks alone.
        </P>
      ),
    },
  ],
};
