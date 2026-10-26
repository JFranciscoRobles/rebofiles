'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NavItem } from '@/lib/site';
import { docHref } from '@/lib/site';
import { useLocale } from '../../useLocale';

/** The end of every page: the pages before and after it, a question, and where to fix it. */
export function PageFooter({ previous, next, edit }: { previous?: NavItem; next?: NavItem; edit: string }) {
  const { locale, d } = useLocale();
  const [helpful, setHelpful] = useState<boolean>();
  const card = 'lift rounded-[14px] border border-border px-4.5 py-4 text-ink';

  return (
    <footer className="mt-14">
      <nav aria-label={d.docs.pages} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        {previous ? (
          <Link href={docHref(locale, previous.slug)} className={card}>
            <span className="text-[13px] text-muted">{d.docs.previous}</span>
            <span className="mt-1 block font-display text-[17px] font-bold">{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={docHref(locale, next.slug)} className={`${card} text-right`}>
            <span className="text-[13px] text-muted">{d.docs.next}</span>
            <span className="mt-1 block font-display text-[17px] font-bold">{next.title}</span>
          </Link>
        )}
      </nav>
      <div className="mt-7 flex flex-wrap items-center gap-2.5 text-sm text-muted">
        <span aria-live="polite">{helpful === undefined ? d.docs.helpful : helpful ? d.docs.thanksYes : d.docs.thanksNo}</span>
        {helpful === undefined &&
          (
            [
              [d.docs.yes, true],
              [d.docs.notReally, false],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => setHelpful(value)}
              className="cursor-pointer rounded-full border border-border-strong bg-white px-3.5 py-1.5 text-sm text-ink transition-colors hover:bg-hover"
            >
              {label}
            </button>
          ))}
        <a href={edit} className="ml-auto font-medium text-brand hover:text-brand-hover">
          {d.docs.edit}
        </a>
      </div>
    </footer>
  );
}
