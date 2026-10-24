// What changed between two drives, for a metadata store to write only that.
// Operations keep the entries they do not touch, so a change is a different
// reference.

import type { Drive, Entry, EntryId } from './model';

export interface Changes {
  put: Entry[];
  removed: EntryId[];
}

export function changes(before: Drive, after: Drive): Changes {
  const put: Entry[] = [];
  const removed: EntryId[] = [];
  for (const [id, entry] of after.entries) if (before.entries.get(id) !== entry) put.push(entry);
  for (const id of before.entries.keys()) if (!after.entries.has(id)) removed.push(id);
  return { put, removed };
}
