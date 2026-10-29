// Links ReboSlides' and Rebosheets' engines into node_modules from their
// repositories beside this one (../slides, ../sheets), for the formats of
// `@rebofiles/drive/reboslides` and `@rebofiles/drive/rebosheets`. They are
// not on npm: their sources are used as they are, each with its own
// dependencies, from where it is. Again after each `npm install`, which
// takes away what it did not put.
//
//   npm run link-engines

import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LINKS = {
  '@reboslides/core': '../slides/packages/core',
  '@reboslides/viewer': '../slides/packages/viewer',
  '@rebosheets/viewer': '../sheets/packages/viewer',
};

for (const [name, from] of Object.entries(LINKS)) {
  const source = resolve(root, from);
  if (!existsSync(join(source, 'package.json'))) {
    console.warn(`${name}: not found at ${source}; left out.`);
    continue;
  }
  if (!existsSync(resolve(source, '../../node_modules'))) console.warn(`${name}: run npm install in ${resolve(source, '../..')} first.`);
  const target = join(root, 'node_modules', name);
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) rmSync(target, { recursive: true, force: true });
  symlinkSync(relative(dirname(target), source), target, 'dir');
  console.log(`${name} → ${from}`);
}
