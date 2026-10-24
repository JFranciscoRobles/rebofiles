// Names of entries: which are allowed, when two are the same, and the next
// free one in a folder ("contract (2).docx").

import { DriveError } from './errors';
import type { Drive, EntryId } from './model';

/** Why a name cannot be used, or null when it can. */
export type NameProblem = 'empty' | 'too-long' | 'dot' | 'slash' | 'control' | 'spaces';

/**
 * Names are checked as the strictest system that may hold them would: a
 * folder synced to Windows or a Mac must take every name the drive has.
 */
export function nameProblem(name: string): NameProblem | null {
  if (name.length === 0 || name.trim().length === 0) return 'empty';
  if (new TextEncoder().encode(name).length > 255) return 'too-long';
  if (name === '.' || name === '..') return 'dot';
  if (/[/\\]/.test(name)) return 'slash';
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is refused
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'control';
  if (name !== name.trim()) return 'spaces';
  return null;
}

export function checkName(name: string): void {
  const problem = nameProblem(name);
  if (problem) throw new DriveError('invalid-name', `"${name}" cannot be a name (${problem})`);
}

/**
 * Two names are the same when they differ only in case or in how an accent is
 * written: the file systems of Windows and of a Mac would take them for one.
 */
export const sameName = (a: string, b: string): boolean => fold(a) === fold(b);

const fold = (name: string): string => name.normalize('NFC').toLowerCase();

/** The entry of `parent` named `name`, outside the trash; `except` is left out, for a rename. */
export function takenBy(drive: Drive, parent: EntryId | null, name: string, except?: EntryId): EntryId | null {
  for (const entry of drive.entries.values()) {
    if (entry.parent === parent && entry.id !== except && !entry.trashed && sameName(entry.name, name)) return entry.id;
  }
  return null;
}

/** `name` when it is free in `parent`; otherwise the first of "name (2).ext", "name (3).ext"… that is. */
export function uniqueName(drive: Drive, parent: EntryId | null, name: string, except?: EntryId): string {
  if (!takenBy(drive, parent, name, except)) return name;
  const { base, ext } = splitName(name);
  const numbered = /^(.*) \((\d+)\)$/.exec(base);
  const stem = numbered ? numbered[1] : base;
  for (let n = numbered ? Number(numbered[2]) + 1 : 2; ; n++) {
    const next = `${stem} (${n})${ext}`;
    if (!takenBy(drive, parent, next, except)) return next;
  }
}

/** "report.final.pdf" is "report.final" and ".pdf"; ".env" has no extension. */
export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' };
}
