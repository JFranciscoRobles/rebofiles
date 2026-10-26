import type { Metadata } from 'next';
import { C, Code, DocsPage, Section, Trouble } from '@/components/docs/DocsPage';
import { PUBLISHED } from '@/lib/home';
import { REPO, STATUS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Getting started',
  description: 'ReboFiles in a Next.js application: a bucket, one route for the server, and <FileDrive> in a page.',
};

const CONTENTS: [string, string][] = [
  ['install', 'Install'],
  ['bucket', 'The bucket'],
  ['route', 'The route'],
  ['authorize', 'Who may do what'],
  ['page', 'The page'],
  ['sharing', 'Sharing'],
  ['rebodocs', 'Word documents'],
  ['trouble', 'When something fails'],
  ['next', 'From here'],
];

const CORS = `[
  {
    "AllowedOrigins": ["https://your-app.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`;

const ENV = `# The S3 API of the account, not the public address of the bucket (r2.dev)
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=acme-files
S3_REGION=auto
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
# Optional: before every key, to share the bucket with something else
S3_PREFIX=files/
# What upload tokens are signed with: long, random, the same in every process
REBOFILES_SECRET=…`;

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

const POSTGRES = `import pg from 'pg';
import { postgresMetadata } from '@rebofiles/server';

metadata: await postgresMetadata(new pg.Pool({ connectionString: process.env.DATABASE_URL })),`;

const NODE = `import { createServer } from 'node:http';
import { createDriveHandler, nodeHandler } from '@rebofiles/server';

const handle = createDriveHandler({ /* as above */ });
createServer(nodeHandler(handle)).listen(3000);`;

const AUTHORIZE = `import { type Action, type User, byRoles } from '@rebofiles/server';
import type { Drive, Entry } from '@rebofiles/core';

export function mayI(user: User, action: Action, entry: Entry | null, drive: Drive): boolean {
  // Your rules first: an administrator may look at everything, never share it.
  if (isAdmin(user) && action !== 'share') return ['list', 'read', 'download'].includes(action);
  return byRoles(user, action, entry, drive);
}`;

const SHARE = `// The page a link goes to: app/shared/page.tsx
'use client';
import { SharedLink } from '@rebofiles/react';
import { useSearchParams } from 'next/navigation';

export default function Shared() {
  const token = useSearchParams().get('link') ?? '';
  return <SharedLink base="/api/files" token={token} />;
}

// And in the drive, where its links point:
<FileDrive base="/api/files" linkAddress={(token) => \`\${origin}/shared?link=\${token}\`} />`;

const PAGE = `'use client';
import { FileDrive } from '@rebofiles/react';

export default function Files() {
  return (
    <div style={{ height: '100vh' }}>
      <FileDrive base="/api/files" title="Acme Files" language="en" />
    </div>
  );
}`;

const HEADERS = `<FileDrive base="/api/files" headers={async () => ({ authorization: \`Bearer \${await token()}\` })} />`;

const DOCX = `import { FileDrive } from '@rebofiles/react';
import { previewDocx } from '@rebofiles/react/rebodocs'; // needs @rebodocs/core

<FileDrive
  base="/api/files"
  previewDocument={previewDocx}
  onOpenDocument={(file, url) => router.push(\`/documents/\${file.id}\`)}
/>`;

const ACTIONS: [string, string][] = [
  ['list', 'What is in a folder; null for the top. Each entry in it is then asked as read.'],
  ['read', 'One entry, a search, Recent, the trash: what a person may see at all.'],
  ['create', 'A folder, with the folder it goes into.'],
  ['upload', 'A file, with the folder it goes into; a new version, with the file. Asked again when it finishes.'],
  ['rename', 'The entry renamed.'],
  ['move', 'The entry, and then the folder it goes to.'],
  ['trash, restore', 'Into the trash, and out of it.'],
  ['delete', 'Gone for good: the bytes leave the bucket.'],
  ['download', 'An address to read the file from, for a few minutes.'],
  ['comment', 'Asked of nothing yet: what a commenter may do beyond a viewer.'],
  ['share', 'Sharing it, taking it back, and its links.'],
];

