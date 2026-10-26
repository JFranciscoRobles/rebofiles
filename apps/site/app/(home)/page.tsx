import type { ReactNode } from 'react';
import { CodeTabs } from '@/components/CodeTabs';
import { FeatureGrid } from '@/components/home/FeatureGrid';
import { InstallPicker } from '@/components/home/InstallPicker';
import { LiveDemo } from '@/components/home/LiveDemo';
import { SiteFooter, SiteHeader, primary } from '@/components/home/SiteChrome';
import { highlight } from '@/lib/highlight';
import { PACKAGES, PASTEL_CLASS, PUBLISHED, type Pastel, TAGS, VERSION, npmOf, pastelAt } from '@/lib/home';
import { DEMOS, DOCS, GET_STARTED, NPM_ORG, STATUS } from '@/lib/site';
import { TESTS } from '@/components/docs/status/data';

const SAMPLES: [string, string, string][] = [
  [
    'React',
    'tsx',
    `'use client';
import { FileDrive } from '@rebofiles/react';

export default function Files() {
  return (
    <FileDrive
      base="/api/files"
      title="Acme Files"
      language="en"
    />
  );
}`,
  ],
  [
    'Your UI',
    'tsx',
    `import { DriveProvider, useEntries, useUploads } from '@rebofiles/react';

function Folder({ id }: { id: string | null }) {
  const { entries } = useEntries({ section: 'files', folder: id });
  const { upload } = useUploads();
  return (
    <ul onDrop={(e) => upload(e.dataTransfer.files, id)}>
      {entries.map((entry) => <li key={entry.id}>{entry.name}</li>)}
    </ul>
  );
}

<DriveProvider base="/api/files">
  <Folder id={null} />
</DriveProvider>`,
  ],
  [
    'Server',
    'ts',
    `// app/api/files/[...path]/route.ts
import { createDriveHandler, s3Storage, s3OptionsFrom, sqliteMetadata } from '@rebofiles/server';

const handle = createDriveHandler({
  storage: s3Storage(s3OptionsFrom(process.env)),
  metadata: await sqliteMetadata('drive.sqlite'),
  identify: (request) => session(request)?.user ?? null,
  authorize: (user, action, entry) => mayI(user, action, entry),
  secret: process.env.REBOFILES_SECRET!,
  base: '/api/files',
});

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };`,
  ],
  [
    'With Rebodocs',
    'tsx',
    `import { FileDrive, useActions } from '@rebofiles/react';
import { previewDocx } from '@rebofiles/react/rebodocs';
import { DocsEditor } from '@rebodocs/react';

// A .docx is previewed as a page, and every save
// in the editor is a new version of the file.
<FileDrive previewDocument={previewDocx} onOpenDocument={open} />

<DocsEditor
  docx={bytes}
  onSave={(docx) => upload(new File([docx], file.name), { file: file.id })}
/>`,
  ],
  [
    'In the page',
    'tsx',
    `import { FileDrive, createMemoryClient } from '@rebofiles/react';

// No server: the drive kept in the page, with the same
// client and the same refusals. For demos and tests.
<FileDrive client={createMemoryClient({ user: 'You' })} />`,
  ],
];

const secondary = 'rounded-xl border border-border-strong bg-white font-semibold text-ink transition-colors hover:bg-hover';

const Pill = ({ color, children }: { color: Pastel | 'brand'; children: ReactNode }) => (
  <span className={`rounded-full px-3 py-[5px] text-[13px] font-semibold ${color === 'brand' ? 'bg-brand-light text-brand' : PASTEL_CLASS[color]}`}>{children}</span>
);
const Title = ({ children, small }: { children: ReactNode; small?: boolean }) => (
  <h2 className={`mt-4.5 font-display font-extrabold leading-[1.08] tracking-[-0.03em] ${small ? 'text-[clamp(34px,4.2vw,52px)]' : 'text-[clamp(36px,4.6vw,56px)]'}`}>{children}</h2>
);

const doodle = 'absolute hidden md:block';
/** A stroke drawn by hand, that draws itself in after `delay`. */
const drawn = (delay: string) => ({ className: 'draw animate-draw', style: { animationDelay: delay } });

