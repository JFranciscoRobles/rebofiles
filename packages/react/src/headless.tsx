// The drive without its interface: a provider that holds the client, and
// hooks for what a screen of your own needs. The whole <FileDrive> is built
// from these and nothing else.

import type { DriveSettings, Entry, EntryId, FileEntry, FolderEntry, ImageSettings, PersonalSettings } from '@rebofiles/core';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type DriveClient, type SettingsAnswer, TEXTS, type Texts, type Translate, type UploadItem, createDriveClient, createUploads, translator } from '@rebofiles/drive';

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
  /** The texts the application gave, if any: a drive mounted inside says these over its language. */
  ownTexts?: Texts;
  /** The language the application gave, if any: over the drive's settings, under a person's own. */
  givenLanguage?: 'en' | 'es';
  /** The settings of the server, once they come; null before, or from a server without them. */
  settings: SettingsAnswer | null;
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

export function DriveProvider({ base = '/api/files', client, headers, language, texts, children }: DriveProviderProps) {
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const made = useMemo(() => client ?? createDriveClient({ base, headers: () => headersRef.current?.() ?? {} }), [client, base]);
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision((n) => n + 1), []);
  const [settings, setSettings] = useState<SettingsAnswer | null>(null);
  // Asked again after every change: one made in the settings among them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is when to ask again, not what is asked
  useEffect(() => {
    let live = true;
    made.settings().then(
      (answer) => live && setSettings(answer),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [made, revision]);
  // A person's own first, then what the application gave, then the drive's.
  const shown = settings?.mine.language ?? language ?? settings?.drive.language ?? 'en';
  const value = useMemo(
    () => ({ client: made, revision, changed, t: translator(texts ?? TEXTS[shown]), locale: shown, texts: texts ?? TEXTS[shown], language: shown, ownTexts: texts, givenLanguage: language, settings }),
    [made, revision, changed, texts, shown, language, settings],
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

/** The settings of the drive and one's own, and saving them: for a panel of settings of your own. */
export function useSettings() {
  const { client, changed, settings } = useDrive();
  return useMemo(
    () => ({
      /** The drive as the one asking sees it; null until it comes. */
      settings: settings?.settings ?? null,
      drive: settings?.drive ?? null,
      mine: settings?.mine ?? null,
      canConfigure: settings?.canConfigure ?? false,
      /** The drive's, for whoever may configure it. */
      save: async (given: Partial<Omit<DriveSettings, 'images'>> & { images?: Partial<ImageSettings> }) => {
        const saved = await client.saveSettings(given);
        changed();
        return saved;
      },
      /** One's own language and theme. */
      saveMine: async (mine: PersonalSettings) => {
        const saved = await client.saveMySettings(mine);
        changed();
        return saved;
      },
    }),
    [client, changed, settings],
  );
}

/** A file going up: how far it is, how fast, how long it has left. */
export type Upload = UploadItem;

/**
 * Files going up, a few at once, each in parts: how far each is, how fast and how long it has left, and the same for
 * all of them (`summary`). One that failed is tried again with `retry`, from what arrived; one going is stopped with `stop`.
 */
export function useUploads() {
  const { client, changed, settings } = useDrive();
  const [, redraw] = useState(0);
  // The sizes pictures are made in, as the drive's settings say when an upload starts.
  const images = useRef<ImageSettings | undefined>(undefined);
  images.current = settings?.settings.images;
  const done = useRef(new Map<number, (entry: FileEntry) => void>());
  const uploads = useMemo(
    () =>
      createUploads(client, {
        extra: () => ({ images: images.current }),
        onChange: () => redraw((n) => n + 1),
        onDone: (entry, item) => {
          done.current.get(item.id)?.(entry);
          done.current.delete(item.id);
          changed();
        },
        onFail: () => changed(),
      }),
    [client, changed],
  );
  const upload = useCallback(
    (files: Iterable<File>, parent: EntryId | null, onDone?: (entry: FileEntry) => void) => {
      const from = uploads.items.length;
      uploads.add(files, parent);
      if (onDone) for (const item of uploads.items.slice(from)) done.current.set(item.id, onDone);
    },
    [uploads],
  );
  return {
    uploads: uploads.items as Upload[],
    summary: uploads.summary(),
    upload,
    retry: uploads.retry,
    stop: uploads.stop,
    stopAll: uploads.stopAll,
    dismiss: uploads.dismiss,
    clear: uploads.clear,
  };
}
