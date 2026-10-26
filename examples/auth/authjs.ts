// Who asks, from Auth.js (NextAuth v5) in Next.js: the user of the session
// its cookie says. `auth` is what your `auth.ts` exports from NextAuth().
//
// The session has the user's id only when you put it there, in auth.ts:
//
//   callbacks: { session: ({ session, token }) => ({ ...session, user: { ...session.user, id: token.sub! } }) }
//
// (with a database adapter, `user.id` is there already).

import type { User } from '@rebofiles/server';
import { auth } from '@/auth';

export async function identify(): Promise<User | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id ? { id, admin: session.user?.email === process.env.DRIVE_ADMIN } : null;
}