export default function GettingStarted() {
  return (
    <DocsPage
      eyebrow="Getting started"
      title="A drive in your application"
      contents={CONTENTS}
      intro={
        <p>
          Three pieces: a bucket that keeps the bytes, one route of your server that keeps the entries and asks your application who may do what, and <C>&lt;FileDrive&gt;</C> in a page. This guide
          puts them in a Next.js application on Cloudflare R2; any S3 and any server that speaks Request and Response go the same way.
        </p>
      }
    >
      <Section id="install" title="Install">
        {PUBLISHED ? (
          <Code lang="bash" code="npm install @rebofiles/react @rebofiles/server" />
        ) : (
          <>
            <p>
              The packages are not on npm yet: 0.1.0 is published once <a href={STATUS}>what is left of it</a> is done. Until then, the whole of this guide can be tried from{' '}
              <a href={REPO}>the repository</a>, against a bucket of your own:
            </p>
            <Code
              lang="bash"
              code={`git clone ${REPO}
cd rebofiles && npm install
cp apps/storage/.env.example apps/storage/.env   # fill it in
npm run storage:check                             # the whole way a file goes, from Node
npm run storage                                   # the drive, at http://localhost:5183`}
            />
          </>
        )}
        <p>
          <C>@rebofiles/server</C> needs Node 22.12 or later and has no dependencies but <C>@rebofiles/core</C>: S3 is signed with <C>node:crypto</C>, SQLite is <C>node:sqlite</C>.{' '}
          <C>@rebofiles/react</C> needs React 18 or later.
        </p>
      </Section>

      <Section id="bucket" title="The bucket">
        <p>
          The bytes go from the browser straight to the bucket and back, at addresses the server signs for a few minutes; they never pass through your server. That asks two things of the bucket: a key
          the server signs with, and a rule that lets your pages in.
        </p>
        <p>
          On Cloudflare R2: <strong>R2 → Create bucket</strong>, then <strong>Manage API tokens → Create API token</strong> with “Object Read &amp; Write” for that bucket only. Put what it gives you
          in the environment of your server:
        </p>
        <Code lang="bash" code={ENV} file=".env" />
        <p>
          Then the bucket’s rule of origins, in <strong>Settings → CORS policy</strong>, with the addresses your application is served from. <C>ETag</C> has to be exposed: the page reads it from each
          part of a large upload, and the server needs it to put the parts together.
        </p>
        <Code lang="json" code={CORS} file="CORS policy" />
        <p>
          A lifecycle rule that aborts multipart uploads left unfinished after a day keeps the parts of an upload never finished from staying in the bucket. On AWS, leave <C>S3_ENDPOINT</C> out and
          give the region; MinIO and Backblaze take the same variables.
        </p>
      </Section>

      <Section id="route" title="The route">
        <p>
          <C>createDriveHandler</C> takes a Request and gives a Response, so it is a Next.js route handler as it is. Every route of the drive lives under one path:
        </p>
        <Code code={ROUTE} file="app/api/files/[...path]/route.ts" />
        <p>
          <C>sqliteMetadata</C> keeps the folders, names, owners, versions and the trash in one file, for an application on one server. The key of a file in the bucket is its id, never its path, so
          renaming and moving never touch the bytes.
        </p>
        <p>
          For more than one server, or a host without a disk of its own, keep them on Postgres with the driver you already use. Given a pool, each change holds a lock of the database, so two servers
          never change the drive at once:
        </p>
        <Code code={POSTGRES} />
        <p>
          On <C>node:http</C>, or Express and what is built on it, <C>nodeHandler</C> makes it a listener:
        </p>
        <Code code={NODE} file="server.ts" />
      </Section>

      <Section id="authorize" title="Who may do what">
        <p>
          ReboFiles has no users of its own. <C>identify</C> says who is asking, from your session; returning null answers 401. <C>authorize</C> is asked on every route, with the entry it is about,
          and returning false answers 403. These are the actions:
        </p>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways on a phone, and a keyboard has to reach what is hidden (WCAG 2.1.1) */}
        <section className="overflow-x-auto rounded-[14px] border border-border" aria-label="Actions" tabIndex={0}>
          <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
            <tbody>
              {ACTIONS.map(([action, what]) => (
                <tr key={action} className="border-t border-border first:border-t-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-code text-[13.5px] text-ink">{action}</td>
                  <td className="border-l border-border px-4 py-3 text-ink-soft">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p>
          <C>byRoles</C> answers from the drive itself: the owner of an entry may do everything to it and to what is inside it, and those it is shared with what their role allows: a viewer looks,
          reads and downloads, an editor also makes, uploads, renames, moves and puts in the trash, and only the owner deletes for good and shares. Anyone signed in may look at the top of the drive
          and put things there; it shows each person their own. Ask it from rules of your own:
        </p>
        <Code code={AUTHORIZE} file="lib/auth.ts" />
        <p>The fourth argument is the whole drive, for rules that look at the folders an entry is in.</p>
      </Section>

      <Section id="page" title="The page">
        <Code lang="tsx" code={PAGE} file="app/files/page.tsx" />
        <p>
          It takes the height it is given. That is the search, My files, Recent and the Trash, the list and the grid, previews, versions, uploads by button or by dropping files, and moving by
          dragging. In the list: the arrows, Enter to open, Delete for the trash, F2 to rename. <C>language</C> is <C>&apos;en&apos;</C> or <C>&apos;es&apos;</C>; its colours, radii and fonts are
          custom properties on <C>.rf-drive</C> (<C>--rf-brand</C>, <C>--rf-radius</C>, <C>--rf-font</C>).
        </p>
        <p>When your session is a token rather than a cookie, give the headers for every request to your server; they are never sent to the bucket:</p>
        <Code lang="tsx" code={HEADERS} />
      </Section>

      <Section id="sharing" title="Sharing">
        <p>
          <strong>Share</strong>, in the details of an entry, gives it to someone by the id your <C>identify</C> gives them, as viewer, commenter or editor, or to everyone signed in; what is in a
          folder goes with it. It shows in their <strong>Shared with me</strong>, not in their My files, which is theirs alone. For one drive of a whole team instead, give the server{' '}
          <C>top: &apos;everyone&apos;</C>.
        </p>
        <p>
          A <strong>link</strong> lets anyone who has it look and download, without signing in, for seven days or until it is removed. Its address goes to a page of yours that shows it:
        </p>
        <Code lang="tsx" code={SHARE} />
      </Section>

      <Section id="rebodocs" title="Word documents">
        <p>
          With <C>@rebodocs/core</C> installed, a .docx is previewed as a small page, read by the Rebodocs engine, and gets an “Open in Rebodocs” button. Opening it is yours: the callback gets the
          file and an address to read it from.
        </p>
        <Code lang="tsx" code={DOCX} />
        <p>
          Saving it back as a new version is <C>useActions().upload(file, &#123; file: id &#125;)</C>; the playground of the repository does it with Rebodocs’ editor, in{' '}
          <C>apps/playground/src/Editor.tsx</C>.
        </p>
      </Section>

      <Section id="trouble" title="When something fails">
        <div className="space-y-3">
          <Trouble says="S3_ENDPOINT is the public address of the bucket (r2.dev)">
            The S3 API of R2 is at <C>https://&lt;account-id&gt;.r2.cloudflarestorage.com</C>, on the bucket’s settings page.
          </Trouble>
          <Trouble says="The part could not be sent. If the bytes go to a bucket, check that it lets this origin in.">
            The rule of origins: the address of the page is missing from <C>AllowedOrigins</C>, or <C>content-type</C> from <C>AllowedHeaders</C>.
          </Trouble>
          <Trouble says="The bucket did not let the page read the ETag of a part.">
            Small files go up and large ones do not: <C>ExposeHeaders</C> needs <C>ETag</C>.
          </Trouble>
          <Trouble says="The bucket answered 403 to …">The key: it may not write in that bucket, or the endpoint, region or bucket name are not the ones it was made for.</Trouble>
          <Trouble says="This link does not work any more.">
            It was removed, it expired, what it read went to the trash, or its address was changed on the way: which one, a link does not say to whoever holds it.
          </Trouble>
          <Trouble says="Sign in first. · You may not do that here.">
            401 is <C>identify</C> returning null; 403 is <C>authorize</C> returning false.
          </Trouble>
        </div>
        <p>
          In the repository, <C>npm run storage:check</C> goes the whole way a file goes against the bucket of <C>apps/storage/.env</C> and says what the bucket answered at the step that failed.
        </p>
      </Section>

      <Section id="next" title="From here">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your own interface.</strong> <C>&lt;FileDrive&gt;</C> is built from <C>DriveProvider</C>, <C>useEntries</C>, <C>useEntry</C>, <C>useActions</C> and <C>useUploads</C>, and nothing
            else; <a href={`${REPO}/tree/main/packages/react#readme`}>the README of @rebofiles/react</a> has them.
          </li>
          <li>
            <strong>No server.</strong> <C>createMemoryClient()</C> answers as the server does, from the page, for demos, stories and tests: <C>&lt;FileDrive client=&#123;…&#125; /&gt;</C>.
          </li>
          <li>
            <strong>The model alone.</strong> <a href={`${REPO}/tree/main/packages/core#readme`}>@rebofiles/core</a> is the drive as pure functions, for a store or a job of your own.
          </li>
          <li>
            <strong>What is checked.</strong> <a href={STATUS}>The status page</a> says what was tested, how, and what comes next.
          </li>
        </ul>
      </Section>
    </DocsPage>
  );
}
