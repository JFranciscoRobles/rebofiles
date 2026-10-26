// Who asks, from Clerk, in any framework: the Request itself is what Clerk's
// backend reads, its session cookie or its `Authorization: Bearer` token
// (as the desktop application sends one). In Next.js, `auth()` of
// '@clerk/nextjs/server' says the same with less.

import { createClerkClient } from '@clerk/backend';
import type { User } from '@rebofiles/server';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY });

export async function identify(request: Request): Promise<User | null> {
  const state = await clerk.authenticateRequest(request, { authorizedParties: [process.env.APP_ORIGIN ?? 'http://localhost:3000'] });
  const { userId, orgRole } = state.toAuth() ?? {};
  return userId ? { id: userId, admin: orgRole === 'org:admin' } : null;
}
