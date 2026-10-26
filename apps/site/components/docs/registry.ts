// Every page of the documentation, by its slug: what the frame draws and ⌘K finds.

import * as app from './pages/app';
import * as files from './pages/files';
import * as reference from './pages/reference';
import * as schema from './pages/schema';
import * as server from './pages/server';
import * as start from './pages/start';
import * as together from './pages/together';
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
  versions: files.versions,
  zip: files.zip,
  word: files.word,
  server: server.server,
  authorize: server.authorize,
  storage: server.storage,
  metadata: server.metadata,
  schema: schema.schema,
  sharing: server.sharing,
  activity: server.activity,
  desktop: server.desktop,
  assistants: together.assistants,
  packages: reference.packages,
  components: reference.components,
  client: reference.client,
  routes: reference.routesPage,
  status: reference.status,
};

/** The sections of a page, as "On this page" and ⌘K list them. */
export const headingsOf = (page: DocPage) => page.sections.map((section) => ({ id: section.id, text: section.title }));
