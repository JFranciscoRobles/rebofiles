import type { ReactNode } from 'react';
import { DocsShell } from '@/components/views/DocsShell';
import type { Locale } from '@/lib/i18n';

export default async function DocsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  return <DocsShell locale={(await params).locale as Locale}>{children}</DocsShell>;
}
