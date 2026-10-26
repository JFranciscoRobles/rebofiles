// Hono: the Request Hono has is the one the drive takes, and its Response is
// Hono's to give. The same on Node, Bun and Deno; on a Worker, with a storage
// and a store that run there.
//
//   npx tsx examples/hono/server.ts

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { identify } from '../auth/dev';
import { createDrive } from '../drive';

export async function createApp() {
  const handle = await createDrive(identify);
  const app = new Hono();
  app.all('/api/files/*', (c) => handle(c.req.raw));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  serve({ fetch: (await createApp()).fetch, port: 3000 }, () => console.log('The drive is at http://localhost:3000/api/files'));
}
