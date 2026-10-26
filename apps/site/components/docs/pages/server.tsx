// The server: the route, who may do what, where the bytes and the entries are,
// sharing, activity, and pages of other origins.

import { hrefOf } from '@/lib/site';
import { SERVER_OPTIONS } from '../reference';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, Trouble, withCode } from '../ui';

export const optionId = (name: string) => `option-${name}`;

const ROUTE = `import { byRoles, createDriveHandler, s3OptionsFrom, s3Storage, sqliteMetadata } from '@rebofiles/server';
import { session } from '@/lib/auth'; // your own

const handle = createDriveHandler({
  storage: s3Storage(s3OptionsFrom(process.env)),
  metadata: await sqliteMetadata('drive.sqlite'),
  identify: async (request) => {
    const user = await session(request);
    return user ? { id: user.id, admin: user.isAdmin } : null;
  },
  authorize: byRoles,
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };`;

const NODE = `import { createServer } from 'node:http';
import { createDriveHandler, diskStorage, everyone, memoryMetadata, nodeHandler } from '@rebofiles/server';

const handle = createDriveHandler({
  storage: diskStorage({ folder: './storage', secret: process.env.REBOFILES_SECRET! }),
  metadata: memoryMetadata(),
  ...everyone(), // only on your own machine: no sign-in, everyone may do everything
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

createServer(nodeHandler(handle)).listen(3000);`;

export const server: DocPage = {
  title: 'The route',
  description: 'createDriveHandler: one route for the whole drive, in Next.js, Bun, Deno, a Worker or node:http, and every option it takes.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: (
    <>
      <C>createDriveHandler</C> takes a Request and gives a Response. Every route of the drive lives under one path, and none carries the bytes but on a disk: the browser is given addresses to send
      them to and read them from.
    </>
  ),
  sections: [
    { id: 'in-nextjs', title: 'In Next.js', badge: 'Next.js', color: 'blue', body: <Code code={ROUTE} file="app/api/files/[...path]/route.ts" /> },
    {
      id: 'on-node-http',
      title: 'On node:http',
      badge: 'Node',
      color: 'green',
      lead: 'nodeHandler makes it a listener, for node:http, Express and what is built on it.',
      body: <Code code={NODE} file="server.ts" />,
    },
    {
      id: 'options',
      title: 'Every option',
      badge: 'Options',
      color: 'yellow',
      body: (
        <RefTable
          label="Options of createDriveHandler"
          name="Option"
          rows={SERVER_OPTIONS.map((option) => ({ id: optionId(option.name), name: option.name, type: option.type, does: withCode(option.does) }))}
        />
      ),
    },
    {
      id: 'held-in-memory',
      title: 'Held in memory',
      badge: 'Speed',
      color: 'purple',
      body: (
        <P>
          The drive is read once and held, and read again only when the store says it changed, by this process or another: a listing of 20,000 entries went from 36 ms to under 1. Fine for a team and
          well beyond; not for millions of entries.
        </P>
      ),
    },
    {
      id: 'every-route',
      title: 'Every route',
      badge: 'API',
      color: 'pink',
      body: (
        <P>
          <a href={hrefOf('routes')}>HTTP routes</a> lists them, as the code keeps them.
        </P>
      ),
    },
  ],
};

const AUTHORIZE = `import { type Action, type User, byRoles } from '@rebofiles/server';
import type { Drive, Entry } from '@rebofiles/core';

export function mayI(user: User, action: Action, entry: Entry | null, drive: Drive): boolean {
  // Your rules first: an auditor may look at everything, never change it.
  if (isAuditor(user)) return ['list', 'read', 'download'].includes(action);
  return byRoles(user, action, entry, drive);
}`;

const ACTIONS: [string, string][] = [
  ['list', 'What is in a folder; null for the top. Each entry in it is then asked as read.'],
  ['read', 'One entry, a search, Recent, the trash, its activity: what a person may see at all.'],
  ['create', 'A folder, with the folder it goes into.'],
  ['upload', 'A file, with the folder it goes into; a new version, its smaller pictures, its text, with the file. Asked again when it finishes.'],
  ['rename', 'The entry renamed, or a folder given a colour.'],
  ['move', 'The entry, and then the folder it goes to.'],
  ['trash, restore', 'Into the trash, and out of it.'],
  ['delete', 'Gone for good: the bytes leave the bucket.'],
  ['download', 'An address to read the file from, for a few minutes.'],
  ['comment', 'Asked of nothing yet: what a commenter may do beyond a viewer.'],
  ['share', 'Sharing it, taking it back, and its links.'],
  ['configure', 'The settings of the whole drive. With byRoles, a user identify gives as { id, admin: true }.'],
];

