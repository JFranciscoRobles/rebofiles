import type { ReactNode } from 'react';
import { DocsShell } from '@/components/views/DocsShell';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell locale="en">{children}</DocsShell>;
}
