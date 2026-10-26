// The server in an application and in production: each framework and sign-in,
// the uploads checked before they are kept, the changes shown as they happen,
// a folder of the computer kept in sync, and what to set before going live.
// The code of the frameworks is read from examples/ when the site is built,
// where it is run by tests (examples/test): what the page shows is what runs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hrefOf } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table, Trouble } from '../ui';

/** A file of examples/, as it is in the repository. */
export const example = (file: string) =>
  readFileSync(path.join(process.cwd(), '../../examples', file), 'utf8')
    .replace(/^\/\/[^\n]*\n(\/\/[^\n]*\n)*\n?/, '')
    .trim();

export const NEXT_ROUTE = () => example('nextjs/app/api/files/[...path]/route.ts');
export const EXPRESS = () => example('express/server.ts');
export const HONO = () => example('hono/server.ts');
export const FASTIFY = () => example('fastify/server.ts');
export const DRIVE = () => example('drive.ts');
export const AUTHJS = () => example('auth/authjs.ts');
export const CLERK = () => example('auth/clerk.ts');
export const JWT = () => example('auth/jwt.ts');

export const frameworks: DocPage = {
  title: 'Frameworks and sign-in',
  description: 'The drive in Next.js, Express, Hono and Fastify, and who is asking from Auth.js, Clerk or a token of your own: code that is run by tests.',
  source: 'examples/',
  lead: (
    <>
      <C>createDriveHandler</C> takes a Request and gives a Response, so each framework needs a few lines: hand it the request as it came, before anything reads its body. Every example here is a file
      of <C>examples/</C>, served on a port and asked over HTTP by its tests: a folder made, a file of two parts uploaded and read back, and a change told as it happens.
    </>
  ),
  sections: [
    {
      id: 'one-drive',
      title: 'One drive for all of them',
      badge: 'Setup',
      color: 'purple',
      lead: 'The bytes in a bucket when S3_BUCKET says one, else on the disk; the entries in SQLite. The same in each example.',
      body: <Code code={DRIVE()} file="examples/drive.ts" />,
    },
    {
      id: 'nextjs',
      title: 'Next.js',
      badge: 'App Router',
      color: 'blue',
      lead: 'One route handler for every route, in Node: it signs with node:crypto.',
      body: <Code code={NEXT_ROUTE()} file="app/api/files/[...path]/route.ts" />,
    },
    {
      id: 'express',
      title: 'Express',
      badge: 'Node',
      color: 'green',
      lead: 'Mounted before express.json(): the drive reads its own bodies.',
      body: <Code code={EXPRESS()} file="examples/express/server.ts" />,
    },
    { id: 'hono', title: 'Hono', badge: 'Node · Bun · Deno', color: 'yellow', lead: 'Hono’s request is the one the drive takes.', body: <Code code={HONO()} file="examples/hono/server.ts" /> },
    {
      id: 'fastify',
      title: 'Fastify',
      badge: 'Node',
      color: 'orange',
      lead: 'In a plugin of its own, where no parser of Fastify’s reads the body, and the answer written on the raw response.',
      body: <Code code={FASTIFY()} file="examples/fastify/server.ts" />,
    },
    {
      id: 'auth-js',
      title: 'Who asks, with Auth.js',
      badge: 'Sign-in',
      color: 'pink',
      body: (
        <>
          <Code code={AUTHJS()} file="examples/auth/authjs.ts" />
          <P>
            Pass it as <C>identify</C>. The page sends the session cookie with every request of its own origin, so nothing else is needed in the browser.
          </P>
        </>
      ),
    },
    {
      id: 'clerk',
      title: 'Who asks, with Clerk',
      badge: 'Sign-in',
      color: 'pink',
      body: <Code code={CLERK()} file="examples/auth/clerk.ts" />,
    },
    {
      id: 'your-own-token',
      title: 'A token of your own',
      badge: 'JWT',
      color: 'pink',
      lead: 'For an application with its own sign-in, and for the desktop application, which sends `Authorization: Bearer`.',
      body: (
        <>
          <Code code={JWT()} file="examples/auth/jwt.ts" />
          <Callout title="Tried, and not:">
            the token of your own is checked by the tests, with a forged one refused. Auth.js and Clerk are written to their documentation and not run here, as they need accounts of theirs.
          </Callout>
        </>
      ),
    },
    {
      id: 'when-something-fails',
      title: 'When something fails',
      badge: 'Errors',
      color: 'pink',
      body: (
        <>
          <Trouble says="The body is not JSON.">A parser of the framework read the body first: mount the drive before it, or out of its reach, as the examples do.</Trouble>
          <Trouble says="No GET /api/files/…">
            The path the framework gave is not the whole one. <C>nodeHandler</C> takes <C>originalUrl</C> when there is one (Express); otherwise mount it where <C>base</C> says.
          </Trouble>
          <Trouble says="Sign in first.">
            <C>identify</C> found no one: the cookie did not come (another origin needs <C>cors</C> and a token), or the session has no id.
          </Trouble>
        </>
      ),
    },
  ],
};

