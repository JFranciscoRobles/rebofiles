// What the pages of the documentation are made of: a page as its title, its
// lead and its sections, each section starting with a pill and a heading as
// Rebodocs' do; code coloured when the site is built; the yellow warning; the
// hand-written tip; and tables of reference.

import type { ReactNode } from 'react';
import { PASTEL_CLASS, type Pastel } from '@/lib/home';
import { highlight } from '@/lib/highlight';

export interface DocSection {
  id: string;
  /** Its heading, and what "On this page" and ⌘K call it. */
  title: string;
  /** The pill above the heading. */
  badge: string;
  color: Pastel;
  /** A line under the heading, in the grey of a lead. */
  lead?: ReactNode;
  body: ReactNode;
}

export interface DocPage {
  title: string;
  /** For search engines and the line under the title. */
  description: string;
  /** Under the title, before what is on the page. */
  lead: ReactNode;
  /** A line in the hand of the suite, under the lead. */
  tip?: string;
  sections: DocSection[];
  /** The file to edit, from the root of the repository. */
  source: string;
}

/** Code in a sentence. */
export const C = ({ children }: { children: ReactNode }) => <code className="rounded-md bg-hover px-1.5 py-0.5 font-code text-[0.88em] text-ink">{children}</code>;

/** A paragraph of a section. */
export const P = ({ children }: { children: ReactNode }) => <p className="m-0 mt-4 max-w-[760px] text-[16.5px] leading-[1.7] text-ink-soft">{children}</p>;

/** A list of a section. */
export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="m-0 mt-4 max-w-[760px] list-disc space-y-2 pl-5 text-[16.5px] leading-[1.65] text-ink-soft">
    {items.map((item, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: the items of one fixed list, never reordered.
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** A block of code on the warm grey of the page, with the file it goes in when it goes in one. */
export async function Code({ code, lang = 'ts', file }: { code: string; lang?: string; file?: string }) {
  const html = await highlight(code, lang);
  return (
    <div className="mt-5 max-w-[920px] overflow-hidden rounded-[12px] border border-border bg-surface" data-lang={lang}>
      {file && <div className="border-b border-border px-5 py-2.5 font-code text-[12.5px] text-muted">{file}</div>}
      <div
        className="[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:bg-surface! [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[13.5px] [&_pre]:leading-[1.7]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/** Something that goes wrong if it is not known. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p className="m-0 mt-6 flex max-w-[920px] items-start gap-3 rounded-xl bg-pastel-yellow px-5 py-4 text-[15px] leading-[1.55] text-[#5c4a1e]">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 flex-none">
        <circle cx="10" cy="10" r="8" fill="none" stroke="#8A5A00" strokeWidth="1.6" />
        <path d="M10 6v5M10 13.5v.5" stroke="#8A5A00" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <strong className="text-[#3e2f00]">{title}</strong> {children}
      </span>
    </p>
  );
}

/** Something that goes wrong, said as the drive says it, and what to do about it. */
export function Trouble({ says, children }: { says: string; children: ReactNode }) {
  return (
    <div className="mt-3 max-w-[920px] rounded-[14px] border border-border p-4.5">
      <p className="m-0 font-code text-[14px] text-ink">{says}</p>
      <p className="m-0 mt-2 text-[15.5px] leading-[1.65] text-ink-soft">{children}</p>
    </div>
  );
}

/** A table of reference: the first column in code, the others as text. */
export function Table({ label, columns, rows, code = [0] }: { label: string; columns: string[]; rows: ReactNode[][]; code?: number[] }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways on a phone, and a keyboard has to reach what is hidden (WCAG 2.1.1)
    <section className="mt-5 max-w-[920px] overflow-x-auto rounded-[14px] border border-border" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
        <thead className="bg-surface text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4.5 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the rows of one fixed table, never reordered.
            <tr key={r} className="border-t border-border align-top">
              {row.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the cells of one row.
                <td key={c} className={`px-4.5 py-3.5 ${code.includes(c) ? 'whitespace-nowrap font-code text-[13.5px] text-ink' : 'text-ink-soft'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Cards that go to other pages: where to go next. */
export function Cards({ items }: { items: { title: string; href: string; text: string }[] }) {
  return (
    <div className="mt-5 grid max-w-[920px] gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <a key={item.href} href={item.href} className="lift block rounded-[14px] border border-border px-4.5 py-4 text-ink no-underline">
          <span className="block font-display text-[17px] font-bold">{item.title} →</span>
          <span className="mt-1 block text-[14.5px] leading-[1.55] text-muted">{item.text}</span>
        </a>
      ))}
    </div>
  );
}

/** A demo to try, with a line on what it shows. */
export function DemoBox({ children, title = 'Try it' }: { children: ReactNode; title?: string }) {
  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border bg-surface px-4 py-5 sm:px-6">
      <p className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** How a section starts: a pill, a heading, and a line under it. */
export function SectionHead({ id, badge, color, title, children }: { id: string; badge: string; color: Pastel; title: string; children?: ReactNode }) {
  return (
    <>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PASTEL_CLASS[color]}`}>{badge}</span>
      <h2 id={id} className="m-0 mt-3.5 scroll-mt-24 font-display text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em]">
        {title}
      </h2>
      {children && <p className="m-0 mt-2.5 max-w-[720px] text-[17px] leading-[1.6] text-muted">{children}</p>}
    </>
  );
}

/** A table of reference whose rows ⌘K goes to: each with an id, its name in code, its type, and what it does. */
export function RefTable({ label, rows, name = 'Name' }: { label: string; rows: { id: string; name: string; type?: string; does: ReactNode }[]; name?: string }) {
  const typed = rows.some((row) => row.type);
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls sideways on a phone, and a keyboard has to reach what is hidden (WCAG 2.1.1)
    <section className="mt-5 max-w-[920px] overflow-x-auto rounded-[14px] border border-border" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[620px] border-collapse text-left text-[15px]">
        <thead className="bg-surface text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          <tr>
            <th className="px-4.5 py-3 font-semibold">{name}</th>
            {typed && <th className="px-4.5 py-3 font-semibold">Type</th>}
            <th className="px-4.5 py-3 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} id={row.id} className="scroll-mt-28 border-t border-border align-top target:bg-pastel-yellow/60">
              <td className="whitespace-nowrap px-4.5 py-3.5 font-code text-[13.5px] font-medium text-ink">{row.name}</td>
              {typed && <td className="px-4.5 py-3.5">{row.type && <code className="rounded-[5px] bg-pastel-blue px-1.75 py-0.5 font-code text-[12.5px] text-pastel-blue-fg">{row.type}</code>}</td>}
              <td className="px-4.5 py-3.5 leading-normal text-ink-soft">{row.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** `code` in a sentence of the reference data, as code. */
export function withCode(text: string): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed sentence, never reordered.
      <code key={i} className="rounded-md bg-hover px-1.5 py-0.5 font-code text-[0.88em] text-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
