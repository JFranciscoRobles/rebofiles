import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { RootHtml, rootMetadata } from '@/components/RootHtml';
import { PREFIXED, isLocale } from '@/lib/i18n';

export { viewport } from '@/components/RootHtml';

type Props = { params: Promise<{ locale: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => PREFIXED.map((locale) => ({ locale }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? rootMetadata(locale) : {};
}

/** Spanish and Mandarin, each under its own prefix. */
export default async function LocaleLayout({ children, params }: Props & { children: ReactNode }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === 'en') notFound();
  return <RootHtml locale={locale}>{children}</RootHtml>;
}
