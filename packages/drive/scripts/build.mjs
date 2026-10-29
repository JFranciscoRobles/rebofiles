// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('drive', {
  entries: { index: 'src/index.ts', rebodocs: 'src/rebodocs.ts', reboslides: 'src/reboslides.ts', rebosheets: 'src/rebosheets.ts' },
  exports: { '.': 'index', './rebodocs': 'rebodocs', './reboslides': 'reboslides', './rebosheets': 'rebosheets' },
  keywords: ['files', 'drive', 'file-manager', 'vanilla', 'uploads', 'docx'],
  homepage: 'https://rebofiles.com',
});
