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

/** The words of a query as they are looked for in a text: without case or accents, letters and digits only. */
export const wordsOf = (query: string): string[] =>
  fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** How much of a text is shown around what was found in it, on each side. */
const AROUND = 60;

/**
 * Whether a text has every word of the query in it, as `search` finds them in a name; and if so, a piece of it
 * around the first of them, from the text as it is, with an ellipsis where it was cut. Null when not.
 */
export function textMatch(text: string, query: string): { snippet: string } | null {
  const words = wordsOf(query);
  if (!words.length) return null;
  // The text folded, and where each of its characters came from in the text as it is.
  let folded = '';
  const from: number[] = [];
  for (let i = 0; i < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const made = fold(char);
    folded += made;
    for (let k = 0; k < made.length; k++) from.push(i);
    i += char.length;
  }
  const at = words.map((word) => folded.indexOf(word));
  if (at.some((i) => i < 0)) return null;
  const first = Math.min(...at);
  const start = from[first];
  const end = from[first + words[at.indexOf(first)].length - 1] + 1;
  let from0 = Math.max(0, start - AROUND);
  let to = Math.min(text.length, end + AROUND);
  // Whole words at the edges.
  if (from0 > 0) from0 = text.indexOf(' ', from0) + 1 || from0;
  if (to < text.length) to = text.lastIndexOf(' ', to) > end ? text.lastIndexOf(' ', to) : to;
  const piece = text.slice(from0, to).replace(/\s+/g, ' ').trim();
  return { snippet: `${from0 > 0 ? '…' : ''}${piece}${to < text.length ? '…' : ''}` };
}
