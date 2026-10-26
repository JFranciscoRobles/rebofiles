// The backend against a real bucket: the bytes there, as `.env` says, and the
// entries in `storage/bucket.sqlite` at the root of the repository, apart from
// the playground's. Delete that file to start over; what it named stays in the
// bucket until deleted there.
//
// No one signs in and everyone may do everything, as in the playground: it is
// for trying a bucket from this computer, not for a site.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDriveHandler, everyone, s3OptionsFrom, s3Storage, sqliteMetadata } from '@rebofiles/server';

const ENV = resolve(import.meta.dirname, '../.env');
if (!existsSync(ENV)) throw new Error('No apps/storage/.env yet: copy .env.example beside it and fill it in.');
process.loadEnvFile(ENV);

const STORAGE = resolve(import.meta.dirname, '../../../storage');
mkdirSync(STORAGE, { recursive: true });

// The secret of `.env`, or one made once and kept, so tokens of an upload begun before a restart still work after it.
const secretFile = resolve(STORAGE, 'bucket-secret');
if (!process.env.REBOFILES_SECRET && !existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = process.env.REBOFILES_SECRET || readFileSync(secretFile, 'utf8');

export const storage = s3Storage(s3OptionsFrom(process.env));

export const handle = createDriveHandler({
  storage,
  metadata: await sqliteMetadata(resolve(STORAGE, 'bucket.sqlite')),
  ...everyone(process.env.USER || 'me'),
  secret,
  base: '/api/files',
});
