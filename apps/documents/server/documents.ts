// The backend of the documents' demo: the bytes in `storage/documents/files`
// and the entries in `storage/documents/drive.sqlite`, at the root of the
// repository, apart from the playground's. Delete the folder to start over.
//
// No one signs in: whoever the page says it is (`?as=bea`) is who asks, the
// one of this computer unless said. For this computer only. Documents are
// written by several at once through `collab.ts`.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byRoles, createDriveHandler, diskStorage, sqliteMetadata } from '@rebofiles/server';

// `REBOFILES_STORAGE` puts it elsewhere, as the tests do, to start from nothing.
const STORAGE = resolve(process.env.REBOFILES_STORAGE || resolve(import.meta.dirname, '../../../storage/documents'));
mkdirSync(STORAGE, { recursive: true });

// A secret made once and kept beside the files, so addresses signed before a restart still work after it.
const secretFile = resolve(STORAGE, 'secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = readFileSync(secretFile, 'utf8');

export const storage = diskStorage({ folder: resolve(STORAGE, 'files'), secret, label: 'disk:storage/documents/files' });
export const metadata = await sqliteMetadata(resolve(STORAGE, 'drive.sqlite'));
export { secret };

export const handle = createDriveHandler({
  storage,
  metadata,
  identify: (request) => ({ id: request.headers.get('x-user') || process.env.USER || 'me', admin: !request.headers.get('x-user') }),
  authorize: byRoles,
  secret,
  base: '/api/files',
});
