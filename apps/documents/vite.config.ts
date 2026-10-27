// As the playground: Vite serves the page, and hands what is under
// `/api/files` to `server/documents.ts`, and what is under `/collab` to
// Rebodocs' collaboration server, in `server/collab.ts`.

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const PORT = Number(process.env.PORT) || 5184;

function backend(): Plugin {
  return {
    name: 'rebofiles-documents-backend',
    configureServer(server) {
      const load = async () => (await server.ssrLoadModule('/server/documents.ts')) as typeof import('./server/documents');
      const together = async () => (await server.ssrLoadModule('/server/collab.ts')) as typeof import('./server/collab');
      server.middlewares.use((request, response, next) => {
        // Rebodocs' rooms, where several write in one document, and what lets each in.
        if (request.url?.startsWith('/collab')) return void together().then(({ collab }) => collab.handle(request, response, next), next);
        if (request.url?.startsWith('/api/collab/ticket')) return void together().then(({ ticket }) => ticket(request, response), next);
        // Where the webhook of the drive is sent: this demo, as another application would be.
        if (request.url?.startsWith('/api/hooks')) return void load().then(({ hooks }) => hooks(request, response), next);
        if (request.url?.startsWith('/api/outbox')) return void load().then(({ mails }) => mails(request, response), next);
        if (!request.url?.startsWith('/api/files')) return next();
        load()
          .then(async (backend) => {
            const { nodeHandler } = (await server.ssrLoadModule('@rebofiles/server')) as typeof import('@rebofiles/server');
            await nodeHandler(backend.handle)(request, response);
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), backend()],
  server: { port: PORT, strictPort: true },
});
