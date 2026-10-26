// The drive without its interface: a provider that holds the client, and
// hooks for what a screen of your own needs. The whole <FileDrive> is built
// from these and nothing else.

import type { Entry, EntryId, FileEntry, FolderEntry } from '@rebofiles/core';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type DriveClient, TEXTS, type Texts, type Translate, createDriveClient, translator } from '@rebofiles/drive';

interface DriveContext {
  client: DriveClient;
  /** Goes up after every change, for the hooks to ask again. */
  revision: number;
  changed: () => void;
  t: Translate;
  locale: string;
  /** The texts `t` says, for a drive mounted inside to say the same. */
  texts: Texts;
  language: 'en' | 'es';
}

const Context = createContext<DriveContext | null>(null);

export interface DriveProviderProps {
  /** Where the routes of @rebofiles/server are: `/api/files`. */
  base?: string;
  /** A client of your own, instead of `base`. */
  client?: DriveClient;
  /** Headers for every request to the server. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  language?: 'en' | 'es';
  /** Texts of another language, with the keys of the English ones. */
  texts?: Texts;
  children: ReactNode;
}

export function DriveProvider({ base = '/api/files', client, headers, language = 'en', texts, children }: DriveProviderProps) {
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const made = useMemo(() => client ?? createDriveClient({ base, headers: () => headersRef.current?.() ?? {} }), [client, base]);
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision((n) => n + 1), []);
  const value = useMemo(
    () => ({ client: made, revision, changed, t: translator(texts ?? TEXTS[language]), locale: language, texts: texts ?? TEXTS[language], language }),
    [made, revision, changed, texts, language],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The provider above, when there is one: <FileDrive> inside one uses it rather than making its own. */
export const useOuterDrive = (): DriveContext | null => useContext(Context);

export function useDrive(): DriveContext {
  const context = useContext(Context);
  if (!context) throw new Error('useDrive needs a <DriveProvider> above it.');
  return context;
}

/** What a list shows: a folder, the recent files, the trash, or what a search found. */
export type View = { section: 'files'; folder: EntryId | null } | { section: 'recent' } | { section: 'shared' } | { section: 'trash' } | { section: 'search'; query: string; trashed?: boolean };

export interface Entries {
  entries: Entry[];
  /** For a folder, the folders from the top down to it, itself included. */
  path: FolderEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/** The entries of a view, asked again after every change made through the provider. */
export function useEntries(view: View): Entries {
  const { client, revision, changed } = useDrive();
  const key = JSON.stringify(view);
  // Which view the state is of: in the render after the view changes, and before its effect asks, it is still the last one's.
  const [state, setState] = useState<Omit<Entries, 'refresh'> & { of: string }>({ entries: [], path: [], loading: true, error: null, of: key });
  // biome-ignore lint/correctness/useExhaustiveDependencies: the view is compared by its JSON, so a new object of the same view does not ask again
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    const asked =
      view.section === 'files'
        ? client.list(view.folder)
        : view.section === 'recent'
          ? client.recent().then((entries) => ({ entries, path: [] }))
          : view.section === 'shared'
            ? client.shared().then((entries) => ({ entries, path: [] }))
            : view.section === 'trash'
              ? client.trash().then((entries) => ({ entries, path: [] }))
              : client.search(view.query, { trashed: view.trashed }).then((entries) => ({ entries, path: [] }));
    asked.then(
      ({ entries, path }) => live && setState({ entries, path, loading: false, error: null, of: key }),
      (error: Error) => live && setState({ entries: [], path: [], loading: false, error, of: key }),
    );
    return () => {
      live = false;
    };
  }, [client, key, revision]);
  const { of, ...entries } = state;
  // What the last view had, shown while this one loads, but said to be loading: not taken for this view's.
  return { ...entries, loading: entries.loading || of !== key, refresh: changed };
}

/** One entry as it is now, and where it is; null while it loads or when there is none. */
export function useEntry(id: EntryId | null) {
  const { client, revision } = useDrive();
  const [state, setState] = useState<{ entry: Entry; path: FolderEntry[]; trashed: boolean } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again after every change, which `revision` counts
  useEffect(() => {
    if (!id) return setState(null);
    let live = true;
    client.entry(id).then(
      (found) => live && setState(found),
      () => live && setState(null),
    );
    return () => {
      live = false;
    };
  }, [client, id, revision]);
  // Not the last entry's while this one is asked for: null until it comes.
  return state && state.entry.id === id ? state : null;
}

/** The changes, each telling the provider when it is done so that every hook asks again. */
export function useActions() {
  const { client, changed } = useDrive();
  return useMemo(() => {
    const then =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        try {
          return await fn(...args);
        } finally {
          changed();
        }
      };
    return {
      createFolder: then(client.createFolder),
      rename: then(client.rename),
      move: then(client.move),
      moveToTrash: then(client.moveToTrash),
      restore: then(client.restore),
      deleteForever: then(client.deleteForever),
      emptyTrash: then(client.emptyTrash),
      restoreVersion: then(client.restoreVersion),
      share: then(client.share),
      unshare: then(client.unshare),
      createLink: then(client.createLink),
      removeLink: then(client.removeLink),
      linkToken: client.linkToken,
      /** A file sent up, or a new version of one with `{ file: id }`; for many with a bar of progress, `useUploads`. */
      upload: then(client.upload),
      url: client.url,
    };
  }, [client, changed]);
}

export interface Upload {
  id: number;
  name: string;
  size: number;
  sent: number;
  state: 'waiting' | 'sending' | 'done' | 'failed';
  error?: string;
  entry?: FileEntry;
}

/** Files sent one after another, each in parts; what has gone of each, for a bar. One that failed is tried again with `retry`, from what arrived. */
export function useUploads() {
  const { client, changed } = useDrive();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const queue = useRef(Promise.resolve());
  const counter = useRef(0);
  const sends = useRef(new Map<number, () => void>());
  const set = useCallback((id: number, change: Partial<Upload>) => setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u))), []);

  const upload = useCallback(
    (files: Iterable<File>, parent: EntryId | null, onDone?: (entry: FileEntry) => void) => {
      for (const file of files) {
        const id = ++counter.current;
        setUploads((all) => [...all.filter((u) => u.state !== 'done'), { id, name: file.name, size: file.size, sent: 0, state: 'waiting' }]);
        const send = () => {
          queue.current = queue.current.then(async () => {
            set(id, { state: 'sending', error: undefined });
            try {
              const entry = await client.upload(file, { parent, onProgress: ({ sent }) => set(id, { sent }) });
              sends.current.delete(id);
              set(id, { state: 'done', sent: file.size, entry });
              onDone?.(entry);
            } catch (error) {
              set(id, { state: 'failed', error: (error as Error).message });
            }
            changed();
          });
        };
        sends.current.set(id, send);
        send();
      }
    },
    [client, changed, set],
  );
  const retry = useCallback((id: number) => sends.current.get(id)?.(), []);
  const dismiss = useCallback((id: number) => {
    sends.current.delete(id);
    setUploads((all) => all.filter((u) => u.id !== id));
  }, []);
  return { uploads, upload, retry, dismiss };
}
