// A folder of the disk kept as a folder of the drive, both ways. Each run
// lists the two and compares each with what they were when they were last the
// same (the state), so it knows which side changed: what changed on one side
// goes to the other, what changed on both is kept twice ("(conflict …)"), and
// what is gone from one is taken from the other, into the drive's trash, from
// which it comes back. A file or folder moved or renamed in the drive is moved
// on the disk; one moved on the disk is found by its size and time, or sent
// again. Nothing here touches a disk: `LocalFolder` is how the disk is read
// and written, by Node (`nodeFolder`) or by a desktop application.

import { type Entry, type EntryId, type FileEntry, splitName } from '@rebofiles/core';
import type { DriveClient } from '@rebofiles/drive';

/** A file or folder of the disk, its path from the folder synced, with `/` between. */
export interface LocalEntry {
  path: string;
  kind: 'file' | 'folder';
  size: number;
  /** When it was last written, in milliseconds. */
  modified: number;
}

/** How a folder of the disk is read and written. Every path is from the folder synced, with `/` between. */
export interface LocalFolder {
  /** Everything in it, at any depth, but what is not to be synced (the state, files of the system). */
  list(): Promise<LocalEntry[]>;
  read(path: string): Promise<Uint8Array>;
  /** The bytes put at `path`, whole or not at all (written beside it first), its folders made; and what it is then. */
  write(path: string, bytes: Uint8Array): Promise<LocalEntry>;
  mkdir(path: string): Promise<void>;
  /** Taken away: into the system's trash where there is one. */
  remove(path: string): Promise<void>;
  /** Moved, its folders made. */
  move(from: string, to: string): Promise<void>;
  stat(path: string): Promise<LocalEntry | null>;
}

/** What a path was when both sides were last the same. */
export interface Synced {
  id: EntryId;
  kind: 'file' | 'folder';
  path: string;
  /** Of a file: its version in the drive, and its size and time on the disk. */
  version?: string;
  size?: number;
  modified?: number;
}

/** What was the same on both sides after the last run, by the folded path: kept by whoever runs it, between runs. */
export interface SyncState {
  /** The folder of the drive synced; null for the top. */
  root: EntryId | null;
  entries: Record<string, Synced>;
}

export type SyncAction =
  | { do: 'download' | 'upload' | 'mkdir-local' | 'mkdir-remote' | 'remove-local' | 'trash-remote'; path: string }
  | { do: 'move-local' | 'move-remote'; path: string; to: string }
  | { do: 'conflict'; path: string; kept: string }
  | { do: 'failed'; path: string; error: string };

export interface SyncOptions {
  client: DriveClient;
  local: LocalFolder;
  /** What the last run left; none for the first, which joins what is there on both sides. */
  state?: SyncState;
  /** The folder of the drive to keep; the top unless said. Taken from the state when there is one. */
  root?: EntryId | null;
  /** Told each thing done, as it is. */
  onAction?: (action: SyncAction) => void;
  /** What reads a file from the address the server gives; the global fetch unless said. */
  fetch?: typeof fetch;
  now?: () => Date;
  /** Run even when the folder of the disk is empty and was not: off unless said, as that is most often a disk not there. */
  allowEmpty?: boolean;
}

/** The disk was empty, and the last run had things in it: most often a disk not mounted, and never a reason to trash all of the drive. */
export class EmptyFolderRefused extends Error {}

/** A path folded as names are compared in the drive and on Windows and a Mac: case and how an accent is written do not count. */
export const fold = (path: string): string => path.normalize('NFC').toLowerCase();
const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const depth = (path: string) => path.split('/').length;
const within = (path: string, folder: string) => fold(path).startsWith(`${fold(folder)}/`);

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};
/** The type of a file by its name, as a browser would give it. */
export const typeOfName = (name: string) => TYPES[splitName(name).ext.slice(1).toLowerCase()] ?? 'application/octet-stream';

/** "report (conflict 2026-10-26 14.05).docx": the copy of the disk, beside the drive's, when both changed. */
export const conflictName = (path: string, at: Date) => {
  const { base, ext } = splitName(nameOf(path));
  const stamp = at.toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
  const folder = parentOf(path);
  return `${folder ? `${folder}/` : ''}${base} (conflict ${stamp})${ext}`;
};

interface Remote {
  entry: Entry;
  path: string;
}

/** Everything in a folder of the drive, at any depth, by its folded path. */
async function remoteTree(client: DriveClient, root: EntryId | null): Promise<Map<string, Remote>> {
  const found = new Map<string, Remote>();
  const walk = async (folder: EntryId | null, at: string) => {
    for (const entry of (await client.list(folder)).entries) {
      const path = at ? `${at}/${entry.name}` : entry.name;
      found.set(fold(path), { entry, path });
      if (entry.kind === 'folder') await walk(entry.id, path);
    }
  };
  await walk(root, '');
  return found;
}

