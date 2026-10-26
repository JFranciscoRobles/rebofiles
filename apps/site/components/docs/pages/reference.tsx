// Reference: the packages, every export of React's, the client, the routes,
// and what is checked.

import type { ReactNode } from 'react';
import { REPO, hrefOf } from '@/lib/site';
import { PUBLISHED, VERSION } from '@/lib/home';
import { InstallCommand } from '../frame/InstallCommand';
import { CLIENT, HOOKS, PACKAGE_DOCS, PROPS } from '../reference';
import type { Locale } from '@/lib/i18n';
import { type Route, routeId, routes } from '../routes';
import { routeIn } from '../routesI18n';
import { CHECKED, LIMITS, MEASURED, NOT_CHECKED, ROADMAP, TESTS } from '../status/data';
import { C, Code, type DocPage, List, P, RefTable, Table, withCode } from '../ui';
import { hookId, propId } from './app';

export const packageId = (name: string) => `package-${name.replace('@rebofiles/', '')}`;
export const clientId = (name: string) => `client-${name}`;

export const packages: DocPage = {
  title: 'Packages',
  description: 'Six packages, each for one thing, at the same version: which to install, where each runs, what each gives, and the applications of the repository.',
  source: 'apps/site/components/docs/reference.ts',
  lead: <>Every package is at the same version, {VERSION}, and changes together. Each has no dependencies but core and, where it says, Rebodocs as an optional peer.</>,
  sections: [
    {
      id: 'which-one',
      title: 'Which one do I install?',
      badge: 'Start here',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              A React application: <C>@rebofiles/react</C> for the page, <C>@rebofiles/server</C> for the route.
            </>,
            <>
              A page without React: <C>@rebofiles/drive</C>, and the server.
            </>,
            <>
              Changing a drive in a job of your own: <C>@rebofiles/core</C>.
            </>,
            <>
              An assistant: <C>@rebofiles/mcp</C>, beside the server.
            </>,
          ]}
        />
      ),
    },
    ...PACKAGE_DOCS.map((pkg) => ({
      id: packageId(pkg.name),
      title: pkg.name,
      badge: pkg.comes ? `Coming in ${pkg.comes}` : pkg.runs,
      color: pkg.comes ? ('orange' as const) : ('purple' as const),
      lead: pkg.what,
      body: pkg.comes ? null : (
        <>
          {PUBLISHED && (
            <div className="mt-5">
              <InstallCommand command={pkg.install} />
            </div>
          )}
          <P>
            {pkg.gives.map((name, i) => (
              <span key={name}>
                {i > 0 && ', '}
                <C>{name}</C>
              </span>
            ))}
            {' · '}
            <a href={`${REPO}/tree/main/packages/${pkg.name.replace('@rebofiles/', '')}#readme`}>its README</a>
          </P>
        </>
      ),
    })),
    {
      id: 'the-applications',
      title: 'The applications',
      badge: 'Apps',
      color: 'green',
      body: (
        <P>
          <a href={hrefOf('demos')}>Demos to run</a>: the playground, the demo, a real bucket, the desktop and this site, each a folder of <C>apps/</C>.
        </P>
      ),
    },
  ],
};

export const EXPORTS: [string, string][] = [
  ['FileDrive', 'The whole drive.'],
  ['SharedLink', 'What someone sent a link sees, without signing in.'],
  ['createMemoryClient', 'The drive kept in the page, with the client of the server’s routes.'],
  ['createDriveClient, createLinkClient', 'The clients, from @rebofiles/drive.'],
  ['RequestError', 'What the server refused: its status, its code and its message.'],
  ['TEXTS, formatSize, formatDate, formatDuration, kindOf', 'The words, and what is said of a file.'],
  ['@rebofiles/react/rebodocs', 'previewDocx, viewDocx, thumbDocx, pictureOfDocx, textOfDocx: Word documents by Rebodocs’ engine.'],
];

