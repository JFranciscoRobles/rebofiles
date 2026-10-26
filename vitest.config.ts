// The tests. `node` is every test of the packages and the demos, as `npm test`
// runs them. A `browser` set, driving the drive in Chrome as Rebodocs drives
// its editor, comes with packages/drive.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.{ts,tsx}', 'apps/*/test/**/*.test.ts', 'examples/test/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
          // Postgres in the process (PGlite) is slow to start when the machine is busy, as with a build of Rust beside.
          testTimeout: 20_000,
        },
      },
    ],
  },
});
