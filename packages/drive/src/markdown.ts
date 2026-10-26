// Markdown shown as a page: headings, paragraphs, lists, quotes, code, rules,
// and in a line strong, emphasis, code and links. Made of elements and text
// nodes, never of HTML, so what a file says cannot run in the page; a link
// goes only to http, https or mail.

import { type Child, h } from './dom';

const SAFE = /^(https?:|mailto:)/i;

/** Strong, emphasis, code and links in a line. */
function inline(text: string): Child[] {
  const out: Child[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) out.push(text.slice(at, match.index));
    const [whole, code, strong, em, link] = match;
    if (code) out.push(h('code', null, code.slice(1, -1)));
    else if (strong) out.push(h('strong', null, ...inline(strong.slice(2, -2))));
    else if (em) out.push(h('em', null, ...inline(em.slice(1, -1))));
    else if (link) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(link)!;
      out.push(SAFE.test(href) ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...inline(label)) : label);
    }
    at = match.index + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

export function markdown(source: string): HTMLElement {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Child[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i]);
      i++;
      blocks.push(h('pre', null, h('code', null, code.join('\n'))));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push(h(`h${heading[1].length}`, null, ...inline(heading[2])));
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      blocks.push(h('hr'));
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quoted.push(lines[i].replace(/^\s*>\s?/, ''));
      blocks.push(h('blockquote', null, markdown(quoted.join('\n'))));
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+/;
    if (item.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: Child[] = [];
      for (; i < lines.length && item.test(lines[i]); i++) {
        const text = lines[i].replace(item, '');
        const task = /^\[( |x|X)\]\s+/.exec(text);
        items.push(h('li', null, task ? (task[1] === ' ' ? '☐ ' : '☑ ') : null, ...inline(task ? text.slice(task[0].length) : text)));
      }
      blocks.push(h(ordered ? 'ol' : 'ul', null, ...items));
      continue;
    }
    const paragraph: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*~~~|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]); i++) paragraph.push(lines[i].trim());
    blocks.push(h('p', null, ...inline(paragraph.join(' '))));
  }
  return h('div', { class: 'rf-md' }, ...blocks);
}

/** The rows of a CSV or a TSV, with quoted fields, up to `limit` rows. */
export function rowsOf(text: string, separator = ',', limit = 1000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < limit; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === separator) row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if ((field || row.length) && rows.length < limit) rows.push([...row, field]);
  return rows;
}
