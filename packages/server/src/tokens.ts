// What the server hands out and takes back without keeping it: a value with
// an expiry, signed, so that it is not changed on the way.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function sealToken(secret: string, value: unknown, seconds: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ value, until: now + seconds * 1000 }), 'utf8').toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

/** The value sealed, or undefined when the token was changed or is out of date. */
export function openToken<T>(secret: string, token: string, now = Date.now()): T | undefined {
  const [body, signature] = token.split('.');
  if (!body || !signature) return undefined;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  const { value, until } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { value: T; until: number };
  return until >= now ? value : undefined;
}
