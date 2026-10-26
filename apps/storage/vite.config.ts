// As the playground: Vite serves the page, and hands what is under
// `/api/files` to `server/bucket.ts`. The difference is where the bytes go:
// the page sends and reads them at the bucket itself, at addresses the server
// signs, so the bucket has to let this origin in (`cors.json`).

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const PORT = 5183;

function backend(): Plugin {
  return {
    name: 'rebofiles-storage-backend',
    configureServer(server) {
      const load = async () => (await server.ssrLoadModule('/server/bucket.ts')) as typeof import('./server/bucket');
      server.middlewares.use((request, response, next) => {
        const mcp = request.url?.startsWith('/api/mcp');
        if (!request.url?.startsWith('/api/files') && !mcp) return next();
        load()
          .then(async (backend) => {
            const { nodeHandler } = (await server.ssrLoadModule('@rebofiles/server')) as typeof import('@rebofiles/server');
            await nodeHandler(mcp ? backend.mcp : backend.handle)(request, response);
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
