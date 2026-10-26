'use client';

// The demos of the drive, as Rebodocs has its own: the whole window, a bar
// with a tab for each, and the drive under it. Both are Acme's files kept in
// the page; neither is drawn on the server, as they make their files in the
// browser.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo, primary } from '@/components/home/SiteChrome';
import { type Locale, dict, localePath } from '@/lib/i18n';
import { GET_STARTED, hrefOf } from '@/lib/site';
import { LanguageSwitcher } from '../LanguageSwitcher';

// Said in no language: the drive comes in the page's own a moment later.
const loading = () => <div className="h-full rounded-[14px] border border-border bg-white" />;
const DemoDrive = dynamic(() => import('../../../demo/src/DemoDrive').then((m) => m.DemoDrive), { ssr: false, loading });
const StudioDrive = dynamic(() => import('./StudioDrive').then((m) => m.StudioDrive), { ssr: false, loading });

/** The tabs, in order, each with its dot; what each says is in lib/i18n.ts. */
const TABS = [
  { id: 'included', dot: 'bg-brand' },
  { id: 'compact', dot: 'bg-pastel-pink-fg' },
  { id: 'headless', dot: 'bg-pastel-blue-fg' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DemoApp({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const to = (path: string) => localePath(locale, path);
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
  const current = d.demo.tabs[tab];

  return (
    <div className="flex h-dvh min-h-[600px] flex-col bg-surface text-ink">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-white px-3 py-2 sm:px-4">
        <h1 className="sr-only">{d.demo.h1}</h1>
        <Link href={to('/')} title={d.demo.back} className="flex items-center gap-2 rounded-lg py-1 pr-1 font-display text-[17px] font-bold tracking-tight text-ink">
          <Logo size={26} />
          <span className="hidden sm:inline">ReboFiles</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 font-text text-xs font-semibold text-ink-soft">{d.nav.demo}</span>
        </Link>

        {/* The tabs, as a segmented control: the arrows move between them. */}
        <div
          role="tablist"
          aria-label={d.demo.which}
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
          {TABS.map(({ id, dot }) => (
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
              <span className="sm:hidden">{d.demo.tabs[id].short}</span>
              <span className="hidden sm:inline">{d.demo.tabs[id].label}</span>
            </button>
          ))}
        </div>

        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted lg:block">{current.note}</p>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher className="hidden md:flex" />
          <Link href={to(hrefOf('hooks'))} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-hover hover:text-ink md:block">
            {d.nav.docs}
          </Link>
          <Link href={to(GET_STARTED)} className={`flex min-h-9 items-center rounded-lg px-3.5 text-sm pointer-coarse:min-h-11 ${primary}`}>
            {d.nav.getStarted}
          </Link>
        </div>
      </header>
      {/* Wider than a phone: it scrolls sideways there, rather than squeezing the drive. */}
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="min-h-0 flex-1 overflow-x-auto p-3 pb-8 sm:p-4 sm:pb-8">
        <div className={`h-full ${tab === 'headless' ? 'min-w-[1020px]' : 'min-w-[860px]'}`}>
          {tab === 'headless' ? <StudioDrive language={locale} /> : <DemoDrive key={tab} language={locale} layout={tab === 'compact' ? 'compact' : 'full'} />}
        </div>
      </div>
    </div>
  );
}
