// One process for the page and for the backend: Vite serves the first, and
// hands what is under `/api/files` to `server/dev.ts`, which is plain
// @rebofiles/server and goes as it is into any server of your own.

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

// Another with `PORT`, as the tests in Chrome do, beside a playground already running.
const PORT = Number(process.env.PORT) || 5180;

function backend(): Plugin {
  return {
    name: 'rebofiles-playground-backend',
    configureServer(server) {
      // Loaded through Vite, which reads TypeScript and takes the packages from their source; a change in it shows without starting again.
      const load = async () => (await server.ssrLoadModule('/server/dev.ts')) as typeof import('./server/dev');
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api/files')) return next();
        load()
          .then(async ({ handle }) => {
            const { nodeHandler } = (await server.ssrLoadModule('@rebofiles/server')) as typeof import('@rebofiles/server');
            await nodeHandler(handle)(request, response);
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
