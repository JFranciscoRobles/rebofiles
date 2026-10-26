import type { ReactNode } from 'react';
import { DocsSidebar } from '@/components/docs/frame/DocsSidebar';
import { DocsTopBar } from '@/components/docs/frame/DocsTopBar';
import { searchIndex } from '@/components/docs/searchIndex';
import type { Locale } from '@/lib/i18n';

// The frame of every page of the documentation: the bar, the pages beside it,
// and the page itself, which brings its own "On this page".
export function DocsShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="home min-h-screen bg-white text-ink">
      <DocsTopBar index={searchIndex(locale)} />
      <div className="mx-auto flex max-w-[1400px] gap-x-12 px-4 sm:px-6">
        <DocsSidebar />
        <div className="min-w-0 flex-[999_1_600px]">{children}</div>
      </div>
    </div>
  );
}
