// The drive as a request needs it. A store that answers a piece at a time
// (`scoped`) is asked for what the request names: entries with the folders
// above them, what is in some folders, what is under some entries; and a
// drive is made of those alone, which core changes as it would the whole. A
// store without it is loaded whole, and held while its revision stays.

import * as core from '@rebofiles/core';
import type { Drive, Entry, EntryId } from '@rebofiles/core';
import type { MetadataStore } from './metadata';

/** What a request needs of the drive. Every entry named comes with the folders above it. */
export interface Scope {
  /** Entries by id; null and undefined are the top, and are left out. */
  ids?: (EntryId | null | undefined)[];
  /** What is right inside each of these folders; null is the top, of `owners` only when given. */
  children?: (EntryId | null | undefined)[];
  owners?: (string | undefined)[];
  /** Each of these, and all that is under it. */
  subtrees?: (EntryId | null | undefined)[];
  /** Entries found already, as by a search. */
  entries?: Entry[];
}

const real = <T>(values: (T | null | undefined)[] | undefined): T[] => (values ?? []).filter((value): value is T => value !== null && value !== undefined);

export interface View {
  /** Whether the store is asked a piece at a time. */
  readonly scoped: boolean;
  /** The drive with at least what `scope` names: the whole one, for a store without `scoped`. */
  drive(scope?: Scope): Promise<Drive>;
  /** The drive just saved, held for the next request under the revision it was saved at: of a store held whole. */
  saved(drive: Drive, revision?: string): void;
  /** What to ask for, to find what each finds: of a store held whole, nothing more than the whole. */
  find: {
    recent(user: string, limit: number): Promise<Scope>;
    /** What is in the trash itself, with what is under it. */
    trashed(how: { user?: string; before?: string }): Promise<Scope>;
    sharedWith(names: string[]): Promise<Scope>;
    named(query: string, limit: number): Promise<Scope>;
    withHashes(hashes: string[]): Promise<Scope>;
    owned(owner: string): Promise<Scope>;
    withLink(link: string): Promise<Scope>;
    withField(name: string, value: string, limit: number): Promise<Scope>;
  };
}

export function viewOf(store: MetadataStore): View {
  const q = store.scoped;
  // Of a store held whole: the drive as last loaded, and the revision it was of. Read before the drive, so a change
  // between the two only loads it again.
  let kept: { revision: string; drive: Drive } | undefined;
  const whole = async (): Promise<Drive> => {
    if (!store.revision) return store.load();
    const revision = await store.revision();
    if (kept?.revision === revision) return kept.drive;
    const drive = await store.load();
    kept = { revision, drive };
    return drive;
  };

  const drive = async (scope: Scope = {}): Promise<Drive> => {
    if (!q) return whole();
    const found = new Map<EntryId, Entry>();
    const add = (entries: Entry[]) => {
      for (const entry of entries) found.set(entry.id, entry);
    };
    const ids = real(scope.ids);
    const parents = (scope.children ?? []).filter((parent) => parent !== undefined) as (EntryId | null)[];
    const subtrees = real(scope.subtrees);
    add(scope.entries ?? []);
    const [named, inside, under] = await Promise.all([ids.length ? q.entries(ids) : [], parents.length ? q.children(parents, real(scope.owners)) : [], subtrees.length ? q.subtrees(subtrees) : []]);
    add(named);
    add(inside);
    add(under);
    // The folders above all of it: whose access is asked, whose trash it is in, the path to it.
    if (found.size || parents.length) add(await q.ancestors([...new Set([...found.keys(), ...real(parents)])]));
    return core.driveOf(found.values());
  };
  const found = (entries: Entry[]): Scope => ({ entries });

  return {
    scoped: Boolean(q),
    drive,
    saved(next, revision) {
      if (!q && revision !== undefined) kept = { revision, drive: next };
    },
    find: {
      recent: async (user, limit) => (q ? found(await q.recent(user, limit)) : {}),
      async trashed(how) {
        if (!q) return {};
        const roots = await q.trashed(how);
        return { entries: roots, subtrees: roots.map((entry) => entry.id) };
      },
      sharedWith: async (names) => (q ? found(await q.sharedWith(names)) : {}),
      named: async (query, limit) => (q ? found(await q.named(core.foldText(query).split(/\s+/).filter(Boolean), limit)) : {}),
      withHashes: async (hashes) => (q ? found(await q.withHashes(hashes)) : {}),
      owned: async (owner) => (q ? found(await q.owned(owner)) : {}),
      async withLink(link) {
        if (!q) return {};
        const entry = await q.withLink(link);
        return found(entry ? [entry] : []);
      },
      withField: async (name, value, limit) => (q ? found(await q.withField(name, value, limit)) : {}),
    },
  };
}
