// The tests in Chrome (`npm run test:browser`): the playground driven with real
// clicks and keys, as a person goes through it, and the demo of the landing.
// Their own ports, and the playground its own folder, made empty each time, so
// they run beside a playground already open and never touch `storage/`.
// Chrome is the one installed on the machine; WebKit (Safari's engine, the
// desktop window's on a Mac) and Firefox are Playwright's own
// (`npx playwright install webkit firefox`). One at a time, each run with a
// drive of its own: `--project=webkit`, or `npm run test:browsers` for all.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5189;
/** The demo, on a port of its own: `DEMO` in its tests. */
export const DEMO = 'http://localhost:5188';
/** The documents' demo, on a port of its own and a folder made empty each time: `DOCUMENTS` in its tests. */
export const DOCUMENTS = 'http://localhost:5187';
const DOCUMENTS_STORAGE = join(tmpdir(), 'rebofiles-documents-tests');
const STORAGE = join(tmpdir(), 'rebofiles-browser-tests');

export default defineConfig({
  testDir: 'apps',
  testMatch: '*/test/**/*.spec.ts',
  // One drive for every test, so one after another.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: `rm -rf "${STORAGE}" && npm run dev -w @rebofiles/playground`,
      env: { PORT: String(PORT), REBOFILES_STORAGE: STORAGE },
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    { command: 'npm run dev -w @rebofiles/demo -- --port 5188', url: DEMO, reuseExistingServer: false, timeout: 60_000 },
    {
      command: `rm -rf "${DOCUMENTS_STORAGE}" && npm run dev -w @rebofiles/documents`,
      env: { PORT: '5187', REBOFILES_STORAGE: DOCUMENTS_STORAGE },
      url: DOCUMENTS,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
