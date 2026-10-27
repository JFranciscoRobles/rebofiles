// The bytes in Google Cloud Storage, through its XML API, which speaks S3:
// with an HMAC key of the bucket (Cloud Storage → Settings →
// Interoperability), the same addresses signed as for S3, uploads in parts
// and all. But for what that API does not do: a list of keys deleted in one
// request (each is, one at a time), and a part copied in the bucket (every
// part of a new version is sent).

import { type S3Options, s3Storage } from './s3';
import { presign } from './sigv4';
import type { Storage } from './storage';

export interface GcsOptions {
  bucket: string;
  /** The HMAC key's access id, `GOOG1…`. */
  accessKeyId: string;
  /** Its secret. */
  secretAccessKey: string;
  /** Before every key: `files/`. */
  prefix?: string;
  /** `https://storage.googleapis.com` unless said. */
  endpoint?: string;
  /** For tests: what makes the requests to the bucket. */
  fetch?: typeof fetch;
}

/** The same options, from `GCS_BUCKET`, `GCS_ACCESS_KEY_ID`, `GCS_SECRET_ACCESS_KEY` and `GCS_PREFIX`. */
export function gcsOptionsFrom(env: Record<string, string | undefined> = process.env): GcsOptions {
  const missing = ['GCS_BUCKET', 'GCS_ACCESS_KEY_ID', 'GCS_SECRET_ACCESS_KEY'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing in the environment: ${missing.join(', ')}.`);
  return { bucket: env.GCS_BUCKET!, accessKeyId: env.GCS_ACCESS_KEY_ID!, secretAccessKey: env.GCS_SECRET_ACCESS_KEY!, prefix: env.GCS_PREFIX || undefined };
}

export function gcsStorage(options: GcsOptions): Storage {
  const endpoint = (options.endpoint ?? 'https://storage.googleapis.com').replace(/\/$/, '');
  const s3: S3Options = { ...options, endpoint, region: 'auto' };
  // Copies made by the server, read and written: its XML API copies as it likes its own headers.
  const { copyPart: _, remove: __, copy: ___, ...rest } = s3Storage(s3);
  const credentials = { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey, region: 'auto' };
  const send = options.fetch ?? fetch;
  return {
    ...rest,
    label: `gs://${options.bucket}`,
    async remove(keys) {
      for (const key of keys) {
        const url = `${endpoint}/${options.bucket}/${(options.prefix ?? '') + key}`;
        const answer = await send(presign(credentials, { method: 'DELETE', url, expires: 60 }), { method: 'DELETE' });
        if (!answer.ok && answer.status !== 404) throw new Error(`The bucket answered ${answer.status} to DELETE: ${(await answer.text()).slice(0, 300)}`);
      }
    },
  };
}
