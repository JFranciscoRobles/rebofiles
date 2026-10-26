// Who asks, for trying an example on your computer: whoever the header
// `x-user` says, or `me`. Anyone can say anything here, so it refuses to run
// in production: use one of the others in this folder, or your own.

import type { User } from '@rebofiles/server';

export function identify(request: Request): User | null {
  if (process.env.NODE_ENV === 'production') throw new Error('examples/auth/dev.ts lets anyone be anyone: not in production.');
  return { id: request.headers.get('x-user') || 'me' };
}
