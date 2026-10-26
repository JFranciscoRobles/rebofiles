// The engine on Node: a folder of the disk as a `LocalFolder`, the state kept
// beside it, and a sync that goes on, run again when either side changes.

import { watch as watchFiles } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { DriveClient } from '@rebofiles/drive';
import { type LocalEntry, type LocalFolder, type SyncAction, type SyncState, syncOnce } from './engine';

/** Where the engine keeps its own, inside the folder synced, and never syncs: the state, a file being written, what was taken away. */
export const OWN = '.rebofiles';

/** Files of the systems and of the programs that write beside a document, never synced. */
const IGNORED = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.~lock\..*#|~\$.*|.*\.tmp|.*\.swp|\._.*|\.Spotlight-V100|\.Trashes|\.fseventsd)$/i;

/** Whether a name is left out of what is synced: the engine's own folder and the files of the systems. */
export const ignored = (name: string) => name === OWN || IGNORED.test(name);

/**
 * A folder of the disk. What is taken away goes to `.rebofiles/removed/<when>/`, inside it, not gone: the drive has
 * it in its trash too, and this is for one who has no drive at hand.
 */
export function nodeFolder(folder: string): LocalFolder {
  const root = resolve(folder);
  const at = (path: string) => {
    const full = resolve(root, ...path.split('/'));
    if (full !== root && !full.startsWith(root + sep)) throw new Error(`${path} is outside the folder.`);
    return full;
  };
  const entryOf = async (path: string): Promise<LocalEntry | null> => {
    const found = await stat(at(path)).catch(() => null);
    return found ? { path, kind: found.isDirectory() ? 'folder' : 'file', size: found.isDirectory() ? 0 : found.size, modified: Math.trunc(found.mtimeMs) } : null;
  };
  return {
    async list() {
      const found: LocalEntry[] = [];
      const walk = async (dir: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
          if (ignored(entry.name) || entry.isSymbolicLink()) continue;
          const full = join(dir, entry.name);
          const path = relative(root, full).split(sep).join('/');
          const made = await entryOf(path);
          if (made) found.push(made);
          if (entry.isDirectory()) await walk(full);
        }
      };
      await walk(root);
      return found;
    },
    read: async (path) => new Uint8Array(await readFile(at(path))),
    async write(path, bytes) {
      // Beside, in the engine's own folder, and put in its place once whole: a program reading it never sees half.
      const partial = join(root, OWN, 'partial', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(dirname(partial), { recursive: true });
      await writeFile(partial, bytes);
      await mkdir(dirname(at(path)), { recursive: true });
      await rename(partial, at(path));
      return (await entryOf(path))!;
    },
    mkdir: async (path) => void (await mkdir(at(path), { recursive: true })),
    async remove(path) {
      const kept = join(root, OWN, 'removed', new Date().toISOString().replace(/[:.]/g, '-'), ...path.split('/'));
      await mkdir(dirname(kept), { recursive: true });
      await rename(at(path), kept).catch(() => rm(at(path), { recursive: true, force: true }));
    },
    async move(from, to) {
      await mkdir(dirname(at(to)), { recursive: true });
      await rename(at(from), at(to));
    },
    stat: entryOf,
  };
}

const stateFile = (folder: string) => join(resolve(folder), OWN, 'state.json');

/** The state the last run left in a folder, or none. */
export async function loadState(folder: string): Promise<SyncState | undefined> {
  try {
    return JSON.parse(await readFile(stateFile(folder), 'utf8')) as SyncState;
  } catch {
    return undefined;
  }
}

export async function saveState(folder: string, state: SyncState): Promise<void> {
  await mkdir(dirname(stateFile(folder)), { recursive: true });
  await writeFile(`${stateFile(folder)}.new`, JSON.stringify(state));
  await rename(`${stateFile(folder)}.new`, stateFile(folder));
}

export interface WatchOptions {
  client: DriveClient;
  /** The folder of the disk. */
  folder: string;
  /** The folder of the drive, the first time; the top unless said. */
  root?: string | null;
  /** Run again this often even when nothing was told, in milliseconds: every minute unless said. */
  every?: number;
  onAction?: (action: SyncAction) => void;
  /** A run that failed as a whole: told, and tried again at the next change or the next minute. */
  onError?: (error: unknown) => void;
  /** After each run. */
  onIdle?: (actions: SyncAction[]) => void;
  fetch?: typeof fetch;
}

/**
 * The folder kept as the drive's, as long as it runs: once now, then each time the drive tells a change (its
 * events) or a file of the disk changes, a moment after, and every minute besides. One run at a time; a change
 * during one runs another after it. The function it returns stops it.
 */
export function watchSync(options: WatchOptions): { stop: () => void; done: Promise<void> } {
  let running: Promise<void> = Promise.resolve();
  let again = false;
  let busy = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (busy) return void (again = true);
    busy = true;
    try {
      do {
        again = false;
        const state = await loadState(options.folder);
        const { state: next, actions } = await syncOnce({
          client: options.client,
          local: nodeFolder(options.folder),
          state,
          root: options.root ?? null,
          onAction: options.onAction,
          fetch: options.fetch,
        });
        await saveState(options.folder, next);
        options.onIdle?.(actions);
      } while (again && !stopped);
    } catch (error) {
      options.onError?.(error);
    } finally {
      busy = false;
    }
  };
  const soon = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => (running = run()), 1500);
  };
  running = run();
  const unwatch = options.client.watch(soon);
  // What the engine writes in its own folder is not a change to sync.
  const files = watchFiles(resolve(options.folder), { recursive: true }, (_, name) => name && !String(name).split(/[\\/]/).some(ignored) && soon());
  const tick = setInterval(soon, options.every ?? 60_000);
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
      unwatch();
      files.close();
    },
    get done() {
      return running;
    },
  };
}
