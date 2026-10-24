// Finding entries by name, as a person types it: without minding case or
// accents ("cancion" finds "Canción"), every word somewhere in the name.

import type { Drive, Entry, EntryId } from './model';
import { byName, isTrashed, isWithin } from './tree';

export interface SearchOptions {
  /** Only inside this folder. */
  within?: EntryId;
  /** In the trash instead of outside it. */
  trashed?: boolean;
  /** At most this many, the closest first. */
  limit?: number;
}

const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function search(drive: Drive, query: string, options: SearchOptions = {}): Entry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const found: { entry: Entry; score: number }[] = [];
  for (const entry of drive.entries.values()) {
    const name = fold(entry.name);
    if (!words.every((word) => name.includes(word))) continue;
    if (isTrashed(drive, entry.id) !== Boolean(options.trashed)) continue;
    if (options.within !== undefined && (entry.id === options.within || !isWithin(drive, entry.id, options.within))) continue;
    // A name that starts with what was typed comes before one that only has it inside.
    found.push({ entry, score: name.startsWith(words[0]) ? 0 : 1 });
  }
  found.sort((a, b) => a.score - b.score || byName(a.entry, b.entry));
  return found.slice(0, options.limit ?? found.length).map(({ entry }) => entry);
}
