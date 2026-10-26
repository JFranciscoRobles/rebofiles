// The backend as the playground runs it: the bytes in `storage/files` and the
// entries in `storage/drive.sqlite`, at the root of the repository, which git
// leaves out. Delete the folder to start over.
//
// No one signs in: whoever the page says it is (`?as=bea` in its address, the
// user of this computer unless said) is who asks, for trying sharing with two
// people. It is for this computer only. What each may do is `byRoles`, from
// the drive itself; a site gives `identify` of its own.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMcpHandler } from '@rebofiles/mcp';
import { byRoles, createDriveHandler, diskStorage, sqliteMetadata } from '@rebofiles/server';

// `REBOFILES_STORAGE` puts it elsewhere, as the tests in Chrome do, to start from nothing.
const STORAGE = resolve(process.env.REBOFILES_STORAGE || resolve(import.meta.dirname, '../../../storage'));
mkdirSync(STORAGE, { recursive: true });

// A secret made once and kept beside the files, so addresses signed before a restart still work after it.
const secretFile = resolve(STORAGE, 'secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = readFileSync(secretFile, 'utf8');

export const handle = createDriveHandler({
  storage: diskStorage({ folder: resolve(STORAGE, 'files'), secret, label: 'disk:storage/files' }),
  metadata: await sqliteMetadata(resolve(STORAGE, 'drive.sqlite')),
  // The one of this machine may configure the drive; whoever `?as=` names may not.
  identify: (request) => ({ id: request.headers.get('x-user') || process.env.USER || 'me', admin: !request.headers.get('x-user') }),
  authorize: byRoles,
  secret,
  base: '/api/files',
  // Where an application would send a mail.
  onShare: ({ entry, with: who, role, by, first }) => console.log(`${by.id} ${first ? 'shared' : 'changed'} “${entry.name}” with ${who} as ${role}`),
});

// The tools for an assistant, at /api/mcp, asking the routes above in this process as the person `x-user`
// says, as the page does: `claude mcp add --transport http rebofiles http://localhost:5180/api/mcp`.
export const mcp = createMcpHandler({
  base: 'http://playground.local/api/files',
  fetch: (input, init) => handle(new Request(String(input), init)),
  headers: (request): Record<string, string> => (request.headers.get('x-user') ? { 'x-user': request.headers.get('x-user')! } : {}),
});
