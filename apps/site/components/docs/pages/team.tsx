// What a team asks of a drive soon: comments on what is in it; the server
// telling the application what is done, what went wrong, and how much each may
// ask; and what is kept, held or taken away whole for a person.

import { hrefOf } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../ui';

export const COMMENTS_HOOK = `import { useComments } from '@rebofiles/react';

function Remarks({ id }: { id: string }) {
  const { comments, add, resolve } = useComments(id);
  return (
    <ul>
      {comments.map((c) => (
        <li key={c.id} style={{ marginLeft: c.replyTo ? 16 : 0 }}>
          <b>{c.by}</b> {c.text} {!c.replyTo && <button onClick={() => resolve(c.id, !c.resolved)}>{c.resolved ? 'Reopen' : 'Resolve'}</button>}
        </li>
      ))}
      <button onClick={() => add('Looks good to me, @bea')}>Approve</button>
    </ul>
  );
}`;

export const ON_COMMENT = `createDriveHandler({
  // …
  onComment: async ({ comment, entry, mentions, by }) => {
    for (const who of mentions) await mail(who, \`\${by.id} named you on “\${entry.name}”: \${comment.text}\`);
  },
});`;

export const comments: DocPage = {
  title: 'Comments',
  description: 'What people say of a file or a folder: threads with replies, resolved when done, @ to name someone, in the details of the drive, the hooks and the assistant.',
  source: 'packages/core/src/comments.ts',
  lead: (
    <>
      Who may comment (a commenter, an editor, the owner) says something of a file or a folder in its details, under <strong>Comments</strong>; who may read it reads it. A reply goes under the comment
      that starts its thread, and a thread is resolved once it is dealt with.
    </>
  ),
  sections: [
    {
      id: 'in-the-drive',
      title: 'In the drive',
      badge: 'Details',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              The tab <strong>Comments</strong> of the details: each thread, its replies under it, who said what and when, “edited” when changed.
            </>,
            <>
              <strong>Reply</strong>, <strong>Resolve</strong> or <strong>Reopen</strong> a thread; <strong>Edit</strong> and <strong>Delete</strong> one’s own. The owner may delete any.
            </>,
            <>⌘Enter or Ctrl+Enter sends what is written; Escape leaves an edit. What another person says comes as it happens, from the events.</>,
            <>
              Each comment is in the activity of what it is on (<C>commented</C>), and goes with it when it is deleted for good.
            </>,
          ]}
        />
      ),
    },
    { id: 'in-your-own-screen', title: 'In a screen of your own', badge: 'Hooks', color: 'purple', body: <Code code={COMMENTS_HOOK} lang="tsx" /> },
    {
      id: 'telling-who-is-named',
      title: 'Telling who is named',
      badge: 'Server',
      color: 'green',
      lead: 'Whoever a comment names with an @ (`@bea`, `@ana.lopez`) is in `mentions`: telling them is your application’s, as onShare is.',
      body: <Code code={ON_COMMENT} />,
    },
    {
      id: 'for-the-assistant',
      title: 'For the assistant',
      badge: 'MCP',
      color: 'orange',
      body: (
        <P>
          <C>list_comments</C> reads them and <C>add_comment</C> says one, or a reply with <C>replyTo</C>, in the name of the one the assistant works for and with their rights: “add a note to the
          contract that the client signed”. See <a href={hrefOf('assistants')}>AI assistants</a>.
        </P>
      ),
    },
  ],
};

export const HOOKS_CODE = `import pino from 'pino';
import { metrics } from '@opentelemetry/api';
import { createDriveHandler, openTelemetry } from '@rebofiles/server';

const log = pino();

createDriveHandler({
  // …
  // Each thing done: a webhook, an audit of your own, another index, space counted.
  onChange: async ({ activity, entry }) => {
    await fetch(process.env.WEBHOOK!, { method: 'POST', body: JSON.stringify({ ...activity, size: entry?.kind === 'file' ? entry.versions[0].size : 0 }) });
  },
  logger: { error: (message, detail) => log.error({ detail }, message), warn: (message, detail) => log.warn({ detail }, message) },
  onRequest: openTelemetry(metrics.getMeter('rebofiles')),
});`;

