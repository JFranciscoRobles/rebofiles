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
          include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
