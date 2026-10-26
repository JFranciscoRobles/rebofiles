// The pages of the documentation in Mandarin, by slug; one not here is read in English.

import type { DocPage } from '../../ui';
import * as app from './app';
import * as files from './files';
import * as reference from './reference';
import * as running from './running';
import * as schema from './schema';
import * as server from './server';
import * as together from './together';
import * as start from './start';

export const DOC_PAGES_ZH: Partial<Record<string, DocPage>> = {
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
  versions: files.versions,
  zip: files.zip,
  word: files.word,
  server: server.server,
  frameworks: running.frameworks,
  authorize: server.authorize,
  storage: server.storage,
  'checking-uploads': running.checkingUploads,
  metadata: server.metadata,
  sharing: server.sharing,
  activity: server.activity,
  schema: schema.schema,
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
