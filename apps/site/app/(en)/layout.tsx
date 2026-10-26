import type { ReactNode } from 'react';
import { RootHtml, rootMetadata } from '@/components/RootHtml';

export { viewport } from '@/components/RootHtml';
export const metadata = rootMetadata('en');

/** English, at the addresses the site has always had. */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootHtml locale="en">{children}</RootHtml>;
}
