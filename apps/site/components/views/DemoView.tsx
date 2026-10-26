import type { Metadata } from 'next';
import { DemoApp } from '@/components/demos/DemoApp';
import { type Locale, dict } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { DEMOS } from '@/lib/site';

export const demoMeta = (locale: Locale): Metadata => pageMeta({ title: dict(locale).demo.title, description: dict(locale).demo.description, path: DEMOS, locale });

export function DemoView({ locale }: { locale: Locale }) {
  return (
    <main>
      <DemoApp locale={locale} />
    </main>
  );
}
