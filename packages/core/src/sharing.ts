// Who may do what to an entry: its owner everything, and those it is shared
// with as their role says, on it and on everything inside it. The owner of a
// folder owns what is in it as far as access goes, whoever put it there.
// Links read an entry without signing in, until they expire or are removed.

import { DriveError } from './errors';
import type { Context, Drive, Entry, EntryId, Link, Role, Share } from './model';
import { getEntry, isTrashed } from './tree';

/** Shared with this, an entry is shared with everyone signed in. */
export const EVERYONE = '*';

/** What may be done to an entry, as a server asks it. */
/** What may be done: to an entry, or for `configure`, to the settings of the whole drive, asked with no entry. */
export type Action = 'list' | 'read' | 'download' | 'comment' | 'create' | 'upload' | 'rename' | 'move' | 'trash' | 'restore' | 'delete' | 'share' | 'configure';

/** What someone has of an entry: a role, or all of it as its owner. */
export type Access = Role | 'owner';

const RANK: Record<Access, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 };

/** The least access each action needs. */
const NEEDS: Record<Action, Access> = {
  list: 'viewer',
  read: 'viewer',
  download: 'viewer',
  comment: 'commenter',
  create: 'editor',
  upload: 'editor',
  rename: 'editor',
  move: 'editor',
  trash: 'editor',
  restore: 'editor',
  delete: 'owner',
  share: 'owner',
  configure: 'owner',
};

export const allows = (access: Access | null, action: Action): boolean => access !== null && RANK[access] >= RANK[NEEDS[action]];

const shareFor = (entry: Entry, user: string): Share | undefined => {
  let best: Share | undefined;
  for (const share of entry.shares ?? []) if ((share.with === user || share.with === EVERYONE) && (!best || RANK[share.role] > RANK[best.role])) best = share;
  return best;
};

/** What `user` has of an entry, from it and the folders it is in; null for nothing. */
export function accessOf(drive: Drive, id: EntryId, user: string): Access | null {
  let found: Access | null = null;
  for (let at: EntryId | null = id; at !== null; ) {
    const entry = getEntry(drive, at);
    if (entry.owner === user) return 'owner';
    const share = shareFor(entry, user);
    if (share && (!found || RANK[share.role] > RANK[found])) found = share.role;
    at = entry.parent;
  }
  return found;
}

/** Shared with `user` (or with everyone) or given a new role, outside the trash. Not with its owner, who has it all. */
export function share(drive: Drive, id: EntryId, user: string, role: Role, context: Context): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (!user.trim()) throw new DriveError('invalid-share', 'Say who to share it with');
  if (!(role in RANK) || role === ('owner' as Role)) throw new DriveError('invalid-share', `"${role}" is not a role`);
  if (user === entry.owner) throw new DriveError('invalid-share', `${user} owns ${entry.name}`);
  const shares = (entry.shares ?? []).filter((s) => s.with !== user);
  return put(drive, { ...entry, shares: [...shares, { with: user, role, by: context.by, at: context.at }] });
}

/** No longer shared with `user`. What they have through a folder above it stays. */
export function unshare(drive: Drive, id: EntryId, user: string): Drive {
  const entry = getEntry(drive, id);
  if (!entry.shares?.some((s) => s.with === user)) return drive;
  const shares = entry.shares.filter((s) => s.with !== user);
  const { shares: _, ...rest } = entry;
  return put(drive, (shares.length ? { ...rest, shares } : rest) as Entry);
}

/**
 * What is shared with `user` and is not theirs, outside the trash, the latest shared first: each entry where it was
 * shared with them, not what is inside it, nor what they reach already through a folder above.
 */
export function sharedWith(drive: Drive, user: string): Entry[] {
  const found: { entry: Entry; at: string }[] = [];
  for (const entry of drive.entries.values()) {
    const share = shareFor(entry, user);
    if (!share || accessOf(drive, entry.id, user) === 'owner' || isTrashed(drive, entry.id)) continue;
    if (entry.parent !== null && accessOf(drive, entry.parent, user) !== null) continue;
    found.push({ entry, at: share.at });
  }
  return found.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map(({ entry }) => entry);
}

/** Of what is shared with `user`, what was shared with them after `since`, or all of it when never looked at: news to show them. */
export function sharedSince(drive: Drive, user: string, since: string | undefined): Entry[] {
  return sharedWith(drive, user).filter((entry) => (entry.shares ?? []).some((s) => (s.with === user || s.with === EVERYONE) && s.by !== user && (since === undefined || s.at > since)));
}

/** A link to read an entry, and what is inside it, until `expires`. */
export function addLink(drive: Drive, id: EntryId, link: { id: string; expires: string; locked?: boolean; uses?: number }, context: Context): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (!(link.expires > context.at)) throw new DriveError('invalid-share', 'A link has to expire after it is made');
  if (entry.links?.some((l) => l.id === link.id)) throw new DriveError('duplicate-id', `There is already a link ${link.id}`);
  if (link.uses !== undefined && !(Number.isInteger(link.uses) && link.uses >= 1)) throw new DriveError('invalid-share', 'A link is used once or more');
  const made: Link = { id: link.id, role: 'viewer', expires: link.expires, by: context.by, at: context.at, ...(link.locked ? { locked: true } : {}), ...(link.uses ? { uses: link.uses } : {}) };
  return put(drive, { ...entry, links: [...(entry.links ?? []), made] });
}

export function removeLink(drive: Drive, id: EntryId, linkId: string): Drive {
  const entry = getEntry(drive, id);
  if (!entry.links?.some((l) => l.id === linkId)) return drive;
  const links = entry.links.filter((l) => l.id !== linkId);
  const { links: _, ...rest } = entry;
  return put(drive, (links.length ? { ...rest, links } : rest) as Entry);
}

/** How long a link whose uses are all taken still works: for the files of the download that took the last, an archive's many among them. */
export const LINK_GRACE = 15 * 60_000;

/** The entry a link reads, while it is there, has not expired, has uses left (or took its last a moment ago) and is not in the trash; null otherwise. */
export function linked(drive: Drive, linkId: string, now: string): Entry | null {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (link) return link.expires > now && !linkSpent(link, now) && !isTrashed(drive, entry.id) ? entry : null;
  }
  return null;
}

/** Whether a link has had all its uses, and the while after the last is over. */
export const linkSpent = (link: Link, now: string) => link.uses !== undefined && (link.used ?? 0) >= link.uses && (!link.spent || Date.parse(link.spent) + LINK_GRACE <= Date.parse(now));

/** The link itself, of the entry it is on. */
export function linkOf(drive: Drive, linkId: string): Link | undefined {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (link) return link;
  }
  return undefined;
}

/** A link used once more, at `at`: what it reads downloaded through it. Its last use marks when; past that, using it changes nothing. */
export function useLink(drive: Drive, linkId: string, at: string): Drive {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (!link) continue;
    if (link.uses === undefined || (link.used ?? 0) >= link.uses) return drive;
    const used = (link.used ?? 0) + 1;
    const next: Link = { ...link, used, ...(used >= link.uses ? { spent: at } : {}) };
    return put(drive, { ...entry, links: entry.links!.map((l) => (l.id === linkId ? next : l)) });
  }
  return drive;
}

const put = (drive: Drive, entry: Entry): Drive => ({ entries: new Map(drive.entries).set(entry.id, entry) });
