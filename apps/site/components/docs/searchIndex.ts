// What ⌘K finds: every page and its sections, the props, hooks, client, options,
// routes, tools and packages of the reference. Made when the site is built;
// the browser only filters it.

import { TOOLS } from '@rebofiles/mcp';
import { PAGES, groupOf, hrefOf } from '@/lib/site';
import { hookId, propId } from './pages/app';
import { clientId, packageId } from './pages/reference';
import { optionId } from './pages/server';
import { toolId } from './pages/together';
import { CLIENT, HOOKS, PACKAGE_DOCS, PROPS, SERVER_OPTIONS } from './reference';
import { DOC_PAGES } from './registry';
import { routeId, routes } from './routes';

export interface SearchEntry {
  kind: 'Page' | 'Section' | 'Package' | 'Component' | 'Prop' | 'Hook' | 'Function' | 'Route' | 'Tool';
  title: string;
  /** The page it is on, what it is about, or, for a page, the group of the menu it is in. */
  detail: string;
  href: string;
  /** More words it is found by, not shown: what the page or the section is about. */
  keywords?: string;
}

const plain = (text: string) => text.replace(/`/g, '');

export function searchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const page of PAGES) {
    const href = hrefOf(page.slug);
    const doc = DOC_PAGES[page.slug];
    entries.push({ kind: 'Page', title: page.title, detail: groupOf(page.slug)?.title ?? '', href, keywords: doc.description });
    for (const section of doc.sections)
      entries.push({ kind: 'Section', title: section.title, detail: page.title, href: `${href}#${section.id}`, keywords: `${section.badge} ${typeof section.lead === 'string' ? section.lead : ''}` });
  }
  entries.push({ kind: 'Component', title: '<FileDrive />', detail: 'The whole drive', href: hrefOf('react') });
  entries.push({ kind: 'Component', title: '<SharedLink />', detail: 'What someone sent a link sees', href: `${hrefOf('react')}#the-link-page` });
  for (const prop of PROPS) entries.push({ kind: 'Prop', title: prop.name, detail: `FileDrive · ${prop.type}`, href: `${hrefOf('react')}#${propId(prop.name)}`, keywords: plain(prop.does) });
  for (const option of SERVER_OPTIONS)
    entries.push({ kind: 'Prop', title: option.name, detail: `createDriveHandler · ${option.type}`, href: `${hrefOf('server')}#${optionId(option.name)}`, keywords: plain(option.does) });
  for (const hook of HOOKS) entries.push({ kind: 'Hook', title: hook.name, detail: hook.short, href: `${hrefOf('hooks')}#${hookId(hook.name)}`, keywords: plain(hook.gives) });
  for (const method of CLIENT) entries.push({ kind: 'Function', title: `client.${method.name}`, detail: plain(method.does), href: `${hrefOf('client')}#${clientId(method.name)}` });
  for (const route of routes()) entries.push({ kind: 'Route', title: `${route.method} ${route.path}`, detail: plain(route.does), href: `${hrefOf('routes')}#${routeId(route)}` });
  for (const tool of TOOLS) entries.push({ kind: 'Tool', title: tool.name, detail: `MCP · ${tool.description.split(/(?<=[.:])\s/)[0]}`, href: `${hrefOf('assistants')}#${toolId(tool.name)}` });
  for (const pkg of PACKAGE_DOCS) entries.push({ kind: 'Package', title: pkg.name, detail: pkg.what, href: `${hrefOf('packages')}#${packageId(pkg.name)}` });
  return entries;
}
