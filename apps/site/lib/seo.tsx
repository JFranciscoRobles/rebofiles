// What a search engine and a page that links here are told of each page: its
// title and description, its one address, the card a link shows, and what it
// is in schema.org's words.

import type { Metadata } from 'next';
import { type Locale, LOCALE_INFO, alternatesOf, localePath } from './i18n';
import { REPO, SITE } from './site';

export const SITE_NAME = 'ReboFiles';
/** The picture a link to any page shows: made at build by app/og.png. */
export const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'ReboFiles: the file drive you build into your app' };

/**
 * The metadata of a page at `path` (its English address) in a language: canonical, the same page in the other
 * languages, Open Graph and the card of a link, all saying the same.
 */
export function pageMeta({
  title,
  description,
  path,
  locale = 'en',
  type = 'website',
  markdown,
}: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
  type?: 'website' | 'article';
  markdown?: string;
}): Metadata {
  const here = localePath(locale, path);
  // Away from the site, a card says whose it is.
  const card = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: here, languages: alternatesOf(path), ...(markdown ? { types: { 'text/markdown': markdown } } : {}) },
    openGraph: {
      type,
      siteName: SITE_NAME,
      url: here,
      title: card,
      description,
      locale: LOCALE_INFO[locale].og,
      alternateLocale: Object.values(LOCALE_INFO)
        .map((info) => info.og)
        .filter((og) => og !== LOCALE_INFO[locale].og),
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: card, description, images: [OG_IMAGE.url] },
  };
}

/** A page of the documentation, in schema.org's words: an article of the site, and the way down to it. */
export function docLd({ title, description, path, group, locale = 'en', docs = 'Docs' }: { title: string; description: string; path: string; group?: string; locale?: Locale; docs?: string }) {
  const url = `${SITE}${localePath(locale, path)}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: title,
      description,
      url,
      inLanguage: LOCALE_INFO[locale].html,
      image: `${SITE}${OG_IMAGE.url}`,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE },
      about: { '@type': 'SoftwareSourceCode', name: SITE_NAME, codeRepository: REPO, programmingLanguage: 'TypeScript' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: docs, item: `${SITE}${localePath(locale, '/docs/')}` },
        ...(group && path !== '/docs/' ? [{ '@type': 'ListItem', position: 2, name: group }] : []),
        ...(path !== '/docs/' ? [{ '@type': 'ListItem', position: group ? 3 : 2, name: title, item: url }] : []),
      ],
    },
  ];
}

/** ReboFiles itself, for the landing: what it is, where its code is, what it costs. */
export const SOFTWARE_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  url: SITE,
  description: 'A file drive for the browser, built into your application, on your own storage: folders, uploads, previews, versions, the trash and sharing, in packages you take one at a time.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any (browser, Node.js 22.12+)',
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  codeRepository: REPO,
  image: `${SITE}${OG_IMAGE.url}`,
};

/** What schema.org is told, in the page: escaped so that no text in it closes the script. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
