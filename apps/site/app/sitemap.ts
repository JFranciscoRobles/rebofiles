import type { MetadataRoute } from 'next';
import { LOCALES, LOCALE_INFO, localePath } from '@/lib/i18n';
import { DEMOS, PAGES, SITE, hrefOf } from '@/lib/site';

export const dynamic = 'force-static';

/** Every page there is to find, in each language, each saying where it is in the others. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: 'weekly' | 'monthly'; priority: number }[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: DEMOS, changeFrequency: 'monthly', priority: 0.8 },
    ...PAGES.map((page) => ({ path: hrefOf(page.slug), changeFrequency: 'weekly' as const, priority: page.slug === 'index' || page.slug === 'getting-started' ? 0.9 : 0.7 })),
  ];
  const languages = (path: string) => Object.fromEntries(LOCALES.map((locale) => [LOCALE_INFO[locale].hreflang, `${SITE}${localePath(locale, path)}`]));
  return pages.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map((locale) => ({ url: `${SITE}${localePath(locale, path)}`, changeFrequency, priority: locale === 'en' ? priority : priority - 0.1, alternates: { languages: languages(path) } })),
  );
}