export const BEFORE_UPLOAD = `import { Refused, createDriveHandler } from '@rebofiles/server';

createDriveHandler({
  // …
  beforeUpload: (upload) => {
    if (upload.type.startsWith('video/')) throw new Refused(415, 'no-videos', 'Videos go to the media library.');
    if (upload.parent === null && upload.purpose === 'file') return false; // nothing loose at the top
  },
});`;

export const INSPECT = `import { checkType, clamav, createDriveHandler, inspectAll } from '@rebofiles/server';

createDriveHandler({
  // …
  // A program called photo.png, a PDF called .docx: refused. Then ClamAV, on its TCP socket.
  inspect: inspectAll(checkType(), clamav({ host: '127.0.0.1', port: 3310 })),
});`;

export const CLAMD = `# Ubuntu: the daemon, its signatures kept fresh, and a socket the server reaches
sudo apt install clamav-daemon
echo 'TCPSocket 3310' | sudo tee -a /etc/clamav/clamd.conf
echo 'TCPAddr 127.0.0.1' | sudo tee -a /etc/clamav/clamd.conf
sudo systemctl restart clamav-daemon

# Or in Docker
docker run -d -p 3310:3310 clamav/clamav`;

export const OWN_INSPECT = `inspect: async (upload, drive) => {
  if (upload.purpose === 'rendition') return;     // a smaller picture the page made
  const head = await upload.read({ from: 0, to: 4100 });
  const verdict = await myScanner(upload.key, head);
  if (verdict === 'reject') throw new Refused(422, 'rejected', \`\${upload.name} was not kept.\`);
},`;

export const checkingUploads: DocPage = {
  title: 'Checking uploads',
  description: 'Refuse a file before it goes up, by its name, type and size; and once its bytes arrive, by what they really are, or by what ClamAV finds in them.',
  source: 'packages/server/src/inspect.ts',
  lead: (
    <>
      The bytes go from the browser to the bucket without passing through the server, and the server only lists a file once they are there. So there are two moments to say no: before it is given
      addresses (<C>beforeUpload</C>), and after its bytes arrived and before anyone sees it (<C>inspect</C>). What is refused at the second is taken out of the bucket.
    </>
  ),
  sections: [
    {
      id: 'before',
      title: 'Before it goes up',
      badge: 'beforeUpload',
      color: 'blue',
      lead: 'With what the page says of it: its name, type, size and where it goes. Nothing has been sent yet.',
      body: (
        <>
          <Code code={BEFORE_UPLOAD} />
          <P>
            A <C>Refused</C> is answered with its status, code and message; <C>false</C> is a 403. It is asked for each new file and each new version, not for the smaller pictures the page makes of
            one. The type and size are what the page says: for what they really are, <C>inspect</C>.
          </P>
        </>
      ),
    },
    {
      id: 'after',
      title: 'Once its bytes arrived',
      badge: 'inspect',
      color: 'yellow',
      lead: 'Asked before the file or the version is kept, with a read of the bytes in the storage. Both storages of the server can read.',
      body: (
        <>
          <Code code={INSPECT} />
          <List
            items={[
              <>
                <C>checkType()</C> reads the first 4 KB. It refuses a program (an .exe, a binary of Linux or of a Mac) unless <C>programs: true</C>, and a file whose bytes are not those of its
                extension: a PNG that is not one, a .docx that is not a zip. <C>only</C> keeps to some types.
              </>,
              <>
                <C>clamav()</C> sends the bytes to clamd, a megabyte at a time, by its INSTREAM command. A file larger than clamd takes (25 MB unless said) is refused, not let in unscanned.
              </>,
              <>
                <C>inspectAll(…)</C> asks several in order: the first to refuse refuses.
              </>,
            ]}
          />
          <Callout title="A file not looked at is not let in.">
            When <C>inspect</C> throws something other than a <C>Refused</C> (clamd down, a time out), the upload is refused with a 503 and its bytes are taken away. The page says so, and the person
            uploads it again.
          </Callout>
        </>
      ),
    },
    { id: 'clamav', title: 'ClamAV on the server', badge: 'Viruses', color: 'pink', body: <Code lang="bash" code={CLAMD} /> },
    {
      id: 'your-own',
      title: 'An inspect of your own',
      badge: 'Yours',
      color: 'purple',
      lead: 'Any function: a scanner of your provider, a rule of your own on what may be kept.',
      body: <Code code={OWN_INSPECT} />,
    },
    {
      id: 'what-people-read',
      title: 'What people read',
      badge: 'Errors',
      color: 'green',
      body: (
        <Table
          label="Refusals of an upload"
          columns={['Code', 'Status', 'When']}
          rows={[
            ['upload-refused', '403', 'beforeUpload returned false'],
            ['program-refused', '422', 'checkType: a program'],
            ['type-mismatch', '422', 'checkType: the bytes are not those of the extension'],
            ['type-refused', '422', 'checkType: a type not among only'],
            ['virus-found', '422', 'clamav: a virus, named in the message'],
            ['refused-content', '422', 'inspect returned false'],
            ['not-scanned · not-inspected', '503', 'clamav, or inspect, could not look at it'],
          ]}
        />
      ),
    },
  ],
};

