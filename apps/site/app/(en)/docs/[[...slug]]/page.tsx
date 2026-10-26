import type { Metadata } from 'next';
import { DocView, docMeta, docParams, slugOf } from '@/components/views/DocView';

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;
export const generateStaticParams = docParams;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return docMeta('en', slugOf((await params).slug));
}

export default async function DocPage({ params }: Props) {
  return <DocView locale="en" slug={slugOf((await params).slug)} />;
}
