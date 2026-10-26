// What a page of the documentation is made of: the header and footer of the
// landing, a column to read in, and beside it on a wide screen what is on the
// page. The code is coloured when the site is built, as on the landing.

import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/home/SiteChrome';
import { highlight } from '@/lib/highlight';

export function DocsPage({ eyebrow, title, intro, contents, children }: { eyebrow: string; title: string; intro: ReactNode; contents: [string, string][]; children: ReactNode }) {
  return (
    <div className="home overflow-x-clip text-ink">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1180px] gap-14 px-6 pb-24 pt-12">
        <aside className="hidden w-[200px] shrink-0 lg:block">
          <nav aria-label="On this page" className="sticky top-8 text-sm">
            <p className="mb-3 font-semibold text-ink">On this page</p>
            <ul className="space-y-2 border-l border-border">
              {contents.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent pl-3.5 text-muted transition-colors hover:border-brand hover:text-ink">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="min-w-0 max-w-[760px] flex-1">
          <span className="rounded-full bg-brand-light px-3 py-[5px] text-[13px] font-semibold text-brand">{eyebrow}</span>
          <h1 className="mt-4.5 font-display text-[clamp(36px,5vw,52px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{title}</h1>
          <div className="mt-4.5 text-lg leading-[1.6] text-muted">{intro}</div>
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-14">
      <h2 className="font-display text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 space-y-4 text-[16.5px] leading-[1.7] text-ink-soft [&_a]:font-medium [&_a]:text-brand [&_a:hover]:text-brand-hover">{children}</div>
    </section>
  );
}

/** Code in a sentence. */
export const C = ({ children }: { children: ReactNode }) => <code className="rounded-md bg-hover px-1.5 py-0.5 font-code text-[0.88em] text-ink">{children}</code>;

/** A block of code, with the file it goes in when it goes in one. */
export async function Code({ code, lang = 'ts', file }: { code: string; lang?: string; file?: string }) {
  const html = await highlight(code, lang);
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-white">
      {file && <div className="border-b border-[#f0eee9] px-4.5 py-2.5 font-code text-[13px] text-muted">{file}</div>}
      <div
        className="[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:bg-white! [&_pre]:px-4.5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[14px] [&_pre]:leading-[1.7]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/** Something that goes wrong, and what to do about it. */
export function Trouble({ says, children }: { says: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border p-4.5">
      <p className="font-code text-[14px] text-ink">{says}</p>
      <p className="mt-2 text-[15.5px] leading-[1.65] text-ink-soft">{children}</p>
    </div>
  );
}
