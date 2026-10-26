// The tests in Chrome (`npm run test:browser`): the playground driven with real
// clicks and keys, as a person goes through it. Its own port and its own
// folder, made empty each time, so it runs beside a playground already open
// and never touches `storage/`. Chrome is the one installed on the machine:
// nothing is downloaded.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 5189;
const STORAGE = join(tmpdir(), 'rebofiles-browser-tests');

export default defineConfig({
  testDir: 'apps/playground/test',
  // One drive for every test, so one after another.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `rm -rf "${STORAGE}" && npm run dev -w @rebofiles/playground`,
    env: { PORT: String(PORT), REBOFILES_STORAGE: STORAGE },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
