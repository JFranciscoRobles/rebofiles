'use client';

import { useState } from 'react';
import { HookDetail } from './HookDetail';
import { HOOKS, HOOK_KINDS, type HookKind, KIND_NAMES, hookHash } from './hooks';
import { roving, useHash } from './keys';
import { useT } from './live';
import { panelId } from './HookDetail';

const pill = (on: boolean) =>
  `cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink-soft hover:bg-hover'}`;

/**
 * The hooks: filtered by kind, one chosen, and that one open with its demo.
 * `#hooks-useEntries` in the address opens that one.
 */
export function HooksExplorer({ examples }: { examples: Record<string, string> }) {
  const [kind, setKind] = useState<'All' | HookKind>('All');
  const [selected, setSelected] = useState('useEntries');
  const t = useT();

  useHash((hash) => {
    const hook = HOOKS.find((h) => hookHash(h.name) === hash);
    if (!hook) return;
    setKind('All');
    setSelected(hook.name);
    document.getElementById(hash)?.scrollIntoView({ block: 'center' });
  });

  // A filter that hides the one chosen leaves the panel as it is.
  const shown = HOOKS.filter((hook) => kind === 'All' || hook.kind === kind);
  const focusable = shown.some((hook) => hook.name === selected) ? selected : shown[0]?.name;

  return (
    <>
      <fieldset className="m-0 mt-7 flex flex-wrap gap-2 border-0 p-0" aria-label={t({ en: 'Kinds of hook', es: 'Tipos de hook', zh: 'Hook 类型' })}>
        {(['All', ...HOOK_KINDS] as const).map((name) => (
          <button key={name} type="button" aria-pressed={name === kind} onClick={() => setKind(name)} className={pill(name === kind)}>
            {t(KIND_NAMES[name])}
          </button>
        ))}
      </fieldset>
      <div
        role="tablist"
        aria-label="Hooks"
        className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
        onKeyDown={(event) => roving(event, (i) => setSelected(shown[i].name))}
      >
        {shown.map((h) => {
          const on = h.name === selected;
          return (
            <button
              key={h.name}
              id={hookHash(h.name)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId(h.name)}
              tabIndex={h.name === focusable ? 0 : -1}
              onClick={() => setSelected(h.name)}
              className={`lift flex-none cursor-pointer snap-start scroll-mt-24 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-left ${on ? 'border-brand bg-brand-light' : 'border-border bg-white'}`}
            >
              <span className={`block font-code text-sm font-medium ${on ? 'text-brand' : 'text-ink'}`}>{h.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{t(h.short)}</span>
            </button>
          );
        })}
      </div>
      {HOOKS.map((hook) => (
        <HookDetail
          key={hook.name}
          hook={hook}
          example={examples[hook.name]}
          on={hook.name === selected}
          onFound={() => {
            setKind('All');
            setSelected(hook.name);
          }}
        />
      ))}
    </>
  );
}