export const WATCH = `const stop = client.watch((event) => {
  // { by: 'bea', at: '…', folders: ['<id>'], entries: ['<id>'] }
  if (event.folders.includes(current)) reload();
});`;

export const live: DocPage = {
  title: 'Live changes and large folders',
  description: 'What others change shown as it happens, through server-sent events, without loading again; and folders of thousands, of which only what is in sight is in the page.',
  source: 'packages/server/src/api.ts',
  lead: (
    <>
      Two people with the same folder open see each other’s changes within a moment: a folder made, a file renamed, moved or put in the trash. And a folder of thousands of files scrolls as one of ten.
    </>
  ),
  sections: [
    {
      id: 'as-it-happens',
      title: 'As it happens',
      badge: 'Events',
      color: 'blue',
      body: (
        <>
          <P>
            The page watches <C>GET /events</C>, a stream of server-sent events, read with <C>fetch</C> so it carries your <C>headers</C>. Each change is told to each one watching only as far as they
            may see it: the folders where it was that they may list, and the entries that they may read. Names are not sent; the page asks for what it shows, as always.
          </P>
          <P>
            <C>&lt;FileDrive&gt;</C>, <C>mountDrive</C> and every hook under a <C>DriveProvider</C> ask again a quarter of a second after a change, once for changes that come together. A cut is
            followed by a new connection, a little later each time. <C>live=&#123;false&#125;</C> turns it off.
          </P>
          <Code code={WATCH} file="your own screen" />
        </>
      ),
    },
    {
      id: 'more-processes',
      title: 'More than one process',
      badge: 'Servers',
      color: 'purple',
      body: (
        <P>
          A change made by this process is told at once. One made by another process on the same store is seen by its revision, which SQLite and Postgres keep, looked at every two seconds while
          someone watches (<C>live: &#123; poll &#125;</C>). A store without a revision tells only this process’s changes.
        </P>
      ),
    },
    {
      id: 'behind-a-proxy',
      title: 'Behind a proxy',
      badge: 'Production',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              A line of nothing goes every 25 seconds, so a proxy does not close the stream for being quiet. Let a request last longer than that: <C>proxy_read_timeout 1h</C> in nginx.
            </>,
            <>
              The answer says <C>x-accel-buffering: no</C> and <C>cache-control: no-transform</C>, so nginx and compression do not hold it back.
            </>,
            <>
              On a platform that ends a request after some seconds (serverless functions), the page connects again when it is cut, and changes in between are seen at the next one. Or turn it off with{' '}
              <C>live: false</C>.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'large-folders',
      title: 'Large folders',
      badge: 'Speed',
      color: 'green',
      body: (
        <>
          <P>
            From 200 entries, the list and the grid put in the page only what is in sight and a few rows around it, with the room of the rest kept above and below, so the scroll bar is as long as all
            of it. The rows are measured as they are shown, and the grid’s columns follow its width.
          </P>
          <P>
            The keyboard goes through all of them as before: an arrow, Home or End brings the one it goes to into sight first, as a screen reader is told of the one current. Each says where it is
            among all (<C>aria-posinset</C>, <C>aria-setsize</C>). Ctrl+A picks all of them, not only those in the page, and the addresses of pictures are asked only for those shown.
          </P>
        </>
      ),
    },
  ],
};

export const SYNC_CLI = `npx rebofiles-sync ~/ReboFiles --server https://app.example.com/api/files --token "$TOKEN"
npx rebofiles-sync ./Clients --server … --folder <id of a folder of the drive> --once`;

export const SYNC_CODE = `import { createDriveClient } from '@rebofiles/drive';
import { watchSync } from '@rebofiles/sync';

const client = createDriveClient({ base: 'https://app.example.com/api/files', headers: () => ({ authorization: \`Bearer \${token}\` }) });
const sync = watchSync({ client, folder: '/Users/ana/ReboFiles', onAction: (action) => console.log(action) });
// sync.stop()`;

export const sync: DocPage = {
  title: 'Sync a folder',
  description: 'A folder of the computer kept as a folder of the drive, both ways: changes sent and taken, conflicts kept twice, moves followed. In the desktop app and as a command.',
  source: 'packages/sync/src/engine.ts',
  lead: (
    <>
      <C>@rebofiles/sync</C> keeps a folder of the disk the same as one of the drive. Each run lists both and compares them with what they were when last the same, so it knows which side changed.
    </>
  ),
  sections: [
    {
      id: 'in-the-desktop-app',
      title: 'In the desktop application',
      badge: 'Desktop',
      color: 'blue',
      body: (
        <P>
          <strong>Server → Sync a Folder…</strong> (⇧⌘S) asks which folder, <C>~/ReboFiles</C> unless said, and keeps it while the window is open: when it starts, when the drive tells a change, when
          the window comes back to the front, and every half a minute. The chip at the bottom says how it went. The disk is read and written by the application’s own commands, which never leave that
          folder.
        </P>
      ),
    },
    { id: 'as-a-command', title: 'As a command', badge: 'CLI', color: 'green', lead: 'On any computer with Node, also as a service.', body: <Code lang="bash" code={SYNC_CLI} /> },
    { id: 'in-your-code', title: 'In your code', badge: 'API', color: 'purple', body: <Code code={SYNC_CODE} /> },
    {
      id: 'what-it-does',
      title: 'What it does',
      badge: 'Rules',
      color: 'yellow',
      body: (
        <Table
          label="What a run does"
          columns={['When', 'It']}
          code={[]}
          rows={[
            ['New on one side', 'Made on the other: a folder, or the file sent or taken.'],
            ['Changed on one side', 'A new version in the drive, or the file on the disk written again.'],
            ['Changed on both', 'The drive’s at its name; the disk’s beside it as “name (conflict 2026-10-26 14.05).ext”, sent as a file of its own.'],
            ['Gone from the disk', 'Into the drive’s trash, from where it comes back; unless it changed in the drive since, when it is taken again.'],
            ['Gone from the drive', 'Aside on the disk, in .rebofiles/removed/; unless it changed on the disk since, when it is sent again.'],
            ['Moved or renamed in the drive', 'Moved on the disk, a folder with what is in it.'],
            ['A file moved on the disk', 'Moved in the drive, the same file with its versions, found by its size and time.'],
          ]}
        />
      ),
    },
    {
      id: 'what-it-does-not',
      title: 'What it does not do',
      badge: 'Limits',
      color: 'pink',
      body: (
        <List
          items={[
            'A folder renamed on the disk is sent again as a new one, and the old one goes to the trash: the files are the same, their versions start again.',
            'An empty folder of the disk where there were files is taken for a disk not there, and nothing is done until it is told (allowEmpty).',
            'The files of the systems (.DS_Store, Thumbs.db, ~$ files of Office) are left out, and so is its own .rebofiles folder.',
            'A file goes whole each time, not the part of it that changed.',
          ]}
        />
      ),
    },
  ],
};

export const NGINX = `location /api/files/ {
  proxy_pass http://app;
  proxy_request_buffering off;   # the disk storage carries the bytes through the server
  client_max_body_size 64m;      # a part is 8 MiB, more for a file of over 80 GB
  proxy_read_timeout 1h;         # the events go on as long as the page watches
}`;

export const LIFECYCLE = `{
  "Rules": [
    { "ID": "abort-unfinished", "Status": "Enabled", "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 2 } }
  ]
}`;

export const production: DocPage = {
  title: 'Going to production',
  description: 'Before the drive is open to people: the secret, the rule of origins of the bucket, limits, backups of the entries, rotating keys, uploads left halfway and a proxy.',
  source: 'apps/site/components/docs/pages/running.tsx',
  lead: <>What to set, and what to look at, before the drive of your application is open to the people who use it.</>,
  sections: [
    {
      id: 'checklist',
      title: 'The list',
      badge: 'Checklist',
      color: 'purple',
      body: (
        <List
          items={[
            <>
              <C>secret</C> long and random (<C>openssl rand -hex 32</C>), the same in every process, from the environment, never in the code.
            </>,
            <>
              <C>identify</C> from your session, and <C>authorize</C> with <C>byRoles</C> or rules of yours: never <C>everyone()</C>.
            </>,
            <>
              The bucket’s rule of origins with your domains only, <C>ETag</C> exposed (<a href={hrefOf('storage')}>Storage</a>).
            </>,
            <>
              <C>maxSize</C> and the <C>quota</C> of each person in the settings; <C>trashDays</C> so the trash empties itself.
            </>,
            <>
              <C>inspect: checkType()</C> at least, and ClamAV for files from people you do not know (<a href={hrefOf('checking-uploads')}>Checking uploads</a>).
            </>,
            <>
              Postgres for more than one process (<a href={hrefOf('metadata')}>Metadata</a>), with its backups.
            </>,
            <>A lifecycle rule in the bucket, as below.</>,
          ]}
        />
      ),
    },
    {
      id: 'uploads-left-halfway',
      title: 'Uploads left halfway',
      badge: 'Bucket',
      color: 'yellow',
      body: (
        <>
          <P>
            A page closed in the middle of an upload leaves its parts in the bucket, which cost space and are listed nowhere. The server sweeps them itself every ten minutes, as requests come: those
            older than the life of their tokens (a day) are aborted, under its <C>prefix</C> only, and on the disk their parts removed. A lifecycle rule of the bucket does the same without it:
          </P>
          <Code lang="json" code={LIFECYCLE} file="lifecycle.json" />
        </>
      ),
    },
    {
      id: 'backups',
      title: 'Backups',
      badge: 'Data',
      color: 'green',
      body: (
        <>
          <P>
            The entries are what says which bytes are which file: without them, the bucket is a heap of ids. Back them up as your database: <C>pg_dump</C> for Postgres, or for SQLite{' '}
            <C>sqlite3 drive.sqlite ".backup backup.sqlite"</C>, which is safe while the server writes.
          </P>
          <P>
            The bytes are never changed in place: a version is a new key. So versioning in the bucket is not needed for the drive, and a copy of the bucket (R2 to S3, rclone) is a backup that only
            grows. Delete in it only what the drive deleted.
          </P>
        </>
      ),
    },
    {
      id: 'rotating-keys',
      title: 'Rotating keys',
      badge: 'Secrets',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              The key of the bucket: make a new one, give it to every process, then revoke the old one once two hours have gone: an address to download lasts fifteen minutes, one to show a picture two
              hours.
            </>,
            <>
              The <C>secret</C>: a new one ends the uploads in progress (their tokens) and changes the addresses of links. Links made before stop working, as they are signed with it: make it at a
              quiet hour, and tell those who shared links.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'behind-a-proxy',
      title: 'Behind a proxy',
      badge: 'nginx',
      color: 'blue',
      body: (
        <>
          <Code lang="nginx" code={NGINX} />
          <P>With a bucket, the bytes do not pass through the proxy at all: only the requests of the drive, which are small, and the events, which last.</P>
        </>
      ),
    },
    {
      id: 'watch',
      title: 'What to watch',
      badge: 'Logs',
      color: 'orange',
      body: (
        <P>
          The server writes to the console what it could not do and did not answer for: an activity not kept, <C>onShare</C> failed, uploads not swept, a file that could not be inspected. Each with
          the error. A 500 says nothing of the inside to the page; the console says it all.
        </P>
      ),
    },
  ],
};
