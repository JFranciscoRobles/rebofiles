'use client';

import { LOCALES, LOCALE_INFO, localePath } from '@/lib/i18n';
import { useLocale } from './useLocale';

/** The same page in each language, the one shown marked; each name in its own language and script. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, path, d } = useLocale();
  return (
    <nav aria-label={d.nav.language} className={`flex items-center gap-0.5 rounded-lg bg-surface p-0.5 text-[13px] font-semibold ${className}`}>
      {LOCALES.map((one) => (
        <a
          key={one}
          href={localePath(one, path)}
          hrefLang={LOCALE_INFO[one].hreflang}
          lang={LOCALE_INFO[one].html}
          aria-current={one === locale ? 'true' : undefined}
          className={`rounded-md px-2 py-1 transition-colors ${one === locale ? 'bg-white text-ink shadow-[0_1px_2px_rgba(47,46,43,0.12)]' : 'text-muted hover:text-ink'}`}
        >
          {LOCALE_INFO[one].name}
        </a>
      ))}
    </nav>
  );
}
