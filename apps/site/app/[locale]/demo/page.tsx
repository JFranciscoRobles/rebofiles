import type { Metadata } from 'next';
import { DemoView, demoMeta } from '@/components/views/DemoView';
import { type Locale, PREFIXED } from '@/lib/i18n';

type Props = { params: Promise<{ locale: string }> };

export const generateStaticParams = () => PREFIXED.map((locale) => ({ locale }));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return demoMeta((await params).locale as Locale);
}

export default async function Demo({ params }: Props) {
  return <DemoView locale={(await params).locale as Locale} />;
}
