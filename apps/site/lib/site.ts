/** Where the code is. One place to change it. */
export const REPO = 'https://github.com/JFranciscoRobles/rebofiles';
export const SITE = 'https://rebofiles.com';
/** Every package, on npm. */
export const NPM_ORG = 'https://www.npmjs.com/org/rebofiles';
/** The other product of the suite. */
export const REBODOCS = 'https://www.rebodocs.com';
/** The documentation, and its page of what is checked. */
export const DOCS = '/docs/';
export const STATUS = '/docs/status/';
/** The demos, side by side. */
export const DEMOS = '/demo/';
/** Where “Get started” goes. */
export const GET_STARTED = '/docs/getting-started/';

import type { Pastel } from './home';
import { type Locale, dict, localePath } from './i18n';

export interface NavItem {
  title: string;
  /** Its path under /docs/; `index` is /docs/ itself. */
  slug: string;
}

/** The pages of the documentation, in the order they are read; each group has its colour in the sidebar. */
export const NAV: { title: string; color: Pastel; items: NavItem[] }[] = [
  {
    title: 'Start',
    color: 'blue',
    items: [
      { title: 'What is ReboFiles', slug: 'index' },
      { title: 'Getting started', slug: 'getting-started' },
      { title: 'Demos to run', slug: 'demos' },
    ],
  },
  {
    title: 'Put it in your app',
    color: 'purple',
    items: [
      { title: 'React component', slug: 'react' },
      { title: 'Headless: your own UI', slug: 'hooks' },
      { title: 'Without a framework', slug: 'vanilla' },
      { title: 'Styling and themes', slug: 'styling' },
      { title: 'Keyboard and accessibility', slug: 'accessibility' },
      { title: 'Languages', slug: 'languages' },
    ],
  },
  {
    title: 'Files',
    color: 'yellow',
    items: [
      { title: 'Uploads', slug: 'uploads' },
      { title: 'Previews and the viewer', slug: 'previews' },
      { title: 'Search', slug: 'search' },
      { title: 'Live changes and large folders', slug: 'live' },
      { title: 'Versions, trash and space', slug: 'versions' },
      { title: 'Download as .zip', slug: 'zip' },
      { title: 'Word documents', slug: 'word' },
    ],
  },
  {
    title: 'The server',
    color: 'pink',
    items: [
      { title: 'The route', slug: 'server' },
      { title: 'Frameworks and sign-in', slug: 'frameworks' },
      { title: 'Who may do what', slug: 'authorize' },
      { title: 'Storage: S3 and disk', slug: 'storage' },
      { title: 'Checking uploads', slug: 'checking-uploads' },
      { title: 'Metadata: SQLite and Postgres', slug: 'metadata' },
      { title: 'Database schema', slug: 'schema' },
      { title: 'Sharing and links', slug: 'sharing' },
      { title: 'Activity and notifications', slug: 'activity' },
      { title: 'Desktop and other origins', slug: 'desktop' },
      { title: 'Sync a folder', slug: 'sync' },
      { title: 'Going to production', slug: 'production' },
    ],
  },
  {
    title: 'Together',
    color: 'orange',
    items: [{ title: 'AI assistants (MCP)', slug: 'assistants' }],
  },
  {
    title: 'Reference',
    color: 'green',
    items: [
      { title: 'Packages', slug: 'packages' },
      { title: 'Components and hooks', slug: 'components' },
      { title: 'Client API', slug: 'client' },
      { title: 'HTTP routes', slug: 'routes' },
      { title: 'Status and roadmap', slug: 'status' },
    ],
  },
];

export const PAGES = NAV.flatMap((group) => group.items);
/** The group a page is in, for the line above its title. */
export const groupOf = (slug: string) => NAV.find((group) => group.items.some((item) => item.slug === slug));
export const hrefOf = (slug: string) => (slug === 'index' ? '/docs/' : `/docs/${slug}/`);
/** A page of the documentation in a language. */
export const docHref = (locale: Locale, slug: string) => localePath(locale, hrefOf(slug));
/** The menu of the documentation in a language: the groups and pages by the names the language gives them. */
export function navOf(locale: Locale) {
  const d = dict(locale);
  return NAV.map((group) => ({ ...group, key: group.title, title: d.groups[group.title] ?? group.title, items: group.items.map((item) => ({ ...item, title: d.pages[item.slug] ?? item.title })) }));
}
export const pagesOf = (locale: Locale) => navOf(locale).flatMap((group) => group.items);
/** The page as Markdown, beside it, for a language model: made after the build by `scripts/llms.ts`. */
export const markdownOf = (slug: string) => `/docs/${slug}.md`;
