import type { Metadata, Viewport } from 'next';
import { Caveat, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE } from '@/lib/site';
import './globals.css';

// The fonts of the suite, as CSS variables: `globals.css` turns them into
// `font-display`, `font-text`, `font-code` and `font-hand`.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' });
const caveat = Caveat({ subsets: ['latin'], weight: '600', variable: '--font-caveat' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'ReboFiles: the file drive you build into your app', template: '%s · ReboFiles' },
  description:
    'A file manager for the browser, on your own storage: folders, uploads, previews, versions and a trash, with Word documents opened in Rebodocs. Open source, built to live inside your application.',
  icons: { icon: '/logo.svg' },
  openGraph: { type: 'website', siteName: 'ReboFiles', url: SITE },
};
export const viewport: Viewport = { themeColor: '#0e7c52' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
