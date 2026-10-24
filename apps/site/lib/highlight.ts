// Code coloured when the site is built, as Rebodocs' site colours its own
// (lib/docs.ts there): Shiki's light theme, with the colours too pale on white
// made darker.

import { type Highlighter, createHighlighter } from 'shiki';

const THEME = 'github-light';
const LANGS = ['ts', 'tsx', 'bash'];

let highlighter: Promise<Highlighter> | undefined;
const shiki = () => (highlighter ??= createHighlighter({ themes: [THEME], langs: LANGS }));

/** Colours of the light theme too pale on white, each with one that reads at 4.5:1 or more. */
const DARKER: Record<string, string> = { '#6A737D': '#57606A', '#D73A49': '#CF222E', '#E36209': '#A04100', '#22863A': '#1A7F37' };

export async function highlight(code: string, lang: string): Promise<string> {
  const lit = await shiki();
  return lit.codeToHtml(code.replace(/\n$/, ''), { lang: LANGS.includes(lang) ? lang : 'text', theme: THEME }).replace(/#(6A737D|D73A49|E36209|22863A)\b/gi, (hex) => DARKER[hex.toUpperCase()]);
}
