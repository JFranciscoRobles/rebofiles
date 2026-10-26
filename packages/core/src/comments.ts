// Comments on a file or a folder: what is said of it, by whom, a reply under
// another, resolved once it is dealt with. They are kept apart from the drive,
// as its activity is, by the server's store: an entry has none of them in it.

import { DriveError } from './errors';
import type { EntryId } from './model';

export interface Comment {
  id: string;
  entry: EntryId;
  by: string;
  /** ISO 8601. */
  at: string;
  text: string;
  /** The comment this one answers; a reply has no replies of its own, it goes under the same one. */
  replyTo?: string;
  /** When its author last changed its text. */
  edited?: string;
  /** Dealt with: by whom, when. Of a comment that starts a thread, the whole thread. */
  resolved?: { by: string; at: string };
}

/** The most characters a comment has. */
export const COMMENT_LENGTH = 5000;

/** Its text, trimmed, refused when there is none or too much. */
export function commentText(text: unknown): string {
  const said = typeof text === 'string' ? text.trim() : '';
  if (!said) throw new DriveError('invalid-comment', 'Say something in it.');
  if (said.length > COMMENT_LENGTH) throw new DriveError('invalid-comment', `A comment has ${COMMENT_LENGTH} characters at most.`);
  return said;
}

/** Who a comment names with an @, as `@bea` or `@ana.lopez`: to tell them. */
export const mentionsOf = (text: string): string[] => [...new Set([...text.matchAll(/(?:^|[^\w@])@([\w][\w.-]*[\w]|[\w])/g)].map((m) => m[1]))];

/** In the order they are read: each thread by its first comment, the oldest first, its replies under it. */
export function threads(comments: readonly Comment[]): Comment[] {
  const byTime = [...comments].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const tops = byTime.filter((c) => !c.replyTo || !comments.some((o) => o.id === c.replyTo));
  return tops.flatMap((top) => [top, ...byTime.filter((c) => c.replyTo === top.id)]);
}