export const LIMITS_CODE = `import { createDriveHandler } from '@rebofiles/server';

createDriveHandler({
  // …
  limits: {
    uploads: { max: 200, every: 60_000 },     // starting an upload, by person
    requests: { max: 1200, every: 60_000 },   // every request, by person
  },
  // Wrong passwords of a link counted by the address too, behind a proxy you trust.
  clientIp: (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim(),
});`;

export const REDIS_CODE = `import { Redis } from 'ioredis';
import type { Limiter } from '@rebofiles/server';

const redis = new Redis(process.env.REDIS_URL!);

/** The same windows for every process: a count per key, gone when its window is. */
export const redisLimiter: Limiter = {
  async hit(key, limit, how) {
    if (how?.peek) {
      const [count, ttl] = await Promise.all([redis.get(key), redis.pttl(key)]);
      return Number(count) >= limit.max ? { ok: false, retryAfter: ttl } : { ok: true, retryAfter: 0 };
    }
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, limit.every);
    return count <= limit.max ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: await redis.pttl(key) };
  },
};`;

export const observe: DocPage = {
  title: 'Hooks, logs and limits',
  description: 'The server telling your application what is done (onChange), what went wrong (logger) and how long each route takes (OpenTelemetry), and how much each may ask.',
  source: 'packages/server/src/observe.ts',
  lead: (
    <>
      What the server says of itself, and what it lets each one do how often. Each is an option of <C>createDriveHandler</C>, and each failure of yours is logged, not the request’s.
    </>
  ),
  sections: [
    {
      id: 'what-is-done',
      title: 'What is done, what failed, how long',
      badge: 'Hooks',
      color: 'blue',
      body: (
        <>
          <Code code={HOOKS_CODE} />
          <List
            items={[
              <>
                <C>onChange</C> is told each thing done, as the activity says it (<C>created</C>, <C>uploaded</C>, <C>version</C>, <C>renamed</C>, <C>moved</C>, <C>trashed</C>, <C>restored</C>,{' '}
                <C>deleted</C>, <C>shared</C>, <C>commented</C>, <C>held</C>…), with the entry as it is after, null once deleted.
              </>,
              <>
                <C>logger</C> is where the server writes what it did not answer for: an activity not kept, a hook that failed, a file that could not be inspected. <C>console</C> unless given.
              </>,
              <>
                <C>onRequest</C> is told each route as the list says it (<C>GET /entries/:id</C>), its status, its time and who asked. <C>openTelemetry(meter)</C> makes it the{' '}
                <C>http.server.request.duration</C> histogram and a counter of the 5xx.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'how-much-each-may-ask',
      title: 'How much each may ask',
      badge: 'Limits',
      color: 'yellow',
      body: (
        <>
          <Table
            label="The limits unless said"
            columns={['Kind', 'By', 'Unless said']}
            code={[0]}
            rows={[
              ['uploads', 'person', '1000 a minute'],
              ['zip', 'person, and link', '30 a minute'],
              ['searchText', 'person', '120 a minute'],
              ['linkPassword', 'link and address', '10 wrong in 15 minutes, then not even the right one'],
              ['links', 'link', '600 a minute'],
              ['requests', 'person', 'none'],
            ]}
          />
          <Code code={LIMITS_CODE} />
          <P>
            Past one, the answer is a <C>429 rate-limited</C> with <C>Retry-After</C>, and the drive says so in each person’s language. <C>limits: false</C> for none.
          </P>
        </>
      ),
    },
    {
      id: 'more-than-one-process',
      title: 'More than one process',
      badge: 'Redis',
      color: 'pink',
      lead: 'The counts are kept in the process unless a `limiter` of yours keeps them for all: a few lines over Redis.',
      body: <Code code={REDIS_CODE} file="limiter.ts" />,
    },
  ],
};

export const RETENTION_CODE = `// Nothing deleted for good before seven years, by anyone or by the trash.
await client.saveSettings({ retentionDays: 7 * 365 });

// A case: this folder and all in it out of reach of the trash until released.
await client.hold(folder.id, 'Case 2026-114');
await client.release(folder.id);`;

export const EXPORT_CODE = `import { downloadZip } from '@rebofiles/drive';

const exported = await client.exportPerson(); // one's own; another's for who may configure
const { pack, ...rest } = exported;
await downloadZip({ pack: async () => pack, urls: client.urls }, [], {
  name: 'my-data',
  extra: [{ path: 'rebofiles-export.json', text: JSON.stringify(rest, null, 2) }],
});`;

export const keeping: DocPage = {
  title: 'Retention, holds and export',
  description: 'Keep files a minimum of days, put a folder on legal hold so nothing in it is deleted, and give a person everything of theirs in one .zip, as GDPR asks.',
  source: 'packages/core/src/ops.ts',
  lead: <>Three things a company asks before it keeps its files in a drive: that nothing goes too soon, that what a case needs stays, and that a person can take what is theirs.</>,
  sections: [
    {
      id: 'a-minimum-of-days',
      title: 'A minimum of days',
      badge: 'Retention',
      color: 'blue',
      body: (
        <>
          <P>
            <C>retentionDays</C> of the drive’s settings (<strong>Settings → Storage</strong>, for who may configure): nothing made fewer days ago is deleted for good, by anyone or by the trash
            emptying itself. It may still go to the trash, and come back; emptying the trash leaves it there, and deleting it says <C>409 retained</C>.
          </P>
          <Code code={RETENTION_CODE} />
        </>
      ),
    },
    {
      id: 'a-legal-hold',
      title: 'A legal hold',
      badge: 'Hold',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              <strong>Put on hold</strong>, in the details, for who may configure: neither it nor anything in it may go to the trash or be deleted, by anyone, until it is released. Asked to, the
              answer is <C>409 on-hold</C>.
            </>,
            'New versions may still come: the ones before stay, as they always do.',
            <>
              The details say who held it and why; the activity has <C>held</C> and <C>released</C>, and <C>onChange</C> is told them.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'everything-of-a-person',
      title: 'Everything of a person',
      badge: 'Export',
      color: 'green',
      body: (
        <>
          <P>
            <strong>Settings → Language → Download my data</strong> makes a .zip of what one owns, at its places, and a <C>rebofiles-export.json</C> beside it: every entry of theirs, what is shared
            with them, their comments, what they did, their settings. <C>GET /export</C> gives the same; <C>?user=</C> another person’s, for who may configure.
          </P>
          <Code code={EXPORT_CODE} />
          <Callout title="Of another person,">
            the export gives what they own and did, as the drive keeps it; their bytes are read from the storage by your server, as <C>byRoles</C> lets no one but them download them.
          </Callout>
        </>
      ),
    },
  ],
};

export const GROUPS_CODE = `createDriveHandler({
  // …
  identify: async (request) => {
    const user = await session(request);
    // The groups your application says they are in: what is shared with "group:sales" is theirs to read.
    return user ? { id: user.id, groups: await groupsOf(user.id) } : null;
  },
  authorize: byRoles,
});

await client.share(folder.id, 'group:sales', 'editor');`;

export const SCALE_NUMBERS: [string, string][] = [
  ['The top of one’s drive', '13 ms'],
  ['A folder of 2,000 files', '22 ms'],
  ['A search by name', '35 ms'],
  ['A file moved', '8 ms'],
];
export const SCALE_NUMBERS_ES: [string, string][] = [
  ['La raíz del drive de uno', '13 ms'],
  ['Una carpeta de 2.000 archivos', '22 ms'],
  ['Una búsqueda por nombre', '35 ms'],
  ['Mover un archivo', '8 ms'],
];
export const SCALE_NUMBERS_ZH: [string, string][] = [
  ['自己网盘的最顶层', '13 ms'],
  ['包含 2,000 个文件的文件夹', '22 ms'],
  ['按名称搜索', '35 ms'],
  ['移动一个文件', '8 ms'],
];

export const DERIVE_CODE = `import { createDriveHandler } from '@rebofiles/server';
import { deriveAll } from '@rebofiles/server/derive';

// npm install sharp pdfjs-dist @napi-rs/canvas   (each only for what it makes)
createDriveHandler({ ...options, derive: deriveAll() });`;

export const OCR_CODE = `import { deriveAll, docx, ocr, pdf, pictures, text, xlsx } from '@rebofiles/server/derive';

// npm install tesseract.js   (the data of each language is fetched once, then kept)
createDriveHandler({
  ...options,
  derive: deriveAll(pictures(), pdf(), docx(), xlsx(), text(), ocr({ languages: ['eng', 'spa'] })),
});`;

export const STARRED_CODE = `const starred = await client.starred();   // the last starred first
await client.star(file.id);                // and client.star(file.id, false) to take it out`;

export const FIELDS_CODE = `// The files of a client of your CRM, tied to it by a field of your own:
await client.setFields(file.id, { client: 'acme', stage: 'won' });
await client.setFields(file.id, { stage: null });          // taken away
const ofAcme = await client.withField('client', 'acme');   // of what the one asking may read

// In the drive: shown in the details, and changed there with fields="edit".
<FileDrive base="/api/files" fields="edit" />`;

export const NOTICES_CODE = `const { notifications, unseen } = await client.notifications();
// [{ kind: 'shared', entry, name: 'Budget', by: 'ana', role: 'editor', at }, { kind: 'mentioned', text, … }]
await client.sawNotifications();   // none is new any more`;

export const ADMIN_CODE = `// For who may 'configure': what each keeps, and what was done anywhere.
const { people, total, quota } = await client.adminUsage();   // GET /admin/usage
const latest = await client.adminActivity(100);                // GET /admin/activity`;

export const organizing: DocPage = {
  title: 'Starred and fields',
  description: 'Each person’s starred files and folders, in a place of their own; and fields of your application on each entry, to tie it to your records and find it by them.',
  source: 'packages/core/src/ops.ts',
  lead: <>Two ways to find again what matters: what a person stars for themselves, and what your application ties to its own records.</>,
  sections: [
    {
      id: 'starred',
      title: 'Starred',
      badge: 'Each person',
      color: 'yellow',
      body: (
        <>
          <List
            items={[
              <>
                <strong>Add to starred</strong> in the details of a file or a folder, or in its menu: it is marked with a star wherever it is shown, and is in <strong>Starred</strong>, the last
                starred first.
              </>,
              'One’s own: nobody else sees what a person starred. What is in the trash, gone, or no longer theirs to read is left out.',
              <>
                Kept as a setting of the person (<C>starred:&lt;id&gt;</C>), up to a thousand: <C>GET /starred</C>, <C>PUT</C> and <C>DELETE /entries/:id/star</C>.
              </>,
            ]}
          />
          <Code code={STARRED_CODE} />
        </>
      ),
    },
    {
      id: 'fields',
      title: 'Fields of your own',
      badge: 'Your records',
      color: 'blue',
      lead: 'Text under a name on an entry, set by your application or by people, and found by: what ties a contract to a client of your CRM, a scan to a case.',
      body: (
        <>
          <Code code={FIELDS_CODE} lang="tsx" />
          <List
            items={[
              <>
                Names of letters, digits and <C>_ . -</C>, up to 64; values text, up to 1000; fifty an entry. Set by who may rename it (<C>PATCH /entries/:id</C> with <C>fields</C>).
              </>,
              <>
                <C>GET /fields?name=&amp;value=</C> finds what has one, of what the one asking may read: SQLite and Postgres ask the JSON of each entry, so a drive of thousands is not read whole.
              </>,
              <>
                The details show them unless <C>fields=&#123;false&#125;</C>; <C>fields="edit"</C> lets who may rename it change them there, a field a line.
              </>,
            ]}
          />
        </>
      ),
    },
  ],
};
