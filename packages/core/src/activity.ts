// What was done in a drive, told from two drives: the one before a change and
// the one after. Every operation of core shows in what it changed, so the
// activity is read from that rather than from each operation, and whatever
// changed the drive (a route, an assistant, a sweep of the trash) is in it.

import type { Drive, Entry, EntryId, Role } from './model';

export type ActivityAction =
  | 'created'
  | 'uploaded'
  | 'version'
  | 'renamed'
  | 'moved'
  | 'trashed'
  | 'restored'
  | 'deleted'
  | 'shared'
  | 'unshared'
  | 'linked'
  | 'unlinked'
  | 'colored'
  | 'commented'
  | 'held'
  | 'released';

export interface Activity {
  /** ISO 8601. */
  at: string;
  by: string;
  action: ActivityAction;
  entry: EntryId;
  /** Its name then, as a deleted one has no other. */
  name: string;
  kind: Entry['kind'];
  /** The folder it is in; for one moved, the folder it went to. */
  parent: EntryId | null;
  /** For one moved, the folder it left. */
  from?: EntryId | null;
  /** The name before, for one renamed. */
  was?: string;
  /** Who, and as what, for one shared or no longer. */
  with?: string;
  role?: Role;
}

/** What `by` did at `at`, from the drive before to the drive after: one line for each thing, the newest last. */
export function activityOf(before: Drive, after: Drive, by: string, at: string): Activity[] {
  const done: Activity[] = [];
  const line = (entry: Entry, action: ActivityAction, more: Partial<Activity> = {}) =>
    done.push({ at, by, action, entry: entry.id, name: entry.name, kind: entry.kind, parent: entry.parent, ...more });

  for (const [id, now] of after.entries) {
    const was = before.entries.get(id);
    if (was === now) continue;
    if (!was) {
      line(now, now.kind === 'file' ? 'uploaded' : 'created');
      continue;
    }
    if (was.name !== now.name) line(now, 'renamed', { was: was.name });
    if (was.parent !== now.parent) line(now, 'moved', { from: was.parent });
    if (was.kind === 'folder' && now.kind === 'folder' && was.color !== now.color) line(now, 'colored');
    if (!was.hold && now.hold) line(now, 'held');
    if (was.hold && !now.hold) line(now, 'released');
    if (!was.trashed && now.trashed) line(now, 'trashed');
    if (was.trashed && !now.trashed) line(now, 'restored');
    if (was.kind === 'file' && now.kind === 'file' && now.versions[0].id !== was.versions[0].id) line(now, 'version');
    for (const share of now.shares ?? []) {
      const had = was.shares?.find((s) => s.with === share.with);
      if (!had || had.role !== share.role) line(now, 'shared', { with: share.with, role: share.role });
    }
    for (const share of was.shares ?? []) if (!now.shares?.some((s) => s.with === share.with)) line(now, 'unshared', { with: share.with });
    for (const link of now.links ?? []) if (!was.links?.some((l) => l.id === link.id)) line(now, 'linked');
    for (const link of was.links ?? []) if (!now.links?.some((l) => l.id === link.id)) line(now, 'unlinked');
  }
  // What was deleted for good: only the top of each, what was inside it going with it.
  for (const [id, was] of before.entries) {
    if (after.entries.has(id) || (was.parent !== null && !after.entries.has(was.parent) && before.entries.has(was.parent))) continue;
    line(was, 'deleted');
  }
  return done;
}

/** Of the activity given, that of an entry: what was done to it, and, of a folder, to what is right inside it. */
export const activityFor = (all: readonly Activity[], id: EntryId): Activity[] => all.filter((a) => a.entry === id || a.parent === id || a.from === id);
