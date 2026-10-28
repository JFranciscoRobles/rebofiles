'use client';

// What a demo of a hook sends to the dark panel beside it: each value the hook
// gives right now, coloured by what it is; and the classes its buttons share.

import { useEffect } from 'react';
import { useLocale } from '@/components/useLocale';

/** A text in each language of the site. */
export type L = { en: string; es: string; zh: string };

/** The text of the page's language. */
export function useT() {
  const { locale } = useLocale();
  return (text: L) => text[locale];
}

/** A value on the dark panel, coloured by what it is. */
export interface LiveValue {
  key: string;
  value: string;
  kind: 'string' | 'number' | 'boolean' | 'call' | 'empty' | 'error';
}

/** Sends the values each time one of them changes. */
export function useEmit(onValues: (values: LiveValue[]) => void, values: LiveValue[]) {
  const key = JSON.stringify(values);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sent again when what is sent changes, compared by its JSON
  useEffect(() => onValues(values), [key]);
}

/** Shorthands for the values on the dark panel. */
export const live = {
  str: (key: string, value: string | null | undefined, max = 36): LiveValue =>
    value == null ? { key, value: String(value), kind: 'empty' } : { key, value: `'${value.length > max ? `${value.slice(0, max)}…` : value}'`, kind: 'string' },
  num: (key: string, value: number): LiveValue => ({ key, value: String(value), kind: 'number' }),
  bool: (key: string, value: boolean): LiveValue => ({ key, value: String(value), kind: 'boolean' }),
  call: (key: string): LiveValue => ({ key, value: 'ƒ', kind: 'call' }),
  /** A list, as how many it has and the first names in it. */
  list: (key: string, names: string[]): LiveValue => ({
    key,
    value: names.length
      ? `[${names
          .slice(0, 3)
          .map((name) => `'${name}'`)
          .join(', ')}${names.length > 3 ? `, …${names.length - 3}` : ''}]`
      : '[]',
    kind: names.length ? 'string' : 'empty',
  }),
  error: (key: string, error: Error | null): LiveValue => (error ? { key, value: error.message, kind: 'error' } : { key, value: 'null', kind: 'empty' }),
};

export const small =
  'h-[30px] cursor-pointer rounded-[7px] border border-border-strong bg-white px-2.5 text-[13px] text-ink transition-colors hover:bg-hover disabled:cursor-default disabled:opacity-50';
export const field = 'min-w-0 rounded-[7px] border border-border bg-white px-2.5 py-1.5 text-sm text-ink';
export const hint = 'm-0 text-sm leading-normal text-muted';
export const row = 'flex items-center gap-2 border-t border-[#f0eee9] py-1.5 text-sm first:border-t-0';
