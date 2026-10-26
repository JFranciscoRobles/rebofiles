// The routes of @rebofiles/server, read from the comment at the top of
// packages/server/src/api.ts when the site is built: the list there is the
// one the code keeps, so the reference never says another.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  does: string;
  /** Asked of someone signed in, or of whoever has a link. */
  through: 'session' | 'link';
}

let read: Route[] | undefined;

export function routes(): Route[] {
  if (read) return read;
  const source = readFileSync(path.join(process.cwd(), '../../packages/server/src/api.ts'), 'utf8');
  const found: Route[] = [];
  let through: Route['through'] = 'session';
  for (const line of source.split('\n')) {
    if (!line.startsWith('//')) break;
    if (line.includes('for what a link reads')) through = 'link';
    const route = /^\/\/ {3}(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s*(.*)$/.exec(line);
    if (route) found.push({ method: route[1] as Route['method'], path: route[2], does: route[3].trim(), through });
    // A line that goes on from the one before it.
    else if (/^\/\/ {10,}\S/.test(line) && found.length) found[found.length - 1].does += ` ${line.slice(2).trim()}`;
  }
  read = found;
  return found;
}

/** The id of a route on the page of the routes, for ⌘K to go to it. */
export const routeId = (route: Route) =>
  `route-${route.method}-${route.path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '');
