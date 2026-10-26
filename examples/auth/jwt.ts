// Who asks, from a token your application signs itself (a JWT), in a cookie
// or as `Authorization: Bearer`: checked with `jose`, the subject is the user.
// For an application with its own sign-in, and for the desktop application.

import type { User } from '@rebofiles/server';
import { jwtVerify } from 'jose';

const key = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function identify(request: Request): Promise<User | null> {
  const bearer = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  const cookie = /(?:^|;\s*)session=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
  const token = bearer ?? cookie;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload.sub ? { id: payload.sub, admin: payload.role === 'admin' } : null;
  } catch {
    return null;
  }
}
