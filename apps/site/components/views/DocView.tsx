import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OnThisPage } from '@/components/docs/frame/OnThisPage';
import { PageFooter } from '@/components/docs/frame/PageFooter';
import { PageIndex } from '@/components/docs/frame/PageIndex';
import { docPageOf, headingsOf } from '@/components/docs/registry';
import { SectionHead } from '@/components/docs/ui';
import { type Locale, dict, localePath } from '@/lib/i18n';
import { JsonLd, docLd, pageMeta } from '@/lib/seo';
import { PAGES, REPO, hrefOf, markdownOf, navOf } from '@/lib/site';

export const slugOf = (slug?: string[]) => (slug?.length ? slug.join('/') : 'index');
export const docParams = () => PAGES.map((page) => ({ slug: page.slug === 'index' ? [] : [page.slug] }));

export function docMeta(locale: Locale, slug: string): Metadata {
  const page = docPageOf(locale, slug);
  if (!page) return {};
  // The Markdown made for a language model is of the English page.
  return pageMeta({ title: page.title, description: page.description, path: hrefOf(slug), locale, type: 'article', markdown: localePath(locale, markdownOf(slug)) });
}

export function DocView({ locale, slug }: { locale: Locale; slug: string }) {
  const pages = navOf(locale).flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })));
  const at = pages.findIndex((page) => page.slug === slug);
  const page = docPageOf(locale, slug);
  if (at < 0 || !page) notFound();
  const headings = headingsOf(page);

  return (
    <div className="flex gap-12">
      <main id="top" className="min-w-0 flex-1 pb-24 pt-9">
        <JsonLd data={docLd({ title: page.title, description: page.description, path: hrefOf(slug), group: pages[at].group, locale, docs: dict(locale).docs.docs })} />
        <p className="m-0 text-[13px] text-muted">
          {pages[at].group} <span aria-hidden="true">/</span> <span className="text-ink">{pages[at].title}</span>
        </p>
        <h1 className="mb-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{page.title}</h1>
        <div className="mt-4 max-w-[760px] text-[18px] leading-[1.6] text-muted [&_a]:font-medium [&_a]:text-brand [&_a:hover]:text-brand-hover">{page.lead}</div>
        {page.tip && <p className="m-0 mt-5 font-hand text-[22px] leading-[1.1] text-pastel-pink-fg">{page.tip}</p>}
        <PageIndex headings={headings} label={dict(locale).docs.onThisPage} />
        {page.sections.map((section) => (
          <section key={section.id} className="mt-16 [&_a]:font-medium [&_a]:text-brand [&_a:hover]:text-brand-hover">
            <SectionHead id={section.id} badge={section.badge} color={section.color} title={section.title}>
              {section.lead}
            </SectionHead>
            {section.body}
          </section>
        ))}
        <PageFooter previous={pages[at - 1]} next={pages[at + 1]} edit={`${REPO}/edit/main/${page.source}`} />
      </main>
      <OnThisPage headings={headings} />
    </div>
  );
}