function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-[1180px] px-6 pb-10 pt-18 text-center">
      <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true" className={`${doodle} left-[6%] top-[90px] animate-float`}>
        <path {...drawn('1.2s')} d="M35 8l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="none" stroke="#E0A526" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg width="90" height="60" viewBox="0 0 90 60" aria-hidden="true" className={`${doodle} right-[7%] top-[120px] animate-float-slow`}>
        <path {...drawn('1.8s')} d="M6 40c12-28 24 18 36-6s22-20 42-6" fill="none" stroke="#E86A8C" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {/* Dotted, so it comes in instead of being drawn. */}
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className={`${doodle} right-[13%] top-[330px] animate-float`}>
        <circle className="animate-pop-in opacity-0" style={{ animationDelay: '0.6s' }} cx="28" cy="28" r="20" fill="none" stroke="#6BAF7B" strokeWidth="2.5" strokeDasharray="4 7" />
      </svg>

      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-2 pr-3.5 text-sm text-muted">
        <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-ink">New</span>
        Search inside files, activity, folder colours, and a desktop app
      </p>
      <h1 className="mx-auto mt-7 max-w-[900px] text-balance font-display text-[clamp(44px,6.6vw,84px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
        The file drive you{' '}
        <span className="relative whitespace-nowrap text-brand">
          build into
          <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2.5 left-0 h-[18px] w-full">
            <path {...drawn('0s')} d="M4 14C70 4 160 4 296 10" fill="none" stroke="#F5C443" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>{' '}
        your app.
      </h1>
      <p className="mx-auto mt-7 max-w-[640px] text-[19px] leading-[1.6] text-muted">
        A file manager for the browser, on your own storage. Upload, organise and preview files, with folders, versions and a trash — in packages you take one at a time.
      </p>
      <p className="mt-8 flex flex-wrap justify-center gap-2.5 text-base">
        <a href={GET_STARTED} className={`rounded-xl px-5.5 py-3.5 ${primary}`}>
          Get started
        </a>
        <a href="#demo" className={`px-5.5 py-3.5 ${secondary}`}>
          Try it below
        </a>
      </p>
      <InstallPicker />
    </section>
  );
}

