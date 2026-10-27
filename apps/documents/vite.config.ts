// As the playground: Vite serves the page, and hands what is under
// `/api/files` to `server/documents.ts`.

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const PORT = Number(process.env.PORT) || 5184;

function backend(): Plugin {
  return {
    name: 'rebofiles-documents-backend',
    configureServer(server) {
      const load = async () => (await server.ssrLoadModule('/server/documents.ts')) as typeof import('./server/documents');
      server.middlewares.use((request, response, next) => {
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
