// The drive every example serves, the same in each: the bytes in a bucket when
// S3_BUCKET says one (R2, S3, MinIO), else in a folder of the disk; the
// entries in SQLite. Who asks is your session's: `identify` comes from
// `auth/`, and what each may do is `byRoles`, from the drive itself.

import { mkdirSync } from 'node:fs';
import { type DriveServerOptions, byRoles, createDriveHandler, diskStorage, s3OptionsFrom, s3Storage, sqliteMetadata } from '@rebofiles/server';

/** Long and random, the same in every process: `openssl rand -hex 32`. */
const secret = process.env.REBOFILES_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'a secret for this computer only');
if (!secret) throw new Error('Set REBOFILES_SECRET: long, random, the same in every process.');

export async function createDrive(identify: DriveServerOptions['identify'], extra: Partial<DriveServerOptions> = {}) {
  const folder = process.env.REBOFILES_FOLDER ?? './storage';
  mkdirSync(folder, { recursive: true });
  return createDriveHandler({
    storage: process.env.S3_BUCKET ? s3Storage(s3OptionsFrom()) : diskStorage({ folder: `${folder}/files`, secret: secret! }),
    metadata: await sqliteMetadata(`${folder}/drive.sqlite`),
    identify,
    authorize: byRoles,
    secret: secret!,
    base: '/api/files',
    ...extra,
  });
}
