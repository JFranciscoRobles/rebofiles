// Express: the drive mounted at /api/files, before any parser of the body,
// which would read what the drive reads itself. `nodeHandler` takes the
// path from `originalUrl`, so `app.use` with a path works as it does.
//
//   npx tsx examples/express/server.ts

import express from 'express';
import { nodeHandler } from '@rebofiles/server';
import { identify } from '../auth/dev';
import { createDrive } from '../drive';

export async function createApp() {
  const app = express();
  app.use('/api/files', nodeHandler(await createDrive(identify)));
  // The rest of your application, its parsers among it, after.
  app.use(express.json());
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await createApp();
  app.listen(3000, () => console.log('The drive is at http://localhost:3000/api/files'));
}