export const authorize: DocPage = {
  title: 'Who may do what',
  description: 'identify and authorize, the actions asked, byRoles and rules of your own around it.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: (
    <>
      ReboFiles has no users of its own. <C>identify</C> says who is asking, from your session; <C>authorize</C> is asked on every route, with the entry it is about.
    </>
  ),
  sections: [
    {
      id: 'identify',
      title: 'identify',
      badge: 'Who',
      color: 'blue',
      body: (
        <P>
          Given the Request, it returns <C>&#123; id &#125;</C> for someone signed in, or null, answered 401. The id is how the drive names them: owners, shares, activity. <C>admin: true</C> may
          configure the drive with <C>byRoles</C>.
        </P>
      ),
    },
    {
      id: 'the-actions',
      title: 'The actions',
      badge: 'What',
      color: 'yellow',
      body: <Table label="Actions" columns={['Action', 'Asked for']} rows={ACTIONS.map(([action, what]) => [action, what])} />,
    },
    {
      id: 'byroles',
      title: 'byRoles',
      badge: 'Roles',
      color: 'green',
      body: (
        <P>
          From the drive itself: the owner may do everything to an entry and to what is inside it; those it is shared with what their role allows. A viewer looks, reads and downloads; an editor also
          makes, uploads, renames, moves and puts in the trash; only the owner deletes for good and shares. Anyone signed in may look at the top and put things there; it shows each their own.
        </P>
      ),
    },
    {
      id: 'rules-of-your-own',
      title: 'Rules of your own',
      badge: 'Yours',
      color: 'purple',
      lead: 'Ask byRoles from yours. The fourth argument is the whole drive, for rules that look at the folders an entry is in.',
      body: <Code code={AUTHORIZE} file="lib/auth.ts" />,
    },
    {
      id: 'when-it-says-no',
      title: 'When it says no',
      badge: 'Errors',
      color: 'pink',
      body: (
        <Trouble says="Sign in first. · You may not do that here.">
          401 is <C>identify</C> returning null; 403 is <C>authorize</C> returning false.
        </Trouble>
      ),
    },
  ],
};

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
# What tokens are signed with: long, random, the same in every process
REBOFILES_SECRET=…`;

export const storage: DocPage = {
  title: 'Storage: S3 and disk',
  description: 'The bytes in any bucket that speaks S3, with no SDK, or in a folder of the disk: the keys, the rule of origins, and what goes wrong.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: (
    <>
      The bytes go from the browser straight to the bucket and back, at addresses the server signs for a few minutes. That asks two things of the bucket: a key to sign with, and a rule that lets your
      pages in.
    </>
  ),
  sections: [
    {
      id: 'the-key',
      title: 'The key',
      badge: 'S3',
      color: 'blue',
      lead: 'On Cloudflare R2: R2 → Create bucket, then Manage API tokens → Create API token with “Object Read & Write” for that bucket only.',
      body: (
        <>
          <Code lang="bash" code={ENV} file=".env" />
          <P>
            <C>s3Storage(s3OptionsFrom(process.env))</C> reads them. On AWS, leave <C>S3_ENDPOINT</C> out and give the region; MinIO and Backblaze take the same variables.
          </P>
        </>
      ),
    },
    {
      id: 'the-rule-of-origins',
      title: 'The rule of origins',
      badge: 'CORS',
      color: 'yellow',
      lead: 'In Settings → CORS policy, with the addresses your application is served from. ETag has to be exposed.',
      body: (
        <>
          <Code lang="json" code={CORS} file="CORS policy" />
          <P>A lifecycle rule that aborts multipart uploads left unfinished after a day keeps the parts of an upload never finished from staying in the bucket.</P>
        </>
      ),
    },
    {
      id: 'on-the-disk',
      title: 'On the disk',
      badge: 'Disk',
      color: 'green',
      body: (
        <P>
          <C>diskStorage(&#123; folder, secret &#125;)</C> keeps the bytes in a folder, and the server carries them itself, at addresses of its own: for one machine, a demo, or a test.
        </P>
      ),
    },
    {
      id: 'when-something-fails',
      title: 'When something fails',
      badge: 'Errors',
      color: 'pink',
      body: (
        <>
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
          <Trouble says="There is no room for it: … are used, and it is ….">
            The person’s quota (<C>413 over-quota</C>): more room in the settings of the drive, or less in their files and their trash.
          </Trouble>
          <P>
            In the repository, <C>npm run storage:check</C> goes the whole way a file goes against the bucket of <C>apps/storage/.env</C> and says what the bucket answered at the step that failed.
          </P>
        </>
      ),
    },
  ],
};

const POSTGRES = `import pg from 'pg';
import { postgresMetadata } from '@rebofiles/server';