export const components: DocPage = {
  title: 'Components and hooks',
  description: 'Everything @rebofiles/react exports: two components, seven hooks, every prop of <FileDrive>, and the functions beside them.',
  source: 'apps/site/components/docs/reference.ts',
  lead: <>What an application of React needs is in this one package; what it shares with the drive without a framework is exported from it too.</>,
  sections: [
    { id: 'exports', title: 'Exports', badge: 'All', color: 'blue', body: <Table label="Exports" columns={['Name', 'What it is']} rows={EXPORTS.map(([name, what]) => [name, what])} /> },
    {
      id: 'hooks',
      title: 'Hooks',
      badge: 'Hooks',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: `ref-${hookId(hook.name)}`, name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    {
      id: 'props',
      title: 'Every prop of <FileDrive>',
      badge: 'Props',
      color: 'yellow',
      body: (
        <>
          <RefTable label="Props of FileDrive" name="Prop" rows={PROPS.map((prop) => ({ id: `ref-${propId(prop.name)}`, name: prop.name, type: prop.type, does: withCode(prop.does) }))} />
          <P>
            By what they are for, with examples: <a href={hrefOf('react')}>React component</a>.
          </P>
        </>
      ),
    },
  ],
};

export const CLIENT_CODE = `import { createDriveClient } from '@rebofiles/drive'; // or @rebofiles/react

const client = createDriveClient({
  base: '/api/files',
  headers: async () => ({ authorization: \`Bearer \${await token()}\` }),
  parallel: 3,                          // parts at once, of each file
  retry: { attempts: 5, delay: 1000 },  // a part that fails, again
});

const { entries } = await client.list(null);
const file = await client.upload(input.files[0], { parent: entries[0].id, onProgress: ({ sent, size }) => draw(sent / size) });`;

export const GROUPS = ['Reading', 'Changing', 'Uploads', 'Sharing', 'Files', 'Settings', 'Live'] as const;

export const client: DocPage = {
  title: 'Client API',
  description: 'createDriveClient: one function for each route of the server, by what it is for, and the refusals it throws.',
  source: 'apps/site/components/docs/reference.ts',
  lead: (
    <>
      The client the drive and the hooks are built on, and <C>createMemoryClient</C> answers the same, from the page. A refusal of the server is thrown as a <C>RequestError</C> with its <C>status</C>{' '}
      and <C>code</C>: <C>name-taken</C>, <C>in-trash</C>, <C>over-quota</C>, <C>forbidden</C>…
    </>
  ),
  sections: [
    { id: 'make-one', title: 'Make one', badge: 'Start', color: 'purple', body: <Code code={CLIENT_CODE} /> },
    ...GROUPS.map((group) => ({
      id: `client-${group.toLowerCase()}`,
      title: group,
      badge: 'Methods',
      color: 'blue' as const,
      body: (
        <RefTable
          label={`Client: ${group}`}
          name="Method"
          rows={CLIENT.filter((method) => method.group === group).map((method) => ({ id: clientId(method.name), name: method.signature, does: withCode(method.does) }))}
        />
      ),
    })),
  ],
};

export const METHOD: Record<Route['method'], string> = {
  GET: 'bg-pastel-green text-pastel-green-fg',
  POST: 'bg-pastel-blue text-pastel-blue-fg',
  PUT: 'bg-pastel-yellow text-pastel-yellow-fg',
  PATCH: 'bg-pastel-purple text-pastel-purple-fg',
  DELETE: 'bg-pastel-pink text-pastel-pink-fg',
};

/** The routes of one kind, as api.ts says them; the column heads and the label in the page's language. */
export function RouteTable({
  through,
  words = ['Routes', 'Routes of a link', 'Route', 'What it does'],
  locale = 'en',
}: {
  through: Route['through'];
  words?: [string, string, string, string];
  locale?: Locale;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways on a phone, and a keyboard has to reach what is hidden (WCAG 2.1.1)
    <section className="mt-5 max-w-[920px] overflow-x-auto rounded-[14px] border border-border" aria-label={through === 'link' ? words[1] : words[0]} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
        <thead className="bg-surface text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          <tr>
            <th className="px-4.5 py-3 font-semibold">{words[2]}</th>
            <th className="px-4.5 py-3 font-semibold">{words[3]}</th>
          </tr>
        </thead>
        <tbody>
          {routes()
            .filter((route) => route.through === through)
            .map((route) => (
              <tr key={routeId(route)} id={routeId(route)} className="scroll-mt-28 border-t border-border align-top target:bg-pastel-yellow/60">
                <td className="whitespace-nowrap px-4.5 py-3.5">
                  <span className={`mr-2 inline-block w-[62px] rounded-[5px] px-1.5 py-0.5 text-center font-code text-[11.5px] font-semibold ${METHOD[route.method]}`}>{route.method}</span>
                  <code className="font-code text-[13.5px] text-ink">{route.path}</code>
                </td>
                <td className="px-4.5 py-3.5 leading-normal text-ink-soft">{routeIn(locale, route) || '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}

export const routesPage: DocPage = {
  title: 'HTTP routes',
  description: 'Every route of @rebofiles/server, as the code keeps them: those of someone signed in, and those of a link.',
  source: 'packages/server/src/api.ts',
  lead: (
    <>
      Under the <C>base</C> of the handler, <C>/api/files</C> in these pages. Read from the comment at the top of <C>packages/server/src/api.ts</C> when this site is built, so it says what the code
      does. Bodies are JSON; a refusal is <C>&#123; error, message &#125;</C> with its status.
    </>
  ),
  sections: [
    {
      id: 'signed-in',
      title: 'Of someone signed in',
      badge: 'Session',
      color: 'blue',
      lead: 'Each asks identify who is asking and authorize whether they may.',
      body: <RouteTable through="session" />,
    },
    {
      id: 'through-a-link',
      title: 'Through a link',
      badge: 'Links',
      color: 'pink',
      lead: 'They ask neither: the link is the permission. A link with a password asks for it at each.',
      body: <RouteTable through="link" />,
    },
  ],
};

/** `code` in the texts of data.ts, as code. */
export const Rows = ({ rows }: { rows: [string, string][] }) => (
  <div className="mt-5 max-w-[920px] overflow-hidden rounded-[14px] border border-border">
    {rows.map(([what, how]) => (
      <div key={what} className="grid gap-1 border-t border-border px-4.5 py-3.5 first:border-t-0 sm:grid-cols-[180px_1fr] sm:gap-5">
        <p className="m-0 font-semibold text-ink">{what}</p>
        <p className="m-0 text-[15.5px] text-ink-soft">{withCode(how)}</p>
      </div>
    ))}
  </div>
);

export const Milestones = ({ of = (done: number, all: number) => `${done} of ${all}`, notYet = '(not yet)' }: { of?: (done: number, all: number) => string; notYet?: string }): ReactNode => (
  <ol className="m-0 mt-5 max-w-[920px] list-none space-y-3 p-0">
    {ROADMAP.map((milestone) => {
      const done = milestone.items.filter((item) => item.done).length;
      return (
        <li key={milestone.version} className="rounded-[14px] border border-border p-4.5">
          <p className="m-0 flex flex-wrap items-baseline gap-x-3">
            <span className="font-code text-[14px] font-medium text-brand">{milestone.version}</span>
            <span className="font-semibold text-ink">{milestone.name}</span>
            {done > 0 && <span className="ml-auto text-[13px] text-muted">{of(done, milestone.items.length)}</span>}
          </p>
          <ul className="m-0 mt-2.5 list-none space-y-1.5 p-0 text-[15px]">
            {milestone.items.map((item) => (
              <li key={item.what} className="flex gap-2.5 text-ink-soft">
                <span aria-hidden="true" className={item.done ? 'text-brand' : 'text-faint'}>
                  {item.done ? '✓' : '○'}
                </span>
                <span>
                  {item.what}
                  {item.done ? '' : <span className="sr-only"> {notYet}</span>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      );
    })}
  </ol>
);

export const status: DocPage = {
  title: 'Status and roadmap',
  description: 'What is checked, with the tests of each package; what is not; the known limits; and the roadmap.',
  source: 'apps/site/components/docs/status/data.ts',
  lead: (
    <>
      Version {VERSION}, {PUBLISHED ? 'on npm' : 'not on npm yet'}. The numbers are what running the commands gave on {MEASURED}, not what anyone remembers; the same is in{' '}
      <a href={`${REPO}/blob/main/ROADMAP.md`}>ROADMAP.md</a>.
    </>
  ),
  sections: [
    {
      id: 'what-is-checked',
      title: 'What is checked',
      badge: 'Tests',
      color: 'green',
      lead: `${TESTS.reduce((sum, row) => sum + row.count, 0)} tests, every one passing, by npm test and, in Chrome, npm run test:browser.`,
      body: (
        <div className="mt-5 max-w-[920px] overflow-hidden rounded-[14px] border border-border">
          {TESTS.map((row) => (
            <div key={row.where} className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 border-t border-border px-4.5 py-3.5 first:border-t-0">
              <p className="m-0 font-code text-[14px] font-medium text-ink">{row.where}</p>
              <p className="row-span-2 m-0 self-center font-display text-[28px] font-extrabold tracking-[-0.03em] text-brand">{row.count}</p>
              <p className="m-0 text-[15px] text-ink-soft">{row.what}</p>
            </div>
          ))}
        </div>
      ),
    },
    { id: 'checked-by-hand', title: 'Checked by hand', badge: 'By hand', color: 'blue', body: <Rows rows={CHECKED} /> },
    { id: 'what-is-not', title: 'What is not', badge: 'Not yet', color: 'pink', body: <Rows rows={NOT_CHECKED} /> },
    {
      id: 'known-limits',
      title: 'Known limits',
      badge: 'Limits',
      color: 'yellow',
      body: (
        <div className="mt-5 grid max-w-[920px] gap-3 sm:grid-cols-2">
          {LIMITS.map((group) => (
            <div key={group.area} className="rounded-[14px] border border-border p-4.5">
              <p className="m-0 font-semibold text-ink">{group.area}</p>
              <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft">
                {group.items.map((item) => (
                  <li key={item}>{withCode(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    { id: 'roadmap', title: 'Roadmap', badge: 'Next', color: 'purple', lead: 'In the order it is built. Each version goes to npm when its last item is done, and not before.', body: <Milestones /> },
    { id: 'license', title: 'License', badge: 'MIT', color: 'orange', body: <P>MIT. Anyone may use it for anything, including commercially, with no warranty.</P> },
  ],
};
