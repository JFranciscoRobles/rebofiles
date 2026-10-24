// The backend as the playground runs it: the bytes in `storage/files` and the
// entries in `storage/drive.sqlite`, at the root of the repository, which git
// leaves out. Delete the folder to start over.
//
// No one signs in and everyone may do everything: it is for this computer
// only. A site gives `identify` and `authorize` of its own.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDriveHandler, diskStorage, everyone, sqliteMetadata } from '@rebofiles/server';

const STORAGE = resolve(import.meta.dirname, '../../../storage');
mkdirSync(STORAGE, { recursive: true });

// A secret made once and kept beside the files, so addresses signed before a restart still work after it.
const secretFile = resolve(STORAGE, 'secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = readFileSync(secretFile, 'utf8');

export const handle = createDriveHandler({
  storage: diskStorage({ folder: resolve(STORAGE, 'files'), secret, label: 'disk:storage/files' }),
  metadata: await sqliteMetadata(resolve(STORAGE, 'drive.sqlite')),
  ...everyone(process.env.USER || 'me'),
  secret,
  base: '/api/files',
});