metadata: await postgresMetadata(new pg.Pool({ connectionString: process.env.DATABASE_URL })),`;

export const metadata: DocPage = {
  title: 'Metadata: SQLite and Postgres',
  description: 'Where the entries are: in memory, in SQLite with node:sqlite, or in Postgres with your driver; what each keeps, and several processes.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: <>A bucket has no folders, owners, permissions or trash. Those go in a metadata store beside it, which writes only what changed, one change at a time.</>,
  sections: [
    {
      id: 'the-stores',
      title: 'The stores',
      badge: 'Pick',
      color: 'blue',
      body: (
        <Table
          label="Stores"
          columns={['Store', 'For']}
          rows={[
            ['memoryMetadata()', 'Tests and demos: gone when the process ends.'],
            ['sqliteMetadata(path)', 'An application on one server: one file, with Node’s own node:sqlite.'],
            ['postgresMetadata(pool)', 'More than one server, or a host without a disk: your driver, a lock of the database for each change.'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: 'On Postgres',
      badge: 'Postgres',
      color: 'green',
      body: (
        <>
          <Code code={POSTGRES} />
          <P>
            It takes anything with <C>query(text, values)</C> that answers <C>&#123; rows &#125;</C>: <C>pg</C>, Neon’s Pool, PGlite. Given a pool, each change holds a lock of the database while it
            reads and writes, so two servers never change the drive at once; without one, two folders made at the same moment could both be “(2)”. <C>&#123; table: 'acme_files' &#125;</C> for a table
            of another name.
          </P>
        </>
      ),
    },
    {
      id: 'what-is-kept',
      title: 'What is kept',
      badge: 'Tables',
      color: 'yellow',
      body: (
        <List
          items={[
            'The entries, one row each, as JSON.',
            'The settings of the drive and of each person, and the passwords of links as scrypt makes them.',
            'The activity, a row a line, found by the entry and the folders it is about.',
            'The text of each file: SQLite’s full-text search, or a tsvector in Postgres.',
            'A revision that goes up with every change, so each process knows when to read the drive again.',
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: 'A store of your own',
      badge: 'Yours',
      color: 'purple',
      body: (
        <P>
          <C>MetadataStore</C> is <C>load()</C> and <C>save(changes)</C>; <C>revision</C>, <C>lock</C>, settings, <C>record</C>/<C>activity</C> and <C>keepText</C>/<C>findText</C> are optional, and
          without them the server keeps those in the process. <a href={hrefOf('schema')}>Database schema</a> has every table.
        </P>
      ),
    },
  ],
};

const SHARE = `// The page a link goes to: app/shared/page.tsx
'use client';
import { SharedLink } from '@rebofiles/react';
import { useSearchParams } from 'next/navigation';

export default function Shared() {
  return <SharedLink base="/api/files" token={useSearchParams().get('link') ?? ''} />;
}

