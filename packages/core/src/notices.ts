// What a person is told in the drive itself: something shared with them, or
// they named in a comment. Kept for each person, and for each group, as the
// server is told who is in which with each request.

import type { EntryId, Role } from './model';

export interface Notice {
  id: string;
  /** Shared with them (or a group they are in), named with @ in a comment, or a file put in a folder of theirs through a link. */
  kind: 'shared' | 'mentioned' | 'received' | 'expiring';
  entry: EntryId;
  /** What the entry was called then. */
  name: string;
  by: string;
  at: string;
  /** Of a share: what they may do. */
  role?: Role;
  /** Of a comment: its beginning. */
  text?: string;
  /** Of a file that stops being good: the day it does. */
  expires?: string;
}

/** How many are kept for each, the newest; the older go. */
export const MAX_NOTICES = 200;

/** What was kept, as notices, leaving out anything else. */
export const noticesOf = (kept: unknown): Notice[] =>
  Array.isArray(kept) ? kept.filter((one): one is Notice => typeof one === 'object' && one !== null && typeof one.id === 'string' && typeof one.at === 'string') : [];
