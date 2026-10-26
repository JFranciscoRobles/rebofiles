// A folder of this computer kept as the drive, from the window: the engine of
// @rebofiles/sync, with the disk read and written by the application's own
// commands (src-tauri/src/sync.rs). Run when it starts, when the drive tells a
// change, when the window comes back to the front, and every half a minute;
// one run at a time. Which folder, and what the last run left, are kept for
// each server.

import type { DriveClient } from '@rebofiles/drive';
import { type LocalEntry, type LocalFolder, type SyncAction, type SyncState, syncOnce } from '@rebofiles/sync/engine';

type Invoke = <T>(command: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<T>;
const tauri = () => (window as unknown as { __TAURI__?: { core: { invoke: Invoke } } }).__TAURI__?.core;

/** Whether the window is the application's, which can reach the disk; not a page of Vite in a browser. */
export const canSync = () => Boolean(tauri());

/** The folder at `root`, through the commands of the application. */
export function tauriFolder(root: string): LocalFolder {
  const invoke = tauri()!.invoke;
  return {
    list: () => invoke<LocalEntry[]>('sync_list', { root }),
    read: async (path) => new Uint8Array(await invoke<ArrayBuffer>('sync_read', { root, path })),
    // The bytes as the body, the paths in headers, encoded: a header is ASCII, and a name may not be.
    write: (path, bytes) => invoke<LocalEntry>('sync_write', bytes, { headers: { 'x-root': encodeURIComponent(root), 'x-path': encodeURIComponent(path) } }),
    mkdir: (path) => invoke('sync_mkdir', { root, path }),
    remove: (path) => invoke('sync_remove', { root, path }),
    move: (from, to) => invoke('sync_move', { root, from, to }),
    stat: (path) => invoke<LocalEntry | null>('sync_stat', { root, path }),
  };
}

export const defaultFolder = () => tauri()!.invoke<string>('sync_default_folder');

interface Kept {
  folder: string;
  state?: SyncState;
}
const KEY = (server: string) => `rebofiles:sync:${server}`;
export const keptSync = (server: string): Kept | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY(server)) ?? 'null') as Kept | null;
  } catch {
    return null;
  }
};
const keep = (server: string, kept: Kept | null) => {
  try {
    if (kept) localStorage.setItem(KEY(server), JSON.stringify(kept));
    else localStorage.removeItem(KEY(server));
  } catch {}
};

export interface SyncStatus {
  folder: string;
  running: boolean;
  /** When the last run ended, and what it did. */
  last?: { at: Date; actions: SyncAction[] };
  error?: string;
}

/** The folder kept as the drive of `server`, as long as it is not stopped. */
export function startSync(server: string, client: DriveClient, folder: string, onStatus: (status: SyncStatus) => void): { stop: (forget?: boolean) => void; now: () => void } {
  const kept = keptSync(server);
  let state = kept?.folder === folder ? kept.state : undefined;
  keep(server, { folder, state });
  const status: SyncStatus = { folder, running: false };
  const local = tauriFolder(folder);
  let busy = false;
  let again = false;
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    if (busy) return void (again = true);
    busy = true;
    onStatus({ ...status, running: true });
    try {
      do {
        again = false;
        const done = await syncOnce({ client, local, state });
        state = done.state;
        keep(server, { folder, state });
        status.last = { at: new Date(), actions: done.actions };
        status.error = undefined;
      } while (again && !stopped);
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      if (!stopped) onStatus({ ...status, running: false });
    }
  };
  let soon: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(soon);
    soon = setTimeout(run, 800);
  };
  const unwatch = client.watch(later);
  const tick = setInterval(run, 30_000);
  const onFocus = () => later();
  window.addEventListener('focus', onFocus);
  void run();
  return {
    now: () => void run(),
    stop(forget = false) {
      stopped = true;
      clearTimeout(soon);
      clearInterval(tick);
      unwatch();
      window.removeEventListener('focus', onFocus);
      if (forget) keep(server, null);
    },
  };
}
