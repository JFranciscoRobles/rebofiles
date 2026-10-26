// Fastify: the drive in a plugin of its own, at /api/files, where no parser
// of Fastify's reads the body, and the answer is written by the drive on the
// raw response.
//
//   npx tsx examples/fastify/server.ts

import Fastify from 'fastify';
import { nodeHandler } from '@rebofiles/server';
import { identify } from '../auth/dev';
import { createDrive } from '../drive';

export async function createApp() {
  const drive = nodeHandler(await createDrive(identify));
  const app = Fastify();
  await app.register(async (scope) => {
    // Every body left as it came, in this plugin only: the drive reads it.
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, _payload, done) => done(null));
    scope.all('/api/files/*', (request, reply) => {
      reply.hijack();
      return drive(request.raw, reply.raw);
    });
    scope.all('/api/files', (request, reply) => {
      reply.hijack();
      return drive(request.raw, reply.raw);
    });
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await createApp();
  await app.listen({ port: 3000 });
  console.log('The drive is at http://localhost:3000/api/files');
}
