// `rebofiles-mcp`: the tools over stdio, for an assistant on this computer.
//
//   rebofiles-mcp --base https://acme.com/api/files --header "Authorization: Bearer …"
//
// Or from the environment: REBOFILES_URL for the base, REBOFILES_TOKEN for a
// bearer token. The token is the person's: the assistant does what they may.

import { serveStdio } from './stdio';

export function parseArgs(argv: string[], env: Record<string, string | undefined>): { base: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  let base = env.REBOFILES_URL ?? '';
  if (env.REBOFILES_TOKEN) headers.authorization = `Bearer ${env.REBOFILES_TOKEN}`;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') base = argv[++i] ?? '';
    else if (argv[i] === '--header') {
      const [name, ...value] = (argv[++i] ?? '').split(':');
      if (name && value.length) headers[name.trim().toLowerCase()] = value.join(':').trim();
    }
  }
  if (!/^https?:\/\//.test(base)) throw new Error('Say where the drive is: --base https://…/api/files, or REBOFILES_URL.');
  return { base, headers };
}

// Run as the command, not when a test imports it.
if (process.argv[1] && /rebofiles-mcp|bin\.(ts|js)$/.test(process.argv[1])) {
  try {
    const { base, headers } = parseArgs(process.argv.slice(2), process.env);
    await serveStdio({ base, headers: () => headers });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}
