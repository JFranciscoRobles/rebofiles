// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('react', {
  entries: { index: 'src/index.ts', rebodocs: 'src/rebodocs.ts' },
  exports: { '.': 'index', './rebodocs': 'rebodocs' },
  keywords: ['files', 'drive', 'file-manager', 'react', 'uploads', 'docx'],
  homepage: 'https://rebofiles.com',
});
