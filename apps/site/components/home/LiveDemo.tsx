'use client';

// The drive of apps/demo, on the page: the same component an application
// installs, kept in the browser. Loaded in the browser only, as it makes its
// files there.

import dynamic from 'next/dynamic';
import type { Locale } from '@/lib/i18n';

const DemoDrive = dynamic(() => import('../../../demo/src/DemoDrive').then((m) => m.DemoDrive), {
  ssr: false,
  loading: () => <div className="h-full rounded-[14px] border border-border bg-white" />,
});

export function LiveDemo({ locale }: { locale: Locale }) {
  // Scrolls sideways only where the window is narrower than the drive, so Claude's card may hang over the frame elsewhere.
  return (
    <div className="max-lg:overflow-x-auto">
      <div className="h-[600px] min-w-[980px]">
        <DemoDrive language={locale} />
      </div>
    </div>
  );
}
