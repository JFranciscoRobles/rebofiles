// What a search engine is told of every page, checked once the site is built:
// a title and a description of its own, of a length that is shown whole; one
// address of its own; the card of a link; one h1; what schema.org is told,
// parsed; every picture said in words; and every page in the sitemap. The
// build fails on any of it, so a page is not put up without.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseHTML } from 'linkedom';
import { LOCALE_INFO, splitPath } from '../lib/i18n';
import { SITE } from '../lib/site';

const OUT = join(import.meta.dirname, '../out');

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name === 'index.html' ? [path] : [];
  });

const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
const problems: string[] = [];
const titles = new Map<string, string>();
const descriptions = new Map<string, string>();
let checked = 0;

for (const file of htmlFiles(OUT)) {
  const path = `/${relative(OUT, file).replace(/index\.html$/, '')}`;
  const { document } = parseHTML(readFileSync(file, 'utf8'));
  const meta = (name: string) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') ?? '';
  // A page that only sends elsewhere, or is kept out of search: not a page to find.
  if (/noindex/.test(meta('robots')) || document.querySelector('meta[http-equiv="refresh"]')) continue;
  if (path === '/404/' || path.startsWith('/_')) continue;
  checked++;
  const say = (what: string) => problems.push(`${path}: ${what}`);
  const title = document.querySelector('title')?.textContent?.trim() ?? '';
  const description = meta('description');
  if (!title) say('no title');
  else if (title.length > 70) say(`a title of ${title.length} characters, more than a result shows: “${title}”`);
  // A character of Chinese says what several of English do: its own range.
  const [least, most] = splitPath(path).locale === 'zh' ? [25, 120] : [50, 170];
  if (description.length < least || description.length > most) say(`a description of ${description.length} characters, not ${least} to ${most}`);
  // Each its own within its language: the same page in another language may share a name, as "Demo".
  const lang = splitPath(path).locale;
  if (titles.has(`${lang}:${title}`)) say(`the same title as ${titles.get(`${lang}:${title}`)}`);
  if (descriptions.has(`${lang}:${description}`)) say(`the same description as ${descriptions.get(`${lang}:${description}`)}`);
  titles.set(`${lang}:${title}`, path);
  descriptions.set(`${lang}:${description}`, path);
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (canonical !== `${SITE}${path}`) say(`its canonical is ${canonical}, not ${SITE}${path}`);
  for (const name of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'twitter:card']) if (!meta(name)) say(`no ${name}`);
  if (meta('og:url') && meta('og:url') !== `${SITE}${path}`) say(`og:url is ${meta('og:url')}`);
  const { locale } = splitPath(path);
  if (document.documentElement.getAttribute('lang') !== LOCALE_INFO[locale].html) say(`lang is ${document.documentElement.getAttribute('lang')}, not ${LOCALE_INFO[locale].html}`);
  // The same page in each language, and a default: each one there, and this one among them.
  const alternates = [...document.querySelectorAll('link[rel="alternate"]')].map((link) => link.getAttribute('hreflang') ?? link.getAttribute('hrefLang'));
  for (const one of [...Object.values(LOCALE_INFO).map((info) => info.hreflang), 'x-default']) if (!alternates.includes(one)) say(`no hreflang ${one}`);
  const h1 = document.querySelectorAll('h1').length;
  if (h1 !== 1) say(`${h1} h1`);
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      JSON.parse(script.textContent ?? '');
    } catch {
      say('JSON-LD that does not parse');
    }
  }
  if (path.startsWith('/docs/') && !document.querySelector('script[type="application/ld+json"]')) say('no JSON-LD');
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) say(`a picture without alt: ${img.getAttribute('src')}`);
  if (!sitemap.includes(`<loc>${SITE}${path}</loc>`)) say('not in the sitemap');
}

if (problems.length) {
  console.error(`SEO: ${problems.length} problems in ${checked} pages\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`SEO: ${checked} pages, each with its own title, description, canonical, hreflang, card and h1, all in the sitemap`);
