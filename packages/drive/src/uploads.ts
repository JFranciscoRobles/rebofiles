// Files going up, several at a time, each in parts: what has gone of each, how
// fast it is going and how long it has left, and the same for all of them.
// One can be stopped, and one that failed tried again from what arrived. What
// the drive's screen and React's useUploads both show.

import { type Entry, type EntryId, type FileEntry, sameName } from '@rebofiles/core';
import { type DriveClient, type UploadOptions, hashOf } from './client';

export interface UploadItem {
  id: number;
  name: string;
  size: number;
  /** Bytes gone so far. */
  sent: number;
  /** `checking` while it is looked for in the drive; `asking` while what to do with one there already is asked. */
  state: 'waiting' | 'checking' | 'asking' | 'sending' | 'done' | 'failed' | 'stopped' | 'skipped';
  error?: string;
  /** Bytes a second, as it has gone the last few seconds; while it is going. */
  speed?: number;
  /** Seconds it has left, at that speed; while it is going. */
  remaining?: number;
  /** The file in the drive, once it is up. */
  entry?: FileEntry;
  /** The folder it goes into. */
  parent: EntryId | null;
  /** What is there already: the same bytes somewhere (`same`), or a file of its name where it goes (`name`). */
  conflict?: Conflict;
  /** What was chosen for it: a new version of the one of its name, both kept, or not uploaded. */
  choice?: Choice;
}

export interface Conflict {
  kind: 'same' | 'name';
  entry: Entry;
}

/** For one of the same bytes: upload it anyway, or not. For one of the same name: a new version of it, both, or not. */
export type Choice = 'replace' | 'keep' | 'skip';

export interface UploadsSummary {
  /** Those going, those waiting their turn, those done, failed and stopped; those asked about, and those not uploaded. */
  sending: number;
  waiting: number;
  done: number;
  failed: number;
  stopped: number;
  asking: number;
  skipped: number;
  /** Bytes of all of them that are to go, gone so far, and how fast all are going together. */
  size: number;
  sent: number;
  speed: number;
  /** Seconds until all of them are up, at that speed; undefined until it is known. */
  remaining?: number;
}

export interface UploadsOptions {
  /** How many files go at once; each goes in parts, a few at once too. 3 unless said. */
  parallel?: number;
  /** What every upload is given besides: the drive's settings of pictures, what makes them. */
  extra?: () => Pick<UploadOptions, 'images' | 'renditions'>;
  /** Called after every change, for what shows them to draw again. */
  onChange: () => void;
  /** Called with each file once it is up. */
  onDone?: (entry: FileEntry, item: UploadItem) => void;
  /** Called with each that fails. */
  onFail?: (item: UploadItem) => void;
  /**
   * Looks for each file in the drive before it goes: its SHA-256, to keep with it, and what is there already. One
   * found waits, `asking`, until `decide`. Without it, every file goes as it is, a name taken made free with "(2)".
   */
  check?: (file: File, parent: EntryId | null) => Promise<{ sha256?: string; conflict?: Conflict }>;
  now?: () => number;
}

export interface Uploads {
  readonly items: readonly UploadItem[];
  summary(): UploadsSummary;
  /** These files into `parent`, each waiting its turn. */
  add(files: Iterable<File>, parent: EntryId | null): void;
  /** Stops one going or waiting: what of it arrived is taken away. */
  stop(id: number): void;
  stopAll(): void;
  /** One that failed or was stopped, sent again, from what arrived when it failed. */
  retry(id: number): void;
  /** What to do with one asked about; with `all`, with every other of its kind too, now and after. */
  decide(id: number, choice: Choice, all?: boolean): void;
  /** One that is over taken off the list. */
  dismiss(id: number): void;
  /** All that are over taken off the list. */
  clear(): void;
}

/** How much of the speed is the last moment's, against what it was: enough to follow a change, not every jolt. */
const FOLLOW = 0.3;
/** How often the speed is worked out again, in milliseconds. */
const EVERY = 400;

