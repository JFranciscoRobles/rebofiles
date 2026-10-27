// Who may do what to an entry: its owner everything, and those it is shared
// with as their role says, on it and on everything inside it. The owner of a
// folder owns what is in it as far as access goes, whoever put it there.
// Links read an entry without signing in, until they expire or are removed.

import type { FileRequest } from './requests';
import { DriveError } from './errors';
import type { Context, Drive, Entry, EntryId, Link, Role, Share } from './model';
import { getEntry, isTrashed } from './tree';

/** Shared with this, an entry is shared with everyone signed in. */
export const EVERYONE = '*';

/**
 * Shared with `group:<id>`, an entry is shared with everyone the application says is in that group: who is in each
 * is the application's, given with each person (`User.groups` of the server), not kept in the drive.
 */
export const GROUP = 'group:';
export const groupOf = (id: string) => `${GROUP}${id}`;
export const isGroup = (who: string) => who.startsWith(GROUP);

/** Someone, and the groups they are in: a plain id is someone in none. */
export type Who = string | { id: string; groups?: readonly string[] };
const idOf = (who: Who) => (typeof who === 'string' ? who : who.id);
/** The names a share may give to reach someone: their id, everyone, and each of their groups. */
export const shareNamesOf = (who: Who): string[] => [...namesOf(who)];
const namesOf = (who: Who): Set<string> => new Set([idOf(who), EVERYONE, ...(typeof who === 'string' ? [] : (who.groups ?? []).map(groupOf))]);

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

/** Whether a share still gives what it says: one with an end has not reached it. */
export const shareHolds = (share: Share, now = new Date().toISOString()): boolean => share.until === undefined || share.until > now;

const shareFor = (entry: Entry, names: Set<string>): Share | undefined => {
  let best: Share | undefined;
  const now = new Date().toISOString();
  for (const share of entry.shares ?? []) if (names.has(share.with) && shareHolds(share, now) && (!best || RANK[share.role] > RANK[best.role])) best = share;
  return best;
};

/** What someone has of an entry, from it and the folders it is in, as themselves or through their groups; null for nothing. */
export function accessOf(drive: Drive, id: EntryId, who: Who): Access | null {
  const user = idOf(who);
  const names = namesOf(who);
  let found: Access | null = null;
  for (let at: EntryId | null = id; at !== null; ) {
    const entry = getEntry(drive, at);
    if (entry.owner === user) return 'owner';
    const share = shareFor(entry, names);
    if (share && (!found || RANK[share.role] > RANK[found])) found = share.role;
    at = entry.parent;
  }
  return found;
}

/**
 * Shared with `user` (or with everyone) or given a new role, outside the trash: `until` a time after now, for good
 * with null, or as it was shared before when left out. Not with its owner, who has it all.
 */
export function share(drive: Drive, id: EntryId, user: string, role: Role, context: Context, until?: string | null): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (!user.trim()) throw new DriveError('invalid-share', 'Say who to share it with');
  if (!(role in RANK) || role === ('owner' as Role)) throw new DriveError('invalid-share', `"${role}" is not a role`);
  if (user === entry.owner) throw new DriveError('invalid-share', `${user} owns ${entry.name}`);
  if (typeof until === 'string' ? Number.isNaN(Date.parse(until)) || until <= context.at : until !== undefined && until !== null)
    throw new DriveError('invalid-share', 'A share ends after it is made');
  const before = entry.shares?.find((s) => s.with === user);
  const ends = until === undefined ? before?.until : (until ?? undefined);
  const shares = (entry.shares ?? []).filter((s) => s.with !== user);
  return put(drive, { ...entry, shares: [...shares, { with: user, role, by: context.by, at: context.at, ...(ends ? { until: ends } : {}) }] });
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
export function sharedWith(drive: Drive, who: Who): Entry[] {
  const names = namesOf(who);
  const found: { entry: Entry; at: string }[] = [];
  for (const entry of drive.entries.values()) {
    const share = shareFor(entry, names);
    if (!share || accessOf(drive, entry.id, who) === 'owner' || isTrashed(drive, entry.id)) continue;
    if (entry.parent !== null && accessOf(drive, entry.parent, who) !== null) continue;
    found.push({ entry, at: share.at });
  }
  return found.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map(({ entry }) => entry);
}

/** Of what is shared with `user`, what was shared with them after `since`, or all of it when never looked at: news to show them. */
export function sharedSince(drive: Drive, who: Who, since: string | undefined): Entry[] {
  const names = namesOf(who);
  return sharedWith(drive, who).filter((entry) => (entry.shares ?? []).some((s) => names.has(s.with) && s.by !== idOf(who) && (since === undefined || s.at > since)));
}

/** A link to read an entry, and what is inside it, until `expires`. */
export function addLink(
  drive: Drive,
  id: EntryId,
  link: { id: string; expires: string; locked?: boolean; uses?: number; uploads?: 'also' | 'only'; request?: FileRequest; viewOnly?: boolean; watermark?: boolean },
  context: Context,
): Drive {
  const entry = getEntry(drive, id);
  if (isTrashed(drive, id)) throw new DriveError('in-trash', `${entry.name} is in the trash`);
  if (!(link.expires > context.at)) throw new DriveError('invalid-share', 'A link has to expire after it is made');
  if (entry.links?.some((l) => l.id === link.id)) throw new DriveError('duplicate-id', `There is already a link ${link.id}`);
  if (link.uses !== undefined && !(Number.isInteger(link.uses) && link.uses >= 1)) throw new DriveError('invalid-share', 'A link is used once or more');
  if (link.uploads !== undefined && (!['also', 'only'].includes(link.uploads) || entry.kind !== 'folder'))
    throw new DriveError('invalid-share', 'Files are put through a link of a folder, also or only');
  if ((link.viewOnly || link.watermark) && link.uploads === 'only') throw new DriveError('invalid-share', 'A request for files shows nothing to be seen');
  const made: Link = {
    id: link.id,
    role: 'viewer',
    expires: link.expires,
    by: context.by,
    at: context.at,
    ...(link.locked ? { locked: true } : {}),
    ...(link.uses ? { uses: link.uses } : {}),
    ...(link.uploads ? { uploads: link.uploads } : {}),
    ...(link.uploads && link.request && Object.keys(link.request).length ? { request: link.request } : {}),
    ...(link.viewOnly ? { viewOnly: true } : {}),
    ...(link.watermark ? { watermark: true } : {}),
  };
  return put(drive, { ...entry, links: [...(entry.links ?? []), made] });
}

/** How many of who opened a link are kept on it, the last. */
export const LINK_VIEWS = 50;

/** A link opened by someone, as they said they are called: kept, the last 50; the same name within the hour once. */
export function viewedLink(drive: Drive, linkId: string, name: string, at: string): Drive {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (!link) continue;
    const last = link.views?.[link.views.length - 1];
    if (last && last.name === name && Date.parse(at) - Date.parse(last.at) < 3_600_000) return drive;
    const next: Link = { ...link, views: [...(link.views ?? []), { name, at }].slice(-LINK_VIEWS) };
    return put(drive, { ...entry, links: entry.links!.map((l) => (l.id === linkId ? next : l)) });
  }
  return drive;
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
    if (link) return link.expires > now && !link.closed && !linkSpent(link, now) && !isTrashed(drive, entry.id) ? entry : null;
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
