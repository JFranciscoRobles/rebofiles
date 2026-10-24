// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('core', {
  entries: { index: 'src/index.ts' },
  exports: { '.': 'index' },
  keywords: ['files', 'drive', 'file-manager', 'folders', 'trash', 'versions'],
  homepage: 'https://rebofiles.com',
});
