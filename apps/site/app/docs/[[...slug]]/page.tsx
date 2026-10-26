import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OnThisPage } from '@/components/docs/frame/OnThisPage';
import { PageFooter } from '@/components/docs/frame/PageFooter';
import { PageIndex } from '@/components/docs/frame/PageIndex';
import { DOC_PAGES, headingsOf } from '@/components/docs/registry';
import { SectionHead } from '@/components/docs/ui';
import { PAGES, REPO, groupOf, hrefOf } from '@/lib/site';

type Props = { params: Promise<{ slug?: string[] }> };
const slugOf = (slug?: string[]) => (slug?.length ? slug.join('/') : 'index');

export const dynamicParams = false;
export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug === 'index' ? [] : [page.slug] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = DOC_PAGES[slugOf((await params).slug)];
  if (!page) return {};
  return { title: page.title, description: page.description, alternates: { canonical: hrefOf(slugOf((await params).slug)) } };
}

export default async function DocPage({ params }: Props) {
  const slug = slugOf((await params).slug);
  const at = PAGES.findIndex((page) => page.slug === slug);
  const page = DOC_PAGES[slug];
  if (at < 0 || !page) notFound();
  const headings = headingsOf(page);

  return (
    <div className="flex gap-12">
      <main id="top" className="min-w-0 flex-1 pb-24 pt-9">
        <p className="m-0 text-[13px] text-muted">
          {groupOf(slug)?.title} <span aria-hidden="true">/</span> <span className="text-ink">{PAGES[at].title}</span>
        </p>
        <h1 className="mb-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{page.title}</h1>
        <div className="mt-4 max-w-[760px] text-[18px] leading-[1.6] text-muted [&_a]:font-medium [&_a]:text-brand [&_a:hover]:text-brand-hover">{page.lead}</div>
        {page.tip && <p className="m-0 mt-5 font-hand text-[22px] leading-[1.1] text-pastel-pink-fg">{page.tip}</p>}
        <PageIndex headings={headings} />
        {page.sections.map((section) => (
          <section key={section.id} className="mt-16 [&_a]:font-medium [&_a]:text-brand [&_a:hover]:text-brand-hover">
            <SectionHead id={section.id} badge={section.badge} color={section.color} title={section.title}>
              {section.lead}
            </SectionHead>
            {section.body}
          </section>
        ))}
        <PageFooter previous={PAGES[at - 1]} next={PAGES[at + 1]} edit={`${REPO}/edit/main/${page.source}`} />
      </main>
      <OnThisPage headings={headings} />
    </div>
  );
}
