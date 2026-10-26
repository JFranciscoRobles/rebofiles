import type { Metadata, Viewport } from 'next';
import { Caveat, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { type Locale, LOCALE_INFO, dict } from '@/lib/i18n';
import { OG_IMAGE, SITE_NAME } from '@/lib/seo';
import { SITE } from '@/lib/site';
import '../app/globals.css';

// The fonts of the suite, as CSS variables: `globals.css` turns them into
// `font-display`, `font-text`, `font-code` and `font-hand`. Chinese is drawn
// in the system's own font after them, as each falls back.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' });
const caveat = Caveat({ subsets: ['latin'], weight: '600', variable: '--font-caveat' });

/** What every page in a language says unless it says otherwise. */
export function rootMetadata(locale: Locale): Metadata {
  const d = dict(locale);
  return {
    metadataBase: new URL(SITE),
    title: { default: d.home.title, template: `%s · ${SITE_NAME}` },
    description: d.home.description,
    icons: { icon: '/logo.svg' },
    openGraph: { type: 'website', siteName: SITE_NAME, url: SITE, locale: LOCALE_INFO[locale].og, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', images: [OG_IMAGE.url] },
    robots: { index: true, follow: true },
    applicationName: SITE_NAME,
    keywords: ['file manager', 'file drive', 'React file manager', 'S3 file browser', 'headless', 'uploads', 'open source'],
  };
}
export const viewport: Viewport = { themeColor: '#0e7c52' };

/** The page itself, in its language: each language has a root of its own, so that each says its own `lang`. */
export function RootHtml({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={LOCALE_INFO[locale].html} className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
