import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Plain files, to put on any host: the site has nothing to run on a server.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // The packages are in the same repository, two folders up, as TypeScript.
  turbopack: { root: path.join(import.meta.dirname, '../..') },
  transpilePackages: ['@rebofiles/core', '@rebofiles/react'],
};

export default config;