// And in the drive, where its links point:
<FileDrive base="/api/files" linkAddress={(token) => \`\${origin}/shared?link=\${token}\`} />`;

export const sharing: DocPage = {
  title: 'Sharing and links',
  description: 'Roles down the tree, Shared with me and what is new in it, one drive for a team, and links that expire, with a password or for one download.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: <>Share, in the details of an entry, gives it to someone by the id your identify gives them, or to everyone signed in; what is in a folder goes with it.</>,
  sections: [
    {
      id: 'roles',
      title: 'Roles',
      badge: 'People',
      color: 'blue',
      body: (
        <P>
          Viewer, commenter or editor, on an entry and what is inside it. It shows in their <strong>Shared with me</strong>, not in their My files, which is theirs alone; beside it, how many are new
          since they last looked. For one drive of a whole team instead, give the server <C>top: 'everyone'</C>.
        </P>
      ),
    },
    {
      id: 'links',
      title: 'Links',
      badge: 'Links',
      color: 'green',
      lead: 'Anyone who has one may look and download, without signing in, for a day, a week or a month, or until it is removed.',
      body: (
        <>
          <List
            items={[
              <>
                <strong>With a password</strong>: asked for before anything is shown, sent as <C>x-link-password</C> at every request, kept only as scrypt makes it, a moment late after each wrong one.
              </>,
              <>
                <strong>For one download</strong>: taken by downloading a file or an archive of it, not by looking; it still works a quarter of an hour after, for the files of that download.
              </>,
            ]}
          />
          <Code lang="tsx" code={SHARE} />
        </>
      ),
    },
    {
      id: 'when-a-link-fails',
      title: 'When a link fails',
      badge: 'Errors',
      color: 'pink',
      body: (
        <>
          <Trouble says="This link does not work any more.">
            It was removed, it expired, it was used, what it read went to the trash, or its address was changed on the way: which one, a link does not say to whoever holds it.
          </Trouble>
          <Trouble says="This link asks for its password. · That is not the password.">The page of the link asks for it first, and sends it with every request.</Trouble>
        </>
      ),
    },
    {
      id: 'telling-people',
      title: 'Telling people',
      badge: 'Notify',
      color: 'yellow',
      body: (
        <P>
          <a href={hrefOf('activity')}>Activity and notifications</a>: <C>onShare</C> is called with each share, to send a mail or a notice of your application.
        </P>
      ),
    },
  ],
};

const ON_SHARE = `createDriveHandler({
  ...options,
  // Once the share is kept; a failure here is not the request's.
  onShare: async ({ entry, with: who, role, by, first }) => {
    if (first) await mail(who, \`\${by.id} shared “\${entry.name}” with you as \${role}\`);
  },
});`;

export const activity: DocPage = {
  title: 'Activity and notifications',
  description: 'Who did what to every file and folder, kept as each change is, and telling people what was shared with them.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: <>Every change is kept as activity, whatever made it: a route, an assistant, the trash emptying itself. It is told from the drive before and after the change, so nothing is left out.</>,
  sections: [
    {
      id: 'what-is-kept',
      title: 'What is kept',
      badge: 'Activity',
      color: 'blue',
      body: (
        <>
          <P>Made, uploaded, a new version, renamed, moved, put in the trash and back, deleted, shared and no longer, a link made and taken back, a colour given; who, and when.</P>
          <P>
            The details of a file have its <strong>Activity</strong>, and of a folder what was done right inside it too (<C>GET /entries/:id/activity</C>, <C>client.activity</C>); an assistant reads
            it with <C>get_activity</C>.
          </P>
        </>
      ),
    },
    {
      id: 'in-code',
      title: 'In code',
      badge: 'Core',
      color: 'green',
      body: (
        <Code
          code={`import { activityOf } from '@rebofiles/core';\n\nactivityOf(before, after, 'ana', new Date().toISOString());\n// [{ action: 'renamed', name: 'final.docx', was: 'draft.docx', by: 'ana', at, entry, parent }]`}
        />
      ),
    },
    {
      id: 'telling-people',
      title: 'Telling people',
      badge: 'onShare',
      color: 'yellow',
      lead: 'Beside Shared with me the drive counts what is new. To tell the person yourself, give the server onShare.',
      body: <Code code={ON_SHARE} />,
    },
    {
      id: 'know',
      title: 'What to know',
      badge: 'Know',
      color: 'pink',
      body: <Callout title="A change is kept without its line">if the store fails to write the activity: the change is the drive, the line is beside it.</Callout>,
    },
  ],
};

const ORIGINS = `createDriveHandler({
  ...options,
  // The desktop window on a Mac and on Windows, and a page of another domain.
  cors: { origins: ['tauri://localhost', 'http://tauri.localhost', 'https://app.example.com'] },
});`;

export const desktop: DocPage = {
  title: 'Desktop and other origins',
  description: 'The desktop application of the repository, with Tauri, and letting it in, or a page of another domain, with cors on the server and on the bucket.',
  source: 'apps/site/components/docs/pages/server.tsx',
  lead: <>The drive in a window of its own, on a Mac first, against your server; or in a page served from another domain. Both are another origin, let in by name.</>,
  sections: [
    {
      id: 'the-application',
      title: 'The application',
      badge: 'Tauri',
      color: 'purple',
      body: (
        <List
          items={[
            'The first time, it asks for the address of the server’s routes and, when the server asks for one, a token, sent as Authorization: Bearer; kept, and tried again at every start.',
            'Server → Change Server… (⇧⌘K) asks for another.',
            'What it downloads goes to Downloads, a name taken made free, “report (2).pdf”.',
            <>
              <C>npm run desktop</C> opens it against the playground; <C>npm run build:desktop</C> makes ReboFiles.app.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'let-it-in',
      title: 'Let it in',
      badge: 'cors',
      color: 'yellow',
      lead: 'Answered the browser’s question first, and the ETag of a part readable. Only the origins listed.',
      body: <Code code={ORIGINS} />,
    },
    {
      id: 'and-the-bucket',
      title: 'And the bucket',
      badge: 'Bucket',
      color: 'blue',
      body: <P>The bytes go to the bucket from the window straight: put the same origins in its rule of origins.</P>,
    },
    {
      id: 'not-yet',
      title: 'Not yet',
      badge: 'Next',
      color: 'pink',
      body: (
        <List
          items={[
            'Keeping a folder of the disk like a folder of the drive: the sync engine, @rebofiles/desktop, comes next.',
            'Signing in through the server’s page, for a server whose session is only a cookie.',
            'Windows and Linux: built the same way, not tried. Signed and notarized: not yet.',
          ]}
        />
      ),
    },
  ],
};