export default async function Home() {
  const samples = await Promise.all(SAMPLES.map(async ([name, lang, code]) => ({ name, html: await highlight(code, lang) })));
  const tests = TESTS.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="home overflow-x-clip text-ink">
      <SiteHeader />
      <main>
        <Hero />

        <ul className="reveal mx-auto flex max-w-[1180px] flex-wrap justify-center gap-2.5 px-6 pb-6 pt-14" aria-label="What it does">
          {TAGS.map((tag, i) => (
            <li key={tag} className={`rounded-full px-3.5 py-[7px] text-sm font-medium transition duration-250 hover:-translate-y-1 hover:shadow-lift ${PASTEL_CLASS[pastelAt(i)]}`}>
              {tag}
            </li>
          ))}
        </ul>

        <section id="demo" className="mx-auto max-w-[1180px] px-6 pb-15 pt-20">
          <div className="reveal mx-auto max-w-[720px] text-center">
            <Pill color="brand">Live demo</Pill>
            <Title>This is the drive. Click around.</Title>
            <p className="mt-4.5 text-lg leading-[1.6] text-muted">
              Open folders, search, upload a few files and watch each go, preview them, open a .docx in Rebodocs, colour a folder, restore an old version, send it to the trash and bring it back.
              Nothing leaves the browser.
            </p>
          </div>
          <div className="reveal relative mt-11 rounded-3xl border border-border bg-surface p-3.5">
            <LiveDemo />
          </div>
          <p className="mt-8 text-center text-[15px] text-muted">
            Claude’s rename goes through the MCP tools of @rebofiles/mcp and Rebodocs, here in the page. Same drive, your own UI →{' '}
            <a href={`${DEMOS}#headless`} className="font-medium text-brand hover:text-brand-hover">
              see it in another look, built with the headless hooks
            </a>
          </p>
        </section>

        <section id="features" className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mx-auto mb-12 max-w-[720px] text-center">
            <Pill color="green">Features</Pill>
            <Title>A drive you can trust with real files.</Title>
          </div>
          <FeatureGrid />
        </section>

        <section id="docs" className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="flex flex-wrap items-center gap-12 rounded-[28px] bg-surface p-[clamp(28px,5vw,64px)]">
            <div className="reveal min-w-0 flex-[1_1_360px]">
              <Pill color="purple">For developers</Pill>
              <Title small>It feels like part of your app — because it is.</Title>
              <p className="mt-4.5 text-[17px] leading-[1.65] text-muted">
                It mounts in your page, uses your fonts and your language, and sends bytes straight to your bucket. Where files live and who can open them stays your app’s business.
              </p>
              <a href={DOCS} className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover">
                Read the guide <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="reveal min-w-0 flex-[1.2_1_480px]">
              <CodeTabs samples={samples} />
            </div>
          </div>
        </section>

        <section id="packages" className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill color="orange">Packages</Pill>
              <Title small>Take what you need.</Title>
            </div>
            <p className="max-w-[380px] text-base leading-[1.6] text-muted">
              The core has no DOM, so the same file model runs in your server, your browser and your desktop.{' '}
              {PUBLISHED ? (
                <a href={NPM_ORG} className="font-medium text-brand hover:text-brand-hover">
                  See them on npm →
                </a>
              ) : (
                'All are written; none is on npm yet.'
              )}
            </p>
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways on a phone, and a keyboard has to reach what is hidden (WCAG 2.1.1) */}
          <section className="reveal overflow-x-auto rounded-2xl border border-border" aria-label="Packages" tabIndex={0}>
            <table className="w-full min-w-[680px] border-collapse text-left text-[15px]">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[49%]" />
                <col />
              </colgroup>
              <thead className="bg-surface text-[13px] font-medium text-muted">
                <tr>
                  <th className="px-4.5 py-[11px] font-medium">Package</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">What it does</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">Runs in</th>
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((pkg) => (
                  <tr key={pkg.name} className="border-t border-border align-top transition-colors hover:bg-surface">
                    <td className="px-4.5 py-3.5">
                      {PUBLISHED && !pkg.comes ? (
                        <a href={npmOf(pkg.name)} className="font-code text-sm font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-current">
                          {pkg.name}
                        </a>
                      ) : (
                        <span className={`font-code text-sm font-medium ${pkg.comes ? 'text-muted' : 'text-ink'}`}>{pkg.name}</span>
                      )}
                      <div className="mt-1 text-xs text-muted">{pkg.comes ? `Coming in ${pkg.comes}` : `v${VERSION}`}</div>
                    </td>
                    <td className="border-l border-border px-4.5 py-3.5 text-ink-soft">{pkg.what}</td>
                    <td className="border-l border-border px-4.5 py-3">
                      <span className={`rounded-md px-[9px] py-[3px] text-[13px] font-medium ${PASTEL_CLASS[pkg.color]}`}>{pkg.tag}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>

        <section id="status" className="mx-auto max-w-[1180px] px-6 pb-25 pt-15">
          <div className="reveal flex flex-wrap items-center gap-10 rounded-[28px] bg-pastel-yellow p-[clamp(28px,5vw,64px)]">
            <div className="min-w-0 flex-[1_1_340px]">
              <span className="rounded-full bg-white px-3 py-[5px] text-[13px] font-semibold text-pastel-yellow-fg">Where it stands</span>
              <p className="mt-4.5 font-display text-[clamp(48px,6vw,76px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                Your files.
                <br />
                Your storage.
              </p>
              <p className="mt-3 font-hand text-[26px] font-semibold text-pastel-yellow-fg">the bytes never pass through anyone else</p>
            </div>
            <div className="min-w-0 flex-[1_1_380px]">
              <p className="font-display text-[clamp(24px,2.6vw,32px)] font-bold leading-[1.3] tracking-[-0.03em]">Early, open, and built on Rebodocs.</p>
              <p className="mt-4 text-[17px] leading-[1.6] text-[#5c4a1e]">
                A file manager with its own file model that keeps your files where you put them, previews Word documents with the Rebodocs engine and opens every .docx in its editor. {tests} automated
                tests pass; {PUBLISHED ? `the packages are on npm at ${VERSION}` : 'nothing is on npm yet'}. Open source under MIT.
              </p>
              <p className="mt-6.5 flex flex-wrap gap-2.5">
                <a href={GET_STARTED} className={`rounded-xl px-5 py-[13px] ${primary}`}>
                  Get started
                </a>
                <a href={STATUS} className="rounded-xl bg-white px-5 py-[13px] font-semibold text-ink transition-colors hover:bg-hover">
                  What’s checked, what’s missing →
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
