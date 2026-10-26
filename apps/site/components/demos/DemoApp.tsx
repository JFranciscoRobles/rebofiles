'use client';

// The demos of the drive, as Rebodocs has its own: the whole window, a bar
// with a tab for each, and the drive under it. Both are Acme's files kept in
// the page; neither is drawn on the server, as they make their files in the
// browser.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo, primary } from '@/components/home/SiteChrome';
import { GET_STARTED } from '@/lib/site';

const loading = () => <p className="grid h-full place-items-center text-sm text-muted">Opening the drive…</p>;
const DemoDrive = dynamic(() => import('../../../demo/src/DemoDrive').then((m) => m.DemoDrive), { ssr: false, loading });
const StudioDrive = dynamic(() => import('./StudioDrive').then((m) => m.StudioDrive), { ssr: false, loading });

const TABS = [
  {
    id: 'included',
    label: 'The included one',
    short: 'Included',
    note: '<FileDrive> as it comes: Word documents opened in Rebodocs, and Claude at work through MCP a few seconds in.',
    dot: 'bg-brand',
  },
  {
    id: 'compact',
    label: 'Compact',
    short: 'Compact',
    note: '<FileDrive layout="compact">: no column on the left; New and the places in a strip over the list.',
    dot: 'bg-pastel-pink-fg',
  },
  {
    id: 'headless',
    label: 'Your own interface',
    short: 'Your own',
    note: 'A creative suite’s look, built on the hooks: DriveProvider, useEntries, useEntry, useActions, useUploads…',
    dot: 'bg-pastel-blue-fg',
  },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DemoApp() {
  const [tab, setTab] = useState<Tab>('included');
  useEffect(() => {
    const asked = TABS.find((t) => `#${t.id}` === window.location.hash);
    if (asked) setTab(asked.id);
  }, []);
  const choose = (next: Tab) => {
    setTab(next);
    // The address says which one is shown, to send it to someone.
    history.replaceState(null, '', next === 'included' ? window.location.pathname : `#${next}`);
  };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="flex h-dvh min-h-[600px] flex-col bg-surface text-ink">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-white px-3 py-2 sm:px-4">
        <h1 className="sr-only">The demo of ReboFiles</h1>
        <Link href="/" title="Back to the site" className="flex items-center gap-2 rounded-lg py-1 pr-1 font-display text-[17px] font-bold tracking-tight text-ink">
          <Logo size={26} />
          <span className="hidden sm:inline">ReboFiles</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 font-text text-xs font-semibold text-ink-soft">Demo</span>
        </Link>

        {/* The tabs, as a segmented control: the arrows move between them. */}
        <div
          role="tablist"
          aria-label="Which interface"
          className="order-3 flex w-full rounded-xl bg-surface p-1 sm:order-none sm:w-auto"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
            const next = TABS[(TABS.findIndex((t) => t.id === tab) + step) % TABS.length].id;
            choose(next);
            document.getElementById(`demo-tab-${next}`)?.focus();
          }}
        >
          {TABS.map(({ id, label, short, dot }) => (
            <button
              key={id}
              id={`demo-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="demo-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => choose(id)}
              className={`flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors pointer-coarse:min-h-11 sm:flex-none ${
                tab === id ? 'bg-white text-ink shadow-[0_1px_3px_rgba(47,46,43,0.14)]' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${tab === id ? dot : 'bg-border-strong'}`} />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted lg:block">{current.note}</p>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/docs/hooks/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-hover hover:text-ink md:block">
            Docs
          </Link>
          <Link href={GET_STARTED} className={`flex min-h-9 items-center rounded-lg px-3.5 text-sm pointer-coarse:min-h-11 ${primary}`}>
            Get started
          </Link>
        </div>
      </header>
      {/* Wider than a phone: it scrolls sideways there, rather than squeezing the drive. */}
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="min-h-0 flex-1 overflow-x-auto p-3 pb-8 sm:p-4 sm:pb-8">
        <div className={`h-full ${tab === 'headless' ? 'min-w-[1020px]' : 'min-w-[860px]'}`}>
          {tab === 'headless' ? <StudioDrive /> : <DemoDrive key={tab} layout={tab === 'compact' ? 'compact' : 'full'} />}
        </div>
      </div>
    </div>
  );
}
