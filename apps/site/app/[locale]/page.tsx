import type { Metadata } from 'next';
import { HomeView, homeMeta } from '@/components/views/HomeView';
import { type Locale, PREFIXED } from '@/lib/i18n';

type Props = { params: Promise<{ locale: string }> };

export const generateStaticParams = () => PREFIXED.map((locale) => ({ locale }));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return homeMeta((await params).locale as Locale);
}

export default async function Home({ params }: Props) {
  return <HomeView locale={(await params).locale as Locale} />;
}