const sameFile = (local: LocalEntry, synced: Synced) => local.size === synced.size && Math.trunc(local.modified) === Math.trunc(synced.modified ?? -1);

/** One run: both sides made the same, as far as each can be. What it did, and the state to give the next. */
export async function syncOnce(options: SyncOptions): Promise<{ state: SyncState; actions: SyncAction[] }> {
  const { client, local } = options;
  const read = options.fetch ?? fetch;
  const root = options.state?.root ?? options.root ?? null;
  const state: SyncState = { root, entries: { ...(options.state?.entries ?? {}) } };
  const actions: SyncAction[] = [];
  const did = (action: SyncAction) => {
    actions.push(action);
    options.onAction?.(action);
  };
  const now = () => options.now?.() ?? new Date();

  let remote = await remoteTree(client, root);
  let disk = new Map((await local.list()).map((entry) => [fold(entry.path), entry]));
  if (!disk.size && Object.keys(state.entries).length && !options.allowEmpty) throw new EmptyFolderRefused('The folder on the disk is empty, and it was not: is the disk there? Nothing was done.');

  /** The id of the folder of the drive at a path of the disk: the root for none. */
  const folderAt = (path: string): EntryId | null => {
    if (!path) return root;
    const found = remote.get(fold(path));
    if (found?.entry.kind !== 'folder') throw new Error(`There is no folder ${path} in the drive.`);
    return found.entry.id;
  };
  const bytesOf = async (file: FileEntry) => {
    const answer = await read(await client.url(file.id));
    if (!answer.ok) throw new Error(`The drive answered ${answer.status} for ${file.name}.`);
    return new Uint8Array(await answer.arrayBuffer());
  };
  const keep = (path: string, synced: Omit<Synced, 'path'>) => {
    state.entries[fold(path)] = { ...synced, path };
  };
  const attempt = async (path: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      did({ do: 'failed', path, error: error instanceof Error ? error.message : String(error) });
    }
  };
  const download = async (path: string, file: FileEntry) => {
    const written = await local.write(path, await bytesOf(file));
    keep(path, { id: file.id, kind: 'file', version: file.versions[0].id, size: written.size, modified: written.modified });
    did({ do: 'download', path });
  };
  const upload = async (path: string, as?: FileEntry) => {
    const bytes = await local.read(path);
    const after = await local.stat(path);
    const made = await client.upload(new File([bytes as BlobPart], nameOf(path), { type: as?.type ?? typeOfName(path) }), as ? { file: as.id } : { parent: folderAt(parentOf(path)) });
    keep(path, { id: made.id, kind: 'file', version: made.versions[0].id, size: after?.size ?? bytes.length, modified: after?.modified ?? Date.now() });
    remote.set(fold(path), { entry: made, path });
    did({ do: 'upload', path });
  };
  /** Moved in the state, with what was under it. */
  const rebase = (from: string, to: string) => {
    for (const [key, synced] of Object.entries(state.entries)) {
      if (key !== fold(from) && !within(synced.path, from)) continue;
      delete state.entries[key];
      const path = to + synced.path.slice(from.length);
      state.entries[fold(path)] = { ...synced, path };
    }
  };

  // ---- Moved or renamed in the drive: moved on the disk, the shallowest first, as their folders take what is in them. ----
  const byId = new Map([...remote.values()].map((found) => [found.entry.id, found]));
  for (const synced of Object.values(state.entries).sort((a, b) => depth(a.path) - depth(b.path))) {
    const moved = byId.get(synced.id);
    const current = state.entries[fold(synced.path)];
    if (!moved || current?.id !== synced.id || moved.path === synced.path) continue;
    if (!disk.has(fold(synced.path)) || (fold(moved.path) !== fold(synced.path) && disk.has(fold(moved.path)))) continue;
    await attempt(synced.path, async () => {
      await local.move(synced.path, moved.path);
      did({ do: 'move-local', path: synced.path, to: moved.path });
      rebase(synced.path, moved.path);
    });
  }
  disk = new Map((await local.list()).map((entry) => [fold(entry.path), entry]));

  // ---- Moved or renamed on the disk: a file gone from where it was, and one of its size and time where it was not. ----
  const fresh = [...disk.values()].filter((entry) => entry.kind === 'file' && !state.entries[fold(entry.path)] && !remote.has(fold(entry.path)));
  for (const synced of Object.values(state.entries)) {
    if (synced.kind !== 'file' || disk.has(fold(synced.path))) continue;
    const there = remote.get(fold(synced.path));
    if (there?.entry.id !== synced.id || (there.entry as FileEntry).versions[0].id !== synced.version) continue;
    const moved = fresh.find((entry) => sameFile(entry, synced));
    if (!moved) continue;
    fresh.splice(fresh.indexOf(moved), 1);
    await attempt(synced.path, async () => {
      if (parentOf(moved.path) !== parentOf(synced.path)) await client.move(synced.id, folderAt(parentOf(moved.path)));
      if (nameOf(moved.path) !== nameOf(synced.path)) await client.rename(synced.id, nameOf(moved.path));
      did({ do: 'move-remote', path: synced.path, to: moved.path });
      rebase(synced.path, moved.path);
    });
  }
  remote = await remoteTree(client, root);

  // ---- Each path, the folders before what is in them. ----
  const keys = [...new Set([...remote.keys(), ...disk.keys(), ...Object.keys(state.entries)])];
  const pathOf = (key: string) => remote.get(key)?.path ?? disk.get(key)?.path ?? state.entries[key]!.path;
  keys.sort((a, b) => depth(pathOf(a)) - depth(pathOf(b)) || pathOf(a).localeCompare(pathOf(b)));
  /** Taken away on one side, done last, the deepest first: what is in a folder before the folder. */
  const gone: { path: string; side: 'local' | 'remote'; id?: EntryId }[] = [];

  for (const key of keys) {
    const there = remote.get(key);
    const here = disk.get(key);
    const synced = state.entries[key];
    const path = pathOf(key);
    // Under a folder taken away on the other side: taken with it.
    if (gone.some((g) => within(path, g.path))) {
      delete state.entries[key];
      continue;
    }
    // On the disk as it is written there: the drive's name may differ from it in case, which a disk of Linux would take for another.
    const ondisk = here?.path ?? path;
    await attempt(path, async () => {
      // A folder and a file of the same name: the drive's is kept, the disk's put aside.
      if (there && here && there.entry.kind !== here.kind) {
        const aside = conflictName(ondisk, now());
        await local.move(ondisk, aside);
        did({ do: 'conflict', path, kept: aside });
        if (here.kind === 'file') await upload(aside);
        if (there.entry.kind === 'folder') await local.mkdir(path), keep(path, { id: there.entry.id, kind: 'folder' });
        else await download(path, there.entry as FileEntry);
        return;
      }
      const kind = there?.entry.kind ?? here?.kind ?? synced!.kind;
      if (kind === 'folder') {
        if (there && here) keep(path, { id: there.entry.id, kind: 'folder' });
        else if (there && !synced) await local.mkdir(path), keep(path, { id: there.entry.id, kind: 'folder' }), did({ do: 'mkdir-local', path });
        else if (here && !synced) {
          const made = await client.createFolder(nameOf(path), folderAt(parentOf(path)));
          remote.set(key, { entry: made, path });
          keep(path, { id: made.id, kind: 'folder' });
          did({ do: 'mkdir-remote', path });
        } else if (there && synced) gone.push({ path, side: 'remote', id: there.entry.id });
        else if (here && synced) gone.push({ path: ondisk, side: 'local' });
        else delete state.entries[key];
        return;
      }

      const file = there?.entry as FileEntry | undefined;
      const changedThere = Boolean(file && (!synced || file.versions[0].id !== synced.version || file.id !== synced.id));
      const changedHere = Boolean(here && (!synced || !sameFile(here, synced)));
      if (file && here) {
        if (!synced) {
          // Both there the first time: the same when their sizes are; else both kept.
          if (file.versions[0].size === here.size) keep(path, { id: file.id, kind: 'file', version: file.versions[0].id, size: here.size, modified: here.modified });
          else await conflict(ondisk, file);
        } else if (changedThere && changedHere) await conflict(ondisk, file);
        else if (changedThere) await download(ondisk, file);
        else if (changedHere) await upload(ondisk, file);
      } else if (file) {
        // Gone from the disk: taken from the drive, unless it changed there since.
        if (synced && !changedThere) gone.push({ path, side: 'remote', id: file.id });
        else await download(path, file);
      } else if (here) {
        // Gone from the drive: taken from the disk, unless it changed here since, when it is sent again.
        if (synced && !changedHere) gone.push({ path: ondisk, side: 'local' });
        else await upload(ondisk);
      } else delete state.entries[key];
    });
  }

  for (const { path, side, id } of gone.sort((a, b) => depth(b.path) - depth(a.path))) {
    await attempt(path, async () => {
      if (side === 'remote') {
        await client.moveToTrash(id!);
        did({ do: 'trash-remote', path });
      } else {
        await local.remove(path);
        did({ do: 'remove-local', path });
      }
      for (const key of Object.keys(state.entries)) if (key === fold(path) || within(state.entries[key].path, path)) delete state.entries[key];
    });
  }
  return { state, actions };

  /** Both changed: the drive's at the path, the disk's beside it, sent as a file of its own. */
  async function conflict(path: string, file: FileEntry) {
    const aside = conflictName(path, now());
    await local.move(path, aside);
    did({ do: 'conflict', path, kept: aside });
    await upload(aside);
    await download(path, file);
  }
}
