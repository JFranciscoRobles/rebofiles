import type { Metadata } from 'next';
import { DocView, docMeta, docParams, slugOf } from '@/components/views/DocView';
import { type Locale, PREFIXED } from '@/lib/i18n';

type Props = { params: Promise<{ locale: string; slug?: string[] }> };

export const dynamicParams = false;
export const generateStaticParams = () => PREFIXED.flatMap((locale) => docParams().map((params) => ({ locale, ...params })));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return docMeta(locale as Locale, slugOf(slug));
}

export default async function DocPage({ params }: Props) {
  const { locale, slug } = await params;
  return <DocView locale={locale as Locale} slug={slugOf(slug)} />;
}
