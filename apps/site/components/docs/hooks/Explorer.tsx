// The explorer as a page puts it: the code of each demo read from its file
// and coloured when the site is built, so what is shown is what runs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { highlight } from '@/lib/highlight';
import { HOOKS } from './hooks';
import { HooksExplorer } from './HooksExplorer';

const exampleOf = (name: string) =>
  readFileSync(join(process.cwd(), 'components/docs/hooks/examples', `${name}.tsx`), 'utf8')
    .replace(/^'use client';\n\n/, '')
    .replace(/^ *\/\/ biome-ignore[^\n]*\n/gm, '');

export async function HookExplorer() {
  const examples = Object.fromEntries(await Promise.all(HOOKS.map(async (hook) => [hook.name, await highlight(exampleOf(hook.name), 'tsx')] as const)));
  return <HooksExplorer examples={examples} />;
}
