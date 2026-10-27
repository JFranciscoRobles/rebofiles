// Every page of the documentation, by its slug: what the frame draws and ⌘K finds.

import * as app from './pages/app';
import * as files from './pages/files';
import * as reference from './pages/reference';
import * as running from './pages/running';
import * as team from './pages/team';
import * as schema from './pages/schema';
import * as server from './pages/server';
import * as start from './pages/start';
import * as together from './pages/together';
import type { Locale } from '@/lib/i18n';
import { DOC_PAGES_ES } from './pages/es';
import { DOC_PAGES_ZH } from './pages/zh';
import type { DocPage } from './ui';

export const DOC_PAGES: Record<string, DocPage> = {
  index: start.index,
  'getting-started': start.gettingStarted,
  demos: start.demos,
  react: app.react,
  hooks: app.hooks,
  vanilla: app.vanilla,
  styling: app.styling,
  accessibility: app.accessibility,
  languages: app.languages,
  uploads: files.uploads,
  previews: files.previews,
  search: files.search,
  live: running.live,
  comments: team.comments,
  organizing: team.organizing,
  versions: files.versions,
  zip: files.zip,
  word: files.word,
  server: server.server,
  frameworks: running.frameworks,
  authorize: server.authorize,
  storage: server.storage,
  'checking-uploads': running.checkingUploads,
  metadata: server.metadata,
  schema: schema.schema,
  sharing: server.sharing,
  activity: server.activity,
  observability: team.observe,
  retention: team.keeping,
  desktop: server.desktop,
  sync: running.sync,
  production: running.production,
  assistants: together.assistants,
  packages: reference.packages,
  components: reference.components,
  client: reference.client,
  routes: reference.routesPage,
  status: reference.status,
};

/** Each language's own pages; a page not written in one yet is read in English. */
const BY_LOCALE: Record<Locale, Partial<Record<string, DocPage>>> = { en: DOC_PAGES, es: DOC_PAGES_ES, zh: DOC_PAGES_ZH };
export const docPageOf = (locale: Locale, slug: string): DocPage | undefined => BY_LOCALE[locale][slug] ?? DOC_PAGES[slug];

/** The sections of a page, as "On this page" and ⌘K list them. */
export const headingsOf = (page: DocPage) => page.sections.map((section) => ({ id: section.id, text: section.title }));
