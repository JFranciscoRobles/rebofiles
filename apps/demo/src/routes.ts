// The routes of @rebofiles/server, answered in the page from the drive kept
// there: what the MCP tools ask, so that they run here as on a server. What
// is read comes from the client; what is changed is applied as `by`, as a
// change made by someone else. Uploads are not here: no tool of the demo
// needs one.

import * as core from '@rebofiles/core';
import type { MemoryClient } from '@rebofiles/react';

export const BASE = 'https://demo.invalid/api/files';

export function routesOver(client: MemoryClient, by: string): typeof fetch {
  const answer = (body: unknown, status = 200) => Response.json(body, { status });
  const change = (work: (drive: core.Drive, context: core.Context) => core.Drive, id: string) => {
    client.apply(work, by);
    return answer({ entry: core.getEntry(client.drive, id) });
  };

  return async (input, init) => {
    const url = new URL(String(input));
    // The bytes of a file are at an address of the page's own.
    if (!url.href.startsWith(BASE)) return fetch(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/files/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const id = decodeURIComponent(/^\/entries\/([^/]+)/.exec(path)?.[1] ?? '');
    try {
      if (method === 'GET' && path === '/entries') return answer(await client.list(url.searchParams.get('folder')));
      if (method === 'GET' && path === '/search')
        return answer({ entries: await client.search(url.searchParams.get('q') ?? '', { within: url.searchParams.get('within') ?? undefined, trashed: url.searchParams.has('trashed') }) });
      if (method === 'GET' && path === '/recent') return answer({ entries: await client.recent() });
      if (method === 'GET' && path === '/shared') return answer({ entries: await client.shared() });
      if (method === 'GET' && path === `/entries/${encodeURIComponent(id)}/download`) return answer({ url: await client.url(id, { version: url.searchParams.get('version') ?? undefined }) });
      if (method === 'GET' && id) return answer(await client.entry(id));
      if (method === 'PATCH' && id && 'name' in body) return change((drive, context) => core.rename(drive, id, body.name, context), id);
      if (method === 'PATCH' && id && 'parent' in body) return change((drive, context) => core.move(drive, id, body.parent, context), id);
      if (method === 'POST' && path.endsWith('/trash')) return change((drive, context) => core.moveToTrash(drive, id, context), id);
      if (method === 'POST' && path.endsWith('/restore') && !path.includes('/versions/')) return change((drive, context) => core.restore(drive, id, context), id);
      return answer({ error: 'no-route', message: 'The demo does not do that.' }, 404);
    } catch (error) {
      if (error instanceof core.DriveError) return answer({ error: error.code, message: error.message }, error.code === 'not-found' ? 404 : 409);
      const said = error as { status?: number; code?: string; message: string };
      return answer({ error: said.code ?? 'server', message: said.message }, said.status ?? 500);
    }
  };
}
