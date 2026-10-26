// What is checked, what is not, and what comes next, from `data.ts`. The same
// sections as Rebodocs' status page, and the same as ROADMAP.md.

import type { ReactNode } from 'react';
import { DocsPage, Section } from '@/components/docs/DocsPage';
import { PUBLISHED, VERSION } from '@/lib/home';
import { REPO } from '@/lib/site';
import { CHECKED, LIMITS, MEASURED, NOT_CHECKED, ROADMAP, TESTS } from './data';

const CONTENTS: [string, string][] = [
  ['tests', 'The tests'],
  ['checked', 'Checked by hand'],
  ['not-checked', 'Not checked yet'],
  ['limits', 'Known limits'],
  ['roadmap', 'Roadmap'],
];

/** `code` in the texts of data.ts, as code. */
function withCode(text: string): ReactNode {
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

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      {rows.map(([what, how]) => (
        <div key={what} className="grid gap-1 border-t border-border px-4.5 py-3.5 first:border-t-0 sm:grid-cols-[180px_1fr] sm:gap-5">
          <p className="font-semibold text-ink">{what}</p>
          <p className="text-[15.5px] text-ink-soft">{withCode(how)}</p>
        </div>
      ))}
    </div>
  );
}

export function StatusPage() {
  const total = TESTS.reduce((sum, row) => sum + row.count, 0);
  return (
    <DocsPage
      eyebrow="Status"
      title="What is checked, what is not"
      contents={CONTENTS}
      intro={
        <p>
          Version {VERSION}, {PUBLISHED ? 'on npm' : 'not on npm yet'}. The numbers are what running the commands gave on {MEASURED}, not what anyone remembers; the same is in{' '}
          <a href={`${REPO}/blob/main/ROADMAP.md`} className="font-medium text-brand hover:text-brand-hover">
            ROADMAP.md
          </a>
          .
        </p>
      }
    >
      <Section id="tests" title="The tests">
        <p>
          {total} tests, every one passing, by <code className="font-code text-[0.9em]">npm test</code> and, in Chrome, <code className="font-code text-[0.9em]">npm run test:browser</code>.
        </p>
        <div className="overflow-hidden rounded-[14px] border border-border">
          {TESTS.map((row) => (
            <div key={row.where} className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 border-t border-border px-4.5 py-3.5 first:border-t-0">
              <p className="font-code text-[14px] font-medium text-ink">{row.where}</p>
              <p className="row-span-2 self-center font-display text-[28px] font-extrabold tracking-[-0.03em] text-brand">{row.count}</p>
              <p className="text-[15px] text-ink-soft">{row.what}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="checked" title="Checked by hand">
        <Rows rows={CHECKED} />
      </Section>

      <Section id="not-checked" title="Not checked yet">
        <Rows rows={NOT_CHECKED} />
      </Section>

      <Section id="limits" title="Known limits">
        <div className="grid gap-3 sm:grid-cols-2">
          {LIMITS.map((group) => (
            <div key={group.area} className="rounded-[14px] border border-border p-4.5">
              <p className="font-semibold text-ink">{group.area}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px]">
                {group.items.map((item) => (
                  <li key={item}>{withCode(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="roadmap" title="Roadmap">
        <p>In the order it is built. Each version goes to npm when its last item is done, and not before.</p>
        <ol className="space-y-3">
          {ROADMAP.map((milestone) => {
            const done = milestone.items.filter((item) => item.done).length;
            return (
              <li key={milestone.version} className="rounded-[14px] border border-border p-4.5">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-code text-[14px] font-medium text-brand">{milestone.version}</span>
                  <span className="font-semibold text-ink">{milestone.name}</span>
                  {done > 0 && (
                    <span className="ml-auto text-[13px] text-muted">
                      {done} of {milestone.items.length}
                    </span>
                  )}
                </p>
                <ul className="mt-2.5 space-y-1.5 text-[15px]">
                  {milestone.items.map((item) => (
                    <li key={item.what} className="flex gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded-full text-[10px] ${item.done ? 'bg-brand text-white' : 'border border-border-strong'}`}
                      >
                        {item.done ? '✓' : ''}
                      </span>
                      <span className={item.done ? 'text-ink-soft' : 'text-muted'}>
                        {item.what}
                        {item.done && <span className="sr-only"> (done)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </Section>
    </DocsPage>
  );
}
