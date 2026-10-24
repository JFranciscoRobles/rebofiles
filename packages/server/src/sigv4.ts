// Addresses signed for S3, by AWS's Signature Version 4 with the signature in
// the query: what the SDK's presigner makes, without the SDK. Every call the
// server makes to the bucket goes through one of these too, so this is the
// only place that sees the secret.

import { createHash, createHmac } from 'node:crypto';

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface Presign {
  method: string;
  /** The whole address, bucket and key in it, without the signature. */
  url: string;
  /** Seconds it is good for, at most a week. */
  expires: number;
  /** Headers the one using it must send exactly as given, such as `content-length` or `content-type`. */
  headers?: Record<string, string>;
  /** When it is signed; now unless a test says otherwise. */
  at?: Date;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const hmac = (key: Buffer | string, text: string) => createHmac('sha256', key).update(text, 'utf8').digest();

/** Encoded as S3 asks: everything but letters, digits and `-._~`, and `/` too unless it separates a path. */
export const encode = (text: string, slash = true): string =>
  encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(slash ? /(?!)/ : /%2F/g, '/');

export function presign(credentials: Credentials, request: Presign): string {
  const url = new URL(request.url);
  const at = (request.at ?? new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = at.slice(0, 8);
  const scope = `${day}/${credentials.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host: url.host };
  for (const [name, value] of Object.entries(request.headers ?? {})) headers[name.toLowerCase()] = value.trim();
  const signed = Object.keys(headers).sort();

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${credentials.accessKeyId}/${scope}`);
  url.searchParams.set('X-Amz-Date', at);
  url.searchParams.set('X-Amz-Expires', String(request.expires));
  url.searchParams.set('X-Amz-SignedHeaders', signed.join(';'));
  const query = [...url.searchParams]
    .map(([name, value]) => [encode(name), encode(value)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
  const path = encode(decodeURIComponent(url.pathname), false);
  const canonical = [request.method, path, query, ...signed.map((name) => `${name}:${headers[name]}`), '', signed.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', at, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), credentials.region), 's3'), 'aws4_request');
  return `${url.origin}${path}?${query}&X-Amz-Signature=${createHmac('sha256', key).update(toSign, 'utf8').digest('hex')}`;
}
