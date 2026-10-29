import Link from 'next/link';
import { VERSION } from '@/lib/home';
import { type Locale, dict, localePath } from '@/lib/i18n';
import { DEMOS, DOCS, GET_STARTED, NPM_ORG, REBODOCS, REPO, STATUS } from '@/lib/site';
import { LanguageSwitcher } from '../LanguageSwitcher';

const ghost = 'rounded-lg px-3 py-2 text-ink transition-colors hover:bg-hover';
export const primary = 'bg-brand font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(194, 65, 12,0.22)]';

/** Rebodocs' tile with a folder in place of a page. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#FCEBDD" />
      <path
        d="M9 11.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.8 2h5.6a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 20Z"
        fill="none"
        stroke="#C2410C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The header of the landing page. Its links go down to a second line on a narrow screen. */
export function SiteHeader({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const to = (path: string) => localePath(locale, path);
  return (
    <header className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4.5">
      <Link href={to('/')} className="flex items-center gap-2.5 text-ink">
        <Logo />
        <span className="font-display text-xl font-extrabold tracking-[-0.03em]">ReboFiles</span>
      </Link>
      <span className="rounded-full bg-pastel-green px-2.5 py-1 text-xs font-medium text-pastel-green-fg">
        {d.badge} · v{VERSION}
      </span>
      <nav aria-label="Main" className="ml-auto flex flex-wrap items-center gap-0.5 text-[15px] font-medium">
        <a href={to(DEMOS)} className={ghost}>
          {d.nav.demo}
        </a>
        <a href={to(DOCS)} className={ghost}>
          {d.nav.docs}
        </a>
        <a href={to(STATUS)} className={ghost}>
          {d.nav.status}
        </a>
        <a href={NPM_ORG} className={ghost}>
          npm
        </a>
        <a href={REPO} className={ghost}>
          GitHub
        </a>
        <LanguageSwitcher className="ml-1.5" />
        <a href={to(GET_STARTED)} className={`ml-2 rounded-[10px] px-4 py-2.5 ${primary}`}>
          {d.nav.getStarted}
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const to = (path: string) => localePath(locale, path);
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-6 pb-10 pt-8 text-sm text-muted">
        <span className="font-display text-base font-extrabold tracking-[-0.03em] text-ink">ReboFiles</span>
        <a href={to(DEMOS)} className="hover:text-ink">
          {d.nav.demo}
        </a>
        <a href={to(DOCS)} className="hover:text-ink">
          {d.nav.docs}
        </a>
        <a href={to(STATUS)} className="hover:text-ink">
          {d.footer.statusRoadmap}
        </a>
        <a href={NPM_ORG} className="hover:text-ink">
          npm
        </a>
        <a href={REPO} className="hover:text-ink">
          GitHub
        </a>
        <a href={localePath(locale, '/llms.txt')} className="hover:text-ink" title={d.footer.llms}>
          llms.txt
        </a>
        <span className="flex flex-col gap-1 sm:ml-auto sm:items-end">
          <span>
            {d.footer.suite}{' '}
            <a href={REBODOCS} className="font-medium text-docs hover:text-docs-hover">
              Rebodocs
            </a>{' '}
            · <span className="font-medium text-brand">ReboFiles</span>
          </span>
          <span>{d.footer.license}</span>
        </span>
      </div>
    </footer>
  );
}
