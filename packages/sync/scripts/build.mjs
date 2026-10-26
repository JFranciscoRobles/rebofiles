// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('sync', {
  entries: { index: 'src/index.ts', engine: 'src/engine.ts', bin: 'src/bin.ts' },
  exports: { '.': 'index', './engine': 'engine' },
  bin: { 'rebofiles-sync': 'bin' },
  node: true,
  keywords: ['sync', 'files', 'drive', 'desktop', 'folder', 'backup'],
  homepage: 'https://rebofiles.com',
});
