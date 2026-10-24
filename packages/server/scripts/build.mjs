// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('server', {
  entries: { index: 'src/index.ts' },
  exports: { '.': 'index' },
  node: true,
  keywords: ['files', 'drive', 's3', 'r2', 'uploads', 'signed-urls', 'file-manager'],
  homepage: 'https://rebofiles.com',
});
