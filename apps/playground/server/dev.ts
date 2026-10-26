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
  identify: (request) => ({ id: request.headers.get('x-user') || process.env.USER || 'me' }),
  authorize: byRoles,
  secret,
  base: '/api/files',
});
