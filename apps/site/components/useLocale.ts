'use client';

import { usePathname } from 'next/navigation';
import { type Locale, dict, splitPath } from '@/lib/i18n';

/** The language of the page a client component is in, from its address, and what it says in it. */
export function useLocale(): { locale: Locale; path: string; d: ReturnType<typeof dict> } {
  const { locale, path } = splitPath(usePathname() ?? '/');
  return { locale, path, d: dict(locale) };
}