export function createUploads(client: DriveClient, options: UploadsOptions): Uploads {
  const parallel = options.parallel ?? 3;
  const now = options.now ?? (() => Date.now());
  let items: UploadItem[] = [];
  let count = 0;
  const files = new Map<number, File>();
  const stops = new Map<number, AbortController>();
  const pace = new Map<number, { at: number; sent: number }>();
  const hashes = new Map<number, string | undefined>();
  const checked = new Set<number>();
  /** What was chosen for every one of a kind, once said for all. */
  const always: Partial<Record<Conflict['kind'], Choice>> = {};

  const set = (id: number, change: Partial<UploadItem>) => {
    items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    options.onChange();
  };

  /** The next waiting, as long as fewer than `parallel` are going. */
  const pump = () => {
    while (items.filter((item) => item.state === 'sending' || item.state === 'checking').length < parallel) {
      const next = items.find((item) => item.state === 'waiting');
      if (!next) return;
      void send(next.id);
    }
  };

  const send = async (id: number) => {
    const file = files.get(id);
    const item = items.find((one) => one.id === id);
    if (!file || !item) return;
    if (options.check && !checked.has(id)) {
      set(id, { state: 'checking' });
      const found = await options.check(file, item.parent).catch(() => ({}) as { sha256?: string; conflict?: Conflict });
      checked.add(id);
      hashes.set(id, found.sha256);
      const current = items.find((one) => one.id === id);
      // Stopped while it was looked for.
      if (current?.state !== 'checking') return pump();
      if (found.conflict) {
        const standing = always[found.conflict.kind];
        if (!standing) {
          set(id, { state: 'asking', conflict: found.conflict });
          return pump();
        }
        set(id, { conflict: found.conflict, choice: standing });
      }
    }
    const chosen = items.find((one) => one.id === id)!;
    if (chosen.choice === 'skip') {
      files.delete(id);
      set(id, { state: 'skipped' });
      return pump();
    }
    const replacing = chosen.choice === 'replace' && chosen.conflict?.kind === 'name' ? chosen.conflict.entry.id : undefined;
    const stop = new AbortController();
    stops.set(id, stop);
    pace.set(id, { at: now(), sent: item.sent });
    set(id, { state: 'sending', error: undefined, speed: undefined, remaining: undefined });
    try {
      const entry = await client.upload(file, {
        parent: item.parent,
        file: replacing,
        sha256: hashes.get(id),
        signal: stop.signal,
        ...options.extra?.(),
        onProgress: ({ sent, size }) => {
          const last = pace.get(id)!;
          const at = now();
          const current = items.find((one) => one.id === id);
          if (at - last.at < EVERY) {
            set(id, { sent });
            return;
          }
          const moment = ((sent - last.sent) * 1000) / (at - last.at);
          const speed = current?.speed === undefined ? moment : current.speed * (1 - FOLLOW) + moment * FOLLOW;
          pace.set(id, { at, sent });
          set(id, { sent, speed, remaining: speed > 0 ? (size - sent) / speed : undefined });
        },
      });
      files.delete(id);
      set(id, { state: 'done', sent: file.size, entry, speed: undefined, remaining: undefined });
      options.onDone?.(entry, items.find((one) => one.id === id)!);
    } catch (error) {
      const stopped = stop.signal.aborted;
      set(id, { state: stopped ? 'stopped' : 'failed', error: stopped ? undefined : (error as Error).message, speed: undefined, remaining: undefined });
      if (!stopped) options.onFail?.(items.find((one) => one.id === id)!);
    } finally {
      stops.delete(id);
      pump();
    }
  };

  return {
    get items() {
      return items;
    },
    summary() {
      const of = (state: UploadItem['state']) => items.filter((item) => item.state === state);
      const going = [...of('sending'), ...of('checking'), ...of('waiting')];
      const size = going.reduce((sum, item) => sum + item.size, 0);
      const sent = going.reduce((sum, item) => sum + item.sent, 0);
      const speed = of('sending').reduce((sum, item) => sum + (item.speed ?? 0), 0);
      // All of what is left at the speed all go at together: those waiting go at it too, once their turn comes.
      const known = of('sending').every((item) => item.speed !== undefined);
      return {
        sending: of('sending').length,
        waiting: of('waiting').length,
        done: of('done').length,
        failed: of('failed').length,
        stopped: of('stopped').length,
        asking: of('asking').length,
        skipped: of('skipped').length,
        size,
        sent,
        speed,
        remaining: going.length && known && speed > 0 ? (size - sent) / speed : undefined,
      };
    },
    add(chosen, parent) {
      for (const file of chosen) {
        const id = ++count;
        files.set(id, file);
        items = [...items, { id, name: file.name, size: file.size, sent: 0, state: 'waiting', parent }];
      }
      options.onChange();
      pump();
    },
    stop(id) {
      const item = items.find((one) => one.id === id);
      if (item?.state === 'sending') stops.get(id)?.abort();
      else if (item?.state === 'waiting' || item?.state === 'checking' || item?.state === 'asking') set(id, { state: 'stopped' });
    },
    stopAll() {
      for (const item of items) if (item.state === 'waiting' || item.state === 'checking' || item.state === 'asking') set(item.id, { state: 'stopped' });
      for (const stop of stops.values()) stop.abort();
    },
    retry(id) {
      const item = items.find((one) => one.id === id);
      if (!item || (item.state !== 'failed' && item.state !== 'stopped') || !files.has(id)) return;
      set(id, { state: 'waiting', error: undefined });
      pump();
    },
    decide(id, choice, all = false) {
      const item = items.find((one) => one.id === id);
      if (item?.state !== 'asking' || !item.conflict) return;
      // A file of the same bytes is not put in place of another: uploaded anyway, or not.
      const take = (one: UploadItem) => (choice === 'replace' && one.conflict?.kind !== 'name' ? 'keep' : choice);
      if (all) always[item.conflict.kind] = choice;
      for (const one of items) if (one.id === id || (all && one.state === 'asking' && one.conflict?.kind === item.conflict.kind)) set(one.id, { state: 'waiting', choice: take(one) });
      pump();
    },
    dismiss(id) {
      const item = items.find((one) => one.id === id);
      if (!item || ['sending', 'waiting', 'checking', 'asking'].includes(item.state)) return;
      files.delete(id);
      items = items.filter((one) => one.id !== id);
      options.onChange();
    },
    clear() {
      const going = (item: UploadItem) => ['sending', 'waiting', 'checking', 'asking'].includes(item.state);
      for (const item of items) if (!going(item)) files.delete(item.id);
      items = items.filter(going);
      options.onChange();
    },
  };
}

