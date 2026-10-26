// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('mcp', {
  entries: { index: 'src/index.ts', bin: 'src/bin.ts' },
  exports: { '.': 'index' },
  bin: { 'rebofiles-mcp': 'bin' },
  node: true,
  keywords: ['mcp', 'model-context-protocol', 'ai', 'assistant', 'claude', 'files', 'drive'],
  homepage: 'https://rebofiles.com',
});
