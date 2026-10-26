// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('drive', {
  entries: { index: 'src/index.ts', rebodocs: 'src/rebodocs.ts' },
  exports: { '.': 'index', './rebodocs': 'rebodocs' },
  keywords: ['files', 'drive', 'file-manager', 'vanilla', 'uploads', 'docx'],
  homepage: 'https://rebofiles.com',
});