/**
 * A `check` that looks in the drive: the same bytes anywhere one may read, by their SHA-256, and else a file of the
 * same name in the folder it goes to, asked once for the files of one upload. `forget()` after a change, so a folder
 * is asked again.
 */
export function lookInDrive(client: DriveClient): NonNullable<UploadsOptions['check']> & { forget(): void } {
  const inFolder = new Map<string, { at: number; entries: Promise<Entry[]> }>();
  const entriesIn = (parent: EntryId | null) => {
    const key = parent ?? '';
    const kept = inFolder.get(key);
    if (kept && Date.now() - kept.at < 10_000) return kept.entries;
    const entries = client.list(parent).then((found) => found.entries);
    inFolder.set(key, { at: Date.now(), entries });
    return entries;
  };
  const check = async (file: File, parent: EntryId | null) => {
    const sha256 = await hashOf(file).catch(() => undefined);
    if (sha256) {
      const same = (await client.duplicates([sha256]))[sha256];
      if (same?.length) return { sha256, conflict: { kind: 'same', entry: same[0] } as Conflict };
    }
    const named = (await entriesIn(parent)).find((entry) => entry.kind === 'file' && sameName(entry.name, file.name));
    return { sha256, conflict: named ? ({ kind: 'name', entry: named } as Conflict) : undefined };
  };
  return Object.assign(check, { forget: () => inFolder.clear() });
}

/** How long something will take, as a person says it: "45 s", "3 min", "1 h 20 min". */
export function formatDuration(seconds: number, locale = 'en'): string {
  const unit = (n: number, u: 'second' | 'minute' | 'hour') => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' }).format(n);
  if (seconds < 60) return unit(Math.max(1, Math.ceil(seconds)), 'second');
  if (seconds < 3600) return unit(Math.ceil(seconds / 60), 'minute');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return minutes ? `${unit(hours, 'hour')} ${unit(minutes, 'minute')}` : unit(hours, 'hour');
}
