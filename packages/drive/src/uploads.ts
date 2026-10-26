// Files going up, several at a time, each in parts: what has gone of each, how
// fast it is going and how long it has left, and the same for all of them.
// One can be stopped, and one that failed tried again from what arrived. What
// the drive's screen and React's useUploads both show.

import type { EntryId, FileEntry } from '@rebofiles/core';
import type { DriveClient, UploadOptions } from './client';

export interface UploadItem {
  id: number;
  name: string;
  size: number;
  /** Bytes gone so far. */
  sent: number;
  state: 'waiting' | 'sending' | 'done' | 'failed' | 'stopped';
  error?: string;
  /** Bytes a second, as it has gone the last few seconds; while it is going. */
  speed?: number;
  /** Seconds it has left, at that speed; while it is going. */
  remaining?: number;
  /** The file in the drive, once it is up. */
  entry?: FileEntry;
  /** The folder it goes into. */
  parent: EntryId | null;
}

export interface UploadsSummary {
  /** Those going, those waiting their turn, those done, failed and stopped. */
  sending: number;
  waiting: number;
  done: number;
  failed: number;
  stopped: number;
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

  const set = (id: number, change: Partial<UploadItem>) => {
    items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    options.onChange();
  };

  /** The next waiting, as long as fewer than `parallel` are going. */
  const pump = () => {
    while (items.filter((item) => item.state === 'sending').length < parallel) {
      const next = items.find((item) => item.state === 'waiting');
      if (!next) return;
      void send(next.id);
    }
  };

  const send = async (id: number) => {
    const file = files.get(id);
    const item = items.find((one) => one.id === id);
    if (!file || !item) return;
    const stop = new AbortController();
    stops.set(id, stop);
    pace.set(id, { at: now(), sent: item.sent });
    set(id, { state: 'sending', error: undefined, speed: undefined, remaining: undefined });
    try {
      const entry = await client.upload(file, {
        parent: item.parent,
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
      const going = [...of('sending'), ...of('waiting')];
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
      else if (item?.state === 'waiting') set(id, { state: 'stopped' });
    },
    stopAll() {
      for (const item of items) if (item.state === 'waiting') set(item.id, { state: 'stopped' });
      for (const stop of stops.values()) stop.abort();
    },
    retry(id) {
      const item = items.find((one) => one.id === id);
      if (!item || (item.state !== 'failed' && item.state !== 'stopped') || !files.has(id)) return;
      set(id, { state: 'waiting', error: undefined });
      pump();
    },
    dismiss(id) {
      const item = items.find((one) => one.id === id);
      if (!item || item.state === 'sending' || item.state === 'waiting') return;
      files.delete(id);
      items = items.filter((one) => one.id !== id);
      options.onChange();
    },
    clear() {
      for (const item of items) if (item.state !== 'sending' && item.state !== 'waiting') files.delete(item.id);
      items = items.filter((item) => item.state === 'sending' || item.state === 'waiting');
      options.onChange();
    },
  };
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
