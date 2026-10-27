// Where the drive's entries are kept: folders, names, owners, the trash,
// versions. A bucket keeps none of that, so it is a store of its own, beside
// the bytes. The server loads the drive, changes it with core and writes back
// only what changed.

import { type Activity, type Changes, type Comment, type Drive, type Entry, type EntryId, driveOf, emptyDrive, foldText, wordsOf } from '@rebofiles/core';

/**
 * What a store answers of the drive a piece at a time, for a drive too large to hold whole: the server asks for what
 * each request needs (an entry and the folders above it, what is in a folder, what is under it), makes a drive of
 * those, and changes it with core as it would the whole. Every answer may hold more than asked; none may hold less.
 */
export interface ScopedQueries {
  /** The entries of these ids that are there. */
  entries(ids: EntryId[]): Promise<Entry[]>;
  /** Every folder above each of these, up to the top. */
  ancestors(ids: EntryId[]): Promise<Entry[]>;
  /** What is right inside each folder, in the trash too. Of the top (null), only what `owners` own, or all of it without them. */
  children(parents: (EntryId | null)[], owners?: string[]): Promise<Entry[]>;
  /** Each, and everything under it. */
  subtrees(ids: EntryId[]): Promise<Entry[]>;
  /** The files changed last that `user` owns or changed, the latest first, at most `limit`. */
  recent(user: string, limit: number): Promise<Entry[]>;
  /** What is in the trash itself (not through a folder) that `user` owns or put there; or all of it, put there before `before`. */
  trashed(how: { user?: string; before?: string }): Promise<Entry[]>;
  /** What is shared with any of these (`ana`, `*`, `group:sales`). */
  sharedWith(names: string[]): Promise<Entry[]>;
  /** Whose name has every one of these words, folded as `foldText` folds them; at most `limit`. */
  named(words: string[], limit: number): Promise<Entry[]>;
  /** The files whose version now has one of these SHA-256. */
  withHashes(hashes: string[]): Promise<Entry[]>;
  /** What `owner` owns. */
  owned(owner: string): Promise<Entry[]>;
  /** The entry that has this link. */
  withLink(link: string): Promise<Entry | undefined>;
  /** What has the field `name` set to `value` (`fields` of an entry), at most `limit`. */
  withField(name: string, value: string, limit: number): Promise<Entry[]>;
  /** What has the field `name` set to a text no later than `upTo` (dates as YYYY-MM-DD), at most `limit`: what stops being good. */
  withFieldUpTo?(name: string, upTo: string, limit: number): Promise<Entry[]>;
  /** What has a link whose request for files reminds whom it was sent to, at most `limit`. */
  withReminders?(limit: number): Promise<Entry[]>;
}

export interface MetadataStore {
  load(): Promise<Drive>;
  /** The drive a piece at a time: with them, it is never loaded whole (`load` is not asked). */
  scoped?: ScopedQueries;
  save(changes: Changes): Promise<void>;
  /**
   * What changes with every save, by any process: asked on each request, so the drive is loaded again only when it
   * changed, and kept in memory meanwhile. Without it, it is loaded on every request.
   */
  revision?(): Promise<string>;
  /**
   * `work`, a load and a save, while no other process changes the drive: for a store more than one process
   * writes to. Without it, changes are put in order inside one process only.
   */
  lock?<T>(work: () => Promise<T>): Promise<T>;
  /** A setting kept by name (`drive`, `person:<id>`): what `setSetting` was given, or undefined. Without them, settings last as long as the process. */
  getSetting?(name: string): Promise<unknown>;
  setSetting?(name: string, value: unknown): Promise<void>;
  /** What was done, kept as it is said, in order. Without it and `activity`, the activity lasts as long as the process. */
  record?(lines: Activity[]): Promise<void>;
  /** What was done to an entry, and, of a folder, to what is right inside it: the newest first, at most `limit`. */
  activity?(id: EntryId, limit: number): Promise<Activity[]>;
  /** The text of a version of a file, to find it by; in place of what was kept for the file before. Without it and `findText`, kept in the process. */
  keepText?(id: EntryId, version: string, text: string): Promise<void>;
  /** The texts that may have every word of the query, at most `limit` of them: more are looked at again by the server, which keeps those that do. */
  findText?(query: string, limit: number): Promise<KeptText[]>;
  /** The text kept of a file, and of which version: for a copy of it to be found by it too. */
  textOf?(id: EntryId): Promise<KeptText | undefined>;
  /**
   * What was done after `cursor` (the one the last call gave; none for where it is now), in order, by any process:
   * how the server tells the pages watching what another process changed, without holding the drive.
   */
  activityAfter?(cursor: string | undefined): Promise<{ lines: Activity[]; cursor: string }>;
  /** What someone did, the newest first, at most `limit`: for what is exported of a person. */
  activityBy?(user: string, limit: number): Promise<Activity[]>;
  /** What was done anywhere in the drive, the newest first, at most `limit`: for who looks after it. */
  activityLatest?(limit: number): Promise<Activity[]>;
  /**
   * The comments of an entry, and one by its id; a comment kept (made or changed) and taken away. Without them, the
   * comments last as long as the process.
   */
  comments?(entry: EntryId): Promise<Comment[]>;
  comment?(id: string): Promise<Comment | undefined>;
  keepComment?(comment: Comment): Promise<void>;
  removeComment?(id: string): Promise<void>;
  /** The comments someone made, anywhere: for what is exported of a person. */
  commentsBy?(user: string): Promise<Comment[]>;
}

/** The text of a file, as a store keeps it. */
export interface KeptText {
  id: EntryId;
  version: string;
  text: string;
}

/** Words of a query as a full-text search of SQLite or Postgres takes them: each one the start of a word, all of them there. */
const prefixes = (query: string) => wordsOf(query);

/** The activity of an entry, from all of it, as a store without a query answers it. */
export const activityIn = (all: readonly Activity[], id: EntryId, limit: number) => {
  const found: Activity[] = [];
  for (let i = all.length - 1; i >= 0 && found.length < limit; i--) {
    const a = all[i];
    if (a.entry === id || a.parent === id || a.from === id) found.push(a);
  }
  return found;
};

/** What a row keeps beside an entry, to find it by without reading it: its owner, its name folded, its times. */
const columnsOf = (entry: Entry) => ({
  owner: entry.owner,
  folded: foldText(entry.name),
  modified: entry.modified,
  modified_by: entry.modifiedBy,
  kind: entry.kind,
  trashed_at: entry.trashed?.at ?? null,
  trashed_by: entry.trashed?.by ?? null,
  sha: entry.kind === 'file' ? (entry.versions[0].sha256 ?? null) : null,
});
const COLUMNS = ['owner', 'folded', 'modified', 'modified_by', 'kind', 'trashed_at', 'trashed_by', 'sha'] as const;
/** The LIKE of a word, its % and _ and \ taken as they are. */
const likeOf = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The answers of `ScopedQueries` from a drive held whole: what a store in memory gives, and what the others are checked against. */
export function scopedOver(current: () => Drive): ScopedQueries {
  const all = () => [...current().entries.values()];
  const byId = (id: EntryId) => current().entries.get(id);
  return {
    async entries(ids) {
      return ids.map(byId).filter((entry): entry is Entry => entry !== undefined);
    },
    async ancestors(ids) {
      const found = new Map<EntryId, Entry>();
      for (const id of ids)
        for (let at = byId(id)?.parent ?? null; at !== null && !found.has(at); ) {
          const folder = byId(at);
          if (!folder) break;
          found.set(at, folder);
          at = folder.parent;
        }
      return [...found.values()];
    },
    async children(parents, owners) {
      const wanted = new Set(parents);
      return all().filter((entry) => wanted.has(entry.parent) && (entry.parent !== null || !owners?.length || owners.includes(entry.owner)));
    },
    async subtrees(ids) {
      const found = new Map<EntryId, Entry>();
      const under = new Map<EntryId, Entry[]>();
      for (const entry of all()) if (entry.parent !== null) (under.get(entry.parent) ?? under.set(entry.parent, []).get(entry.parent)!).push(entry);
      const queue = ids.map(byId).filter((entry): entry is Entry => entry !== undefined);
      for (let i = 0; i < queue.length; i++) if (!found.has(queue[i].id)) found.set(queue[i].id, queue[i]), queue.push(...(under.get(queue[i].id) ?? []));
      return [...found.values()];
    },
    async recent(user, limit) {
      return all()
        .filter((entry) => entry.kind === 'file' && (entry.owner === user || entry.modifiedBy === user))
        .sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0))
        .slice(0, limit);
    },
    async trashed({ user, before }) {
      return all().filter((entry) => entry.trashed && (user === undefined || entry.owner === user || entry.trashed.by === user) && (before === undefined || entry.trashed.at < before));
    },
    async sharedWith(names) {
      return all().filter((entry) => entry.shares?.some((share) => names.includes(share.with)));
    },
    async named(words, limit) {
      return all()
        .filter((entry) => {
          const name = foldText(entry.name);
          return words.every((word) => name.includes(word));
        })
        .slice(0, limit);
    },
    async withHashes(hashes) {
      return all().filter((entry) => entry.kind === 'file' && entry.versions[0].sha256 !== undefined && hashes.includes(entry.versions[0].sha256));
    },
    async owned(owner) {
      return all().filter((entry) => entry.owner === owner);
    },
    async withLink(link) {
      return all().find((entry) => entry.links?.some((l) => l.id === link));
    },
    async withField(name, value, limit) {
      return all()
        .filter((entry) => entry.fields?.[name] === value)
        .slice(0, limit);
    },
    async withFieldUpTo(name, upTo, limit) {
      return all()
        .filter((entry) => !!entry.fields?.[name] && entry.fields[name] <= upTo)
        .slice(0, limit);
    },
    async withReminders(limit) {
      return all()
        .filter((entry) => entry.links?.some((link) => link.request?.remind))
        .slice(0, limit);
    },
  };
}

/** In memory: gone when the process ends. For tests and demos. */
export function memoryMetadata(entries: Iterable<Entry> = []): MetadataStore {
  let drive = driveOf(entries);
  const settings = new Map<string, unknown>();
  const lines: Activity[] = [];
  const texts = new Map<EntryId, KeptText>();
  const said = new Map<string, Comment>();
  let saved = 0;
  return {
    scoped: scopedOver(() => drive),
    async activityAfter(cursor) {
      const from = cursor === undefined ? lines.length : Number(cursor);
      return { lines: lines.slice(from), cursor: String(lines.length) };
    },
    async activityBy(user, limit) {
      return lines
        .filter((a) => a.by === user)
        .reverse()
        .slice(0, limit);
    },
    async activityLatest(limit) {
      return lines.slice(-limit).reverse();
    },
    async comments(entry) {
      return [...said.values()].filter((c) => c.entry === entry);
    },
    async comment(id) {
      return said.get(id);
    },
    async keepComment(comment) {
      said.set(comment.id, comment);
    },
    async removeComment(id) {
      said.delete(id);
    },
    async commentsBy(user) {
      return [...said.values()].filter((c) => c.by === user);
    },
    async keepText(id, version, text) {
      texts.set(id, { id, version, text });
    },
    async findText() {
      // All of them: the server looks for the words itself.
      return [...texts.values()];
    },
    async textOf(id) {
      return texts.get(id);
    },
    async record(more) {
      lines.push(...more);
    },
    async activity(id, limit) {
      return activityIn(lines, id, limit);
    },
    async revision() {
      return String(saved);
    },
    async getSetting(name) {
      return settings.get(name);
    },
    async setSetting(name, value) {
      settings.set(name, value);
    },
    async load() {
      return drive;
    },
    async save({ put, removed }) {
      const next = new Map(drive.entries);
      for (const entry of put) next.set(entry.id, entry);
      for (const id of removed) next.delete(id);
      drive = { entries: next };
      saved++;
    },
  };
}

/** A database of SQLite, with Node's own `node:sqlite`: one table, an entry per row. */
export async function sqliteMetadata(path: string): Promise<MetadataStore> {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_entries (id TEXT PRIMARY KEY, parent TEXT, entry TEXT NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_entries_parent ON rebofiles_entries (parent)');
  // The columns an entry is found by, beside it: added to a table made before them, and filled from what it holds.
  const have = new Set((db.prepare('PRAGMA table_info(rebofiles_entries)').all() as { name: string }[]).map((c) => c.name));
  for (const column of COLUMNS) if (!have.has(column)) db.exec(`ALTER TABLE rebofiles_entries ADD COLUMN ${column} TEXT`);
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_shares (entry TEXT NOT NULL, with_whom TEXT NOT NULL, PRIMARY KEY (entry, with_whom))');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_shares_with ON rebofiles_shares (with_whom)');
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_links (link TEXT PRIMARY KEY, entry TEXT NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_entries_owner ON rebofiles_entries (owner, modified)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_entries_by ON rebofiles_entries (modified_by, modified)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_entries_trashed ON rebofiles_entries (trashed_at) WHERE trashed_at IS NOT NULL');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_entries_sha ON rebofiles_entries (sha) WHERE sha IS NOT NULL');
  const all = db.prepare('SELECT entry FROM rebofiles_entries');
  const upsert = db.prepare(
    `INSERT INTO rebofiles_entries (id, parent, entry, ${COLUMNS.join(', ')}) VALUES (?, ?, ?, ${COLUMNS.map(() => '?').join(', ')})
     ON CONFLICT (id) DO UPDATE SET parent = excluded.parent, entry = excluded.entry, ${COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')}`,
  );
  const remove = db.prepare('DELETE FROM rebofiles_entries WHERE id = ?');
  const unshare = db.prepare('DELETE FROM rebofiles_shares WHERE entry = ?');
  const shareRow = db.prepare('INSERT OR IGNORE INTO rebofiles_shares (entry, with_whom) VALUES (?, ?)');
  const unlink = db.prepare('DELETE FROM rebofiles_links WHERE entry = ?');
  const linkRow = db.prepare('INSERT OR REPLACE INTO rebofiles_links (link, entry) VALUES (?, ?)');
  /** An entry written, with what it is found by. */
  const write = (entry: Entry) => {
    const c = columnsOf(entry);
    upsert.run(entry.id, entry.parent, JSON.stringify(entry), ...COLUMNS.map((name) => c[name]));
    unshare.run(entry.id);
    for (const share of entry.shares ?? []) shareRow.run(entry.id, share.with);
    unlink.run(entry.id);
    for (const link of entry.links ?? []) linkRow.run(link.id, entry.id);
  };
  const forget = (id: EntryId) => {
    remove.run(id);
    unshare.run(id);
    unlink.run(id);
  };
  // Rows written before the columns were there: filled once, from what each holds.
  const unfilled = db.prepare('SELECT entry FROM rebofiles_entries WHERE owner IS NULL').all() as { entry: string }[];
  if (unfilled.length) {
    db.exec('BEGIN');
    try {
      for (const row of unfilled) write(JSON.parse(row.entry) as Entry);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const rows = (found: unknown[]) => (found as { entry: string }[]).map((row) => JSON.parse(row.entry) as Entry);
  const byIds = db.prepare('SELECT entry FROM rebofiles_entries WHERE id IN (SELECT value FROM json_each(?))');
  const above = db.prepare(`WITH RECURSIVE up(id) AS (
      SELECT parent FROM rebofiles_entries WHERE id IN (SELECT value FROM json_each(?)) AND parent IS NOT NULL
      UNION SELECT e.parent FROM rebofiles_entries e JOIN up ON e.id = up.id WHERE e.parent IS NOT NULL)
    SELECT entry FROM rebofiles_entries WHERE id IN (SELECT id FROM up)`);
  const inside = db.prepare('SELECT entry FROM rebofiles_entries WHERE parent IN (SELECT value FROM json_each(?))');
  const topOf = db.prepare('SELECT entry FROM rebofiles_entries WHERE parent IS NULL AND owner IN (SELECT value FROM json_each(?))');
  const top = db.prepare('SELECT entry FROM rebofiles_entries WHERE parent IS NULL');
  const below = db.prepare(`WITH RECURSIVE down(id) AS (
      SELECT value FROM json_each(?) UNION SELECT e.id FROM rebofiles_entries e JOIN down ON e.parent = down.id)
    SELECT entry FROM rebofiles_entries WHERE id IN (SELECT id FROM down)`);
  const lately = db.prepare(
    "SELECT entry FROM rebofiles_entries WHERE kind = 'file' AND id IN (SELECT id FROM rebofiles_entries WHERE owner = ? UNION SELECT id FROM rebofiles_entries WHERE modified_by = ?) ORDER BY modified DESC LIMIT ?",
  );
  const binOf = db.prepare('SELECT entry FROM rebofiles_entries WHERE trashed_at IS NOT NULL AND (owner = ? OR trashed_by = ?)');
  const binBefore = db.prepare('SELECT entry FROM rebofiles_entries WHERE trashed_at IS NOT NULL AND trashed_at < ?');
  const shared = db.prepare('SELECT entry FROM rebofiles_entries WHERE id IN (SELECT entry FROM rebofiles_shares WHERE with_whom IN (SELECT value FROM json_each(?)))');
  const hashed = db.prepare('SELECT entry FROM rebofiles_entries WHERE sha IN (SELECT value FROM json_each(?))');
  const ownedBy = db.prepare('SELECT entry FROM rebofiles_entries WHERE owner = ?');
  const linkedBy = db.prepare('SELECT entry FROM rebofiles_entries WHERE id = (SELECT entry FROM rebofiles_links WHERE link = ?)');
  const fielded = db.prepare('SELECT entry FROM rebofiles_entries WHERE json_extract(entry, ?) = ? LIMIT ?');
  const fieldedUpTo = db.prepare("SELECT entry FROM rebofiles_entries WHERE json_extract(entry, ?) > '' AND json_extract(entry, ?) <= ? LIMIT ?");
  const reminding = db.prepare(
    "SELECT entry FROM rebofiles_entries WHERE id IN (SELECT entry FROM rebofiles_links) AND EXISTS (SELECT 1 FROM json_each(entry, '$.links') WHERE json_extract(value, '$.request.remind') IS NOT NULL) LIMIT ?",
  );
  const scoped: ScopedQueries = {
    entries: async (ids) => rows(byIds.all(JSON.stringify(ids))),
    ancestors: async (ids) => rows(above.all(JSON.stringify(ids))),
    async children(parents, owners) {
      const found = rows(inside.all(JSON.stringify(parents.filter((p) => p !== null))));
      if (parents.includes(null)) found.push(...rows(owners?.length ? topOf.all(JSON.stringify(owners)) : top.all()));
      return found;
    },
    subtrees: async (ids) => rows(below.all(JSON.stringify(ids))),
    recent: async (user, limit) => rows(lately.all(user, user, limit)),
    trashed: async ({ user, before }) => rows(user !== undefined ? binOf.all(user, user) : binBefore.all(before ?? '\uffff')).filter((e) => before === undefined || e.trashed!.at < before),
    sharedWith: async (names) => rows(shared.all(JSON.stringify(names))),
    async named(words, limit) {
      if (!words.length) return [];
      const query = `SELECT entry FROM rebofiles_entries WHERE ${words.map(() => "folded LIKE ? ESCAPE '\\'").join(' AND ')} LIMIT ?`;
      return rows(db.prepare(query).all(...words.map(likeOf), limit));
    },
    withHashes: async (hashes) => rows(hashed.all(JSON.stringify(hashes))),
    owned: async (owner) => rows(ownedBy.all(owner)),
    withLink: async (link) => rows(linkedBy.all(link))[0],
    // A name is of letters, digits and `_ . -` (core's FIELD_NAME), so quoted it is a path of JSON as it is.
    withField: async (name, value, limit) => rows(fielded.all(`$.fields."${name}"`, value, limit)),
    withFieldUpTo: async (name, upTo, limit) => rows(fieldedUpTo.all(`$.fields."${name}"`, `$.fields."${name}"`, upTo, limit)),
    withReminders: async (limit) => rows(reminding.all(limit)),
  };
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
  // One row, one number, one more at every save: what says whether the drive in memory is the one in the file.
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_revision (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL)');
  db.exec('INSERT OR IGNORE INTO rebofiles_revision (id, n) VALUES (1, 0)');
  const revision = db.prepare('SELECT n FROM rebofiles_revision WHERE id = 1');
  const bump = db.prepare('UPDATE rebofiles_revision SET n = n + 1 WHERE id = 1');
  const setting = db.prepare('SELECT value FROM rebofiles_settings WHERE name = ?');
  const keep = db.prepare('INSERT INTO rebofiles_settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value');
  // A line of activity per row, with the entries it is about apart, to be found by any of them.
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_activity (seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL, parent TEXT, origin TEXT, line TEXT NOT NULL)');
  for (const column of ['entry', 'parent', 'origin']) db.exec(`CREATE INDEX IF NOT EXISTS rebofiles_activity_${column} ON rebofiles_activity (${column}, seq)`);
  const note = db.prepare('INSERT INTO rebofiles_activity (entry, parent, origin, line) VALUES (?, ?, ?, ?)');
  const about = db.prepare('SELECT line FROM rebofiles_activity WHERE entry = ? OR parent = ? OR origin = ? ORDER BY seq DESC LIMIT ?');
  // The text of each file in a table of SQLite's full-text search, without minding case or accents.
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS rebofiles_text USING fts5(id UNINDEXED, version UNINDEXED, body, tokenize = 'unicode61 remove_diacritics 2')");
  const unkeep = db.prepare('DELETE FROM rebofiles_text WHERE id = ?');
  const keepIt = db.prepare('INSERT INTO rebofiles_text (id, version, body) VALUES (?, ?, ?)');
  const textById = db.prepare('SELECT id, version, body FROM rebofiles_text WHERE id = ?');
  const match = db.prepare('SELECT id, version, body FROM rebofiles_text WHERE rebofiles_text MATCH ? ORDER BY rank LIMIT ?');
  const byWhom = db.prepare("SELECT line FROM rebofiles_activity WHERE json_extract(line, '$.by') = ? ORDER BY seq DESC LIMIT ?");
  const lastSeq = db.prepare('SELECT coalesce(max(seq), 0) AS n FROM rebofiles_activity');
  const afterSeq = db.prepare('SELECT seq, line FROM rebofiles_activity WHERE seq > ? ORDER BY seq LIMIT 1000');
  const latest = db.prepare('SELECT line FROM rebofiles_activity ORDER BY seq DESC LIMIT ?');
  // A comment per row, by the entry it is on and by who made it.
  db.exec('CREATE TABLE IF NOT EXISTS rebofiles_comments (id TEXT PRIMARY KEY, entry TEXT NOT NULL, by_whom TEXT NOT NULL, at TEXT NOT NULL, comment TEXT NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_comments_entry ON rebofiles_comments (entry, at)');
  db.exec('CREATE INDEX IF NOT EXISTS rebofiles_comments_by ON rebofiles_comments (by_whom)');
  const commentsOn = db.prepare('SELECT comment FROM rebofiles_comments WHERE entry = ? ORDER BY at');
  const commentById = db.prepare('SELECT comment FROM rebofiles_comments WHERE id = ?');
  const commentsOf = db.prepare('SELECT comment FROM rebofiles_comments WHERE by_whom = ? ORDER BY at');
  const keepComment = db.prepare('INSERT INTO rebofiles_comments (id, entry, by_whom, at, comment) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET comment = excluded.comment');
  const unsay = db.prepare('DELETE FROM rebofiles_comments WHERE id = ?');
  const parsed = (rows: unknown[]) => (rows as { comment: string }[]).map((row) => JSON.parse(row.comment) as Comment);
  return {
    scoped,
    async activityAfter(cursor) {
      if (cursor === undefined) return { lines: [], cursor: String((lastSeq.get() as { n: number }).n) };
      const found = afterSeq.all(Number(cursor)) as { seq: number; line: string }[];
      return { lines: found.map((row) => JSON.parse(row.line) as Activity), cursor: String(found.at(-1)?.seq ?? cursor) };
    },
    async activityBy(user, limit) {
      return (byWhom.all(user, limit) as { line: string }[]).map((row) => JSON.parse(row.line) as Activity);
    },
    async activityLatest(limit) {
      return (latest.all(limit) as { line: string }[]).map((row) => JSON.parse(row.line) as Activity);
    },
    async comments(entry) {
      return parsed(commentsOn.all(entry));
    },
    async comment(id) {
      return parsed(commentById.all(id))[0];
    },
    async keepComment(comment) {
      keepComment.run(comment.id, comment.entry, comment.by, comment.at, JSON.stringify(comment));
    },
    async removeComment(id) {
      unsay.run(id);
    },
    async commentsBy(user) {
      return parsed(commentsOf.all(user));
    },
    async keepText(id, version, text) {
      db.exec('BEGIN');
      try {
        unkeep.run(id);
        keepIt.run(id, version, text);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async findText(query, limit) {
      const words = prefixes(query);
      if (!words.length) return [];
      const rows = match.all(words.map((word) => `"${word}"*`).join(' '), limit) as { id: string; version: string; body: string }[];
      return rows.map((row) => ({ id: row.id, version: row.version, text: row.body }));
    },
    async textOf(id) {
      const row = textById.get(id) as { id: string; version: string; body: string } | undefined;
      return row && { id: row.id, version: row.version, text: row.body };
    },
    async record(more) {
      db.exec('BEGIN');
      try {
        for (const a of more) note.run(a.entry, a.parent, a.from ?? null, JSON.stringify(a));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async activity(id, limit) {
      return (about.all(id, id, id, limit) as { line: string }[]).map((row) => JSON.parse(row.line) as Activity);
    },
    async revision() {
      return String((revision.get() as { n: number }).n);
    },
    async getSetting(name) {
      const row = setting.get(name) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },
    async setSetting(name, value) {
      keep.run(name, JSON.stringify(value));
    },
    async load() {
      const rows = all.all() as { entry: string }[];
      return rows.length ? driveOf(rows.map((row) => JSON.parse(row.entry) as Entry)) : emptyDrive();
    },
    async save({ put, removed }) {
      db.exec('BEGIN');
      try {
        for (const entry of put) write(entry);
        for (const id of removed) forget(id);
        bump.run();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** What `postgresMetadata` asks of a database: `pg`'s Client or Pool, Neon's, PGlite, or a line around another. */
export interface PostgresClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** A pool, whose connections hold a lock for a change: with one, any number of processes may share the drive. */
export interface PostgresPool extends PostgresClient {
  connect(): Promise<PostgresClient & { release(): void }>;
}

export interface PostgresOptions {
  /** The table, made when it is not there: `rebofiles_entries` unless said. */
  table?: string;
}

/**
 * A database of Postgres: one table, an entry per row as jsonb. A change is written in one statement, so it is
 * whole or not at all; given a pool, each change also holds a lock of the database, so two processes never change
 * the drive at once. The driver is the application's: nothing of it is imported here.
 */
export async function postgresMetadata(db: PostgresClient | PostgresPool, options: PostgresOptions = {}): Promise<MetadataStore> {
  const table = options.table ?? 'rebofiles_entries';
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error(`"${table}" cannot be the name of a table here: letters, digits and _ only.`);
  const pool = 'connect' in db ? db : undefined;
  /** `work` while no other process holds the lock of this table; as it is, without a pool to hold it on. */
  const exclusive = async <T>(work: () => Promise<T>): Promise<T> => {
    if (!pool) return work();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Let go of when the transaction ends, or when the connection does, should the process die holding it.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [table]);
      const done = await work();
      await client.query('COMMIT');
      return done;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
  // Under the lock too: two processes starting at once would both make the table, and one of them fail.
  await exclusive(async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, parent text, entry jsonb NOT NULL)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_parent ON ${table} (parent)`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_settings (name text PRIMARY KEY, value jsonb NOT NULL)`);
    // One row, one number, one more at every save by any process: whether the drive another holds in memory is still the one here.
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_revision (id int PRIMARY KEY CHECK (id = 1), n bigint NOT NULL)`);
    await db.query(`INSERT INTO ${table}_revision (id, n) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_activity (seq bigserial PRIMARY KEY, entry text NOT NULL, parent text, origin text, line jsonb NOT NULL)`);
    for (const column of ['entry', 'parent', 'origin']) await db.query(`CREATE INDEX IF NOT EXISTS ${table}_activity_${column} ON ${table}_activity (${column}, seq)`);
    // The text of each file, and its words without case or accents, folded here as the queries are.
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_text (id text PRIMARY KEY, version text NOT NULL, body text NOT NULL, words tsvector NOT NULL)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_text_words ON ${table}_text USING gin (words)`);
    // The columns an entry is found by, beside it, and what it is shared with and its links, each in a table of its own.
    for (const column of COLUMNS) await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} text`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_owner ON ${table} (owner, modified)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_by ON ${table} (modified_by, modified)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_trashed ON ${table} (trashed_at) WHERE trashed_at IS NOT NULL`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_sha ON ${table} (sha) WHERE sha IS NOT NULL`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_shares (entry text NOT NULL, with_whom text NOT NULL, PRIMARY KEY (entry, with_whom))`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_shares_with ON ${table}_shares (with_whom)`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_links (link text PRIMARY KEY, entry text NOT NULL)`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${table}_comments (id text PRIMARY KEY, entry text NOT NULL, by_whom text NOT NULL, at text NOT NULL, comment jsonb NOT NULL)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_comments_entry ON ${table}_comments (entry, at)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_comments_by ON ${table}_comments (by_whom)`);
  });
  const parsed = (rows: unknown[]) => (rows as { comment: Comment | string }[]).map((row) => (typeof row.comment === 'string' ? (JSON.parse(row.comment) as Comment) : row.comment));
  const record = `jsonb_to_recordset($1::jsonb) AS r(id text, parent text, entry jsonb, ${COLUMNS.map((c) => `${c} text`).join(', ')})`;
  const upsert = `INSERT INTO ${table} (id, parent, entry, ${COLUMNS.join(', ')}) SELECT id, parent, entry, ${COLUMNS.join(', ')} FROM ${record}
    ON CONFLICT (id) DO UPDATE SET parent = excluded.parent, entry = excluded.entry, ${COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  const rowsOf = (entries: Entry[]) => JSON.stringify(entries.map((entry) => ({ id: entry.id, parent: entry.parent, entry, ...columnsOf(entry) })));
  /** Entries written, with what they are found by, in one transaction on one connection: all of it, or none. */
  const write = async (put: Entry[], removed: EntryId[], bump: boolean) => {
    const client = pool ? await pool.connect() : undefined;
    const c = client ?? db;
    try {
      await c.query('BEGIN');
      const touched = [...removed, ...put.map((entry) => entry.id)];
      if (removed.length) await c.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [removed]);
      await c.query(`DELETE FROM ${table}_shares WHERE entry = ANY($1::text[])`, [touched]);
      await c.query(`DELETE FROM ${table}_links WHERE entry = ANY($1::text[])`, [touched]);
      if (put.length) {
        await c.query(upsert, [rowsOf(put)]);
        const shares = put.flatMap((entry) => (entry.shares ?? []).map((share) => ({ entry: entry.id, with_whom: share.with })));
        if (shares.length)
          await c.query(`INSERT INTO ${table}_shares (entry, with_whom) SELECT entry, with_whom FROM jsonb_to_recordset($1::jsonb) AS r(entry text, with_whom text) ON CONFLICT DO NOTHING`, [
            JSON.stringify(shares),
          ]);
        const links = put.flatMap((entry) => (entry.links ?? []).map((link) => ({ link: link.id, entry: entry.id })));
        if (links.length)
          await c.query(
            `INSERT INTO ${table}_links (link, entry) SELECT link, entry FROM jsonb_to_recordset($1::jsonb) AS r(link text, entry text) ON CONFLICT (link) DO UPDATE SET entry = excluded.entry`,
            [JSON.stringify(links)],
          );
      }
      // The change and the number that says it, together or not at all.
      if (bump) await c.query(`UPDATE ${table}_revision SET n = n + 1 WHERE id = 1`);
      await c.query('COMMIT');
    } catch (error) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client?.release();
    }
  };
  const entriesOf = (rows: unknown[]) => (rows as { entry: Entry | string }[]).map((row) => (typeof row.entry === 'string' ? (JSON.parse(row.entry) as Entry) : row.entry));
  const ask = async (text: string, values: unknown[] = []) => entriesOf((await db.query(text, values)).rows);
  // Rows written before the columns were there: filled once, a thousand at a time, from what each holds.
  await exclusive(async () => {
    const filled = new Set<EntryId>();
    for (;;) {
      const unfilled = (await ask(`SELECT entry FROM ${table} WHERE owner IS NULL LIMIT 1000`)).filter((entry) => !filled.has(entry.id));
      // None left, or none that writing fills: a driver that answers otherwise is not asked forever.
      if (!unfilled.length) break;
      await write(unfilled, [], false);
      for (const entry of unfilled) filled.add(entry.id);
    }
  });
  const scoped: ScopedQueries = {
    entries: (ids) => ask(`SELECT entry FROM ${table} WHERE id = ANY($1::text[])`, [ids]),
    ancestors: (ids) =>
      ask(
        `WITH RECURSIVE up(id) AS (SELECT parent FROM ${table} WHERE id = ANY($1::text[]) AND parent IS NOT NULL
          UNION SELECT e.parent FROM ${table} e JOIN up ON e.id = up.id WHERE e.parent IS NOT NULL)
         SELECT entry FROM ${table} WHERE id IN (SELECT id FROM up)`,
        [ids],
      ),
    async children(parents, owners) {
      const found = await ask(`SELECT entry FROM ${table} WHERE parent = ANY($1::text[])`, [parents.filter((p) => p !== null)]);
      if (parents.includes(null))
        found.push(
          ...(owners?.length ? await ask(`SELECT entry FROM ${table} WHERE parent IS NULL AND owner = ANY($1::text[])`, [owners]) : await ask(`SELECT entry FROM ${table} WHERE parent IS NULL`)),
        );
      return found;
    },
    subtrees: (ids) =>
      ask(
        `WITH RECURSIVE down(id) AS (SELECT unnest($1::text[]) UNION SELECT e.id FROM ${table} e JOIN down ON e.parent = down.id)
         SELECT entry FROM ${table} WHERE id IN (SELECT id FROM down)`,
        [ids],
      ),
    recent: (user, limit) => ask(`SELECT entry FROM ${table} WHERE kind = 'file' AND (owner = $1 OR modified_by = $1) ORDER BY modified DESC LIMIT $2`, [user, limit]),
    trashed: ({ user, before }) =>
      user !== undefined
        ? ask(`SELECT entry FROM ${table} WHERE trashed_at IS NOT NULL AND (owner = $1 OR trashed_by = $1)`, [user]).then((found) =>
            found.filter((e) => before === undefined || e.trashed!.at < before),
          )
        : ask(`SELECT entry FROM ${table} WHERE trashed_at IS NOT NULL AND trashed_at < $1`, [before ?? '\uffff']),
    sharedWith: (names) => ask(`SELECT entry FROM ${table} WHERE id IN (SELECT entry FROM ${table}_shares WHERE with_whom = ANY($1::text[]))`, [names]),
    named: (words, limit) =>
      words.length
        ? ask(`SELECT entry FROM ${table} WHERE ${words.map((_, i) => `folded LIKE $${i + 1} ESCAPE '\\'`).join(' AND ')} LIMIT $${words.length + 1}`, [...words.map(likeOf), limit])
        : Promise.resolve([]),
    withHashes: (hashes) => ask(`SELECT entry FROM ${table} WHERE sha = ANY($1::text[])`, [hashes]),
    owned: (owner) => ask(`SELECT entry FROM ${table} WHERE owner = $1`, [owner]),
    withLink: async (link) => (await ask(`SELECT entry FROM ${table} WHERE id = (SELECT entry FROM ${table}_links WHERE link = $1)`, [link]))[0],
    withField: (name, value, limit) => ask(`SELECT entry FROM ${table} WHERE entry->'fields'->>$1 = $2 LIMIT $3`, [name, value, limit]),
    withFieldUpTo: (name, upTo, limit) => ask(`SELECT entry FROM ${table} WHERE entry->'fields'->>$1 > '' AND entry->'fields'->>$1 <= $2 LIMIT $3`, [name, upTo, limit]),
    withReminders: (limit) => ask(`SELECT entry FROM ${table} WHERE jsonb_path_exists(entry, '$.links[*].request.remind') LIMIT $1`, [limit]),
  };
  return {
    async load() {
      const { rows } = await db.query(`SELECT entry FROM ${table}`);
      // jsonb comes parsed from most drivers, and as text from some.
      const entries = (rows as { entry: Entry | string }[]).map((row) => (typeof row.entry === 'string' ? (JSON.parse(row.entry) as Entry) : row.entry));
      return entries.length ? driveOf(entries) : emptyDrive();
    },
    async save({ put, removed }) {
      if (put.length || removed.length) await write(put, removed, true);
    },
    scoped,
    lock: pool ? exclusive : undefined,
    async revision() {
      const { rows } = await db.query(`SELECT n FROM ${table}_revision WHERE id = 1`);
      return String((rows[0] as { n: string | number } | undefined)?.n ?? 0);
    },
    async getSetting(name) {
      const { rows } = await db.query(`SELECT value FROM ${table}_settings WHERE name = $1`, [name]);
      const value = (rows[0] as { value: unknown } | undefined)?.value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
    async record(more) {
      if (more.length)
        await db.query(
          `INSERT INTO ${table}_activity (entry, parent, origin, line) SELECT a->>'entry', a->>'parent', a->>'from', a FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(a, n) ORDER BY n`,
          [JSON.stringify(more)],
        );
    },
    async keepText(id, version, text) {
      await db.query(
        `INSERT INTO ${table}_text (id, version, body, words) VALUES ($1, $2, $3, to_tsvector('simple', $4)) ON CONFLICT (id) DO UPDATE SET version = excluded.version, body = excluded.body, words = excluded.words`,
        [id, version, text, wordsOf(text).join(' ')],
      );
    },
    async findText(query, limit) {
      const words = prefixes(query);
      if (!words.length) return [];
      const { rows } = await db.query(`SELECT id, version, body FROM ${table}_text WHERE words @@ to_tsquery('simple', $1) LIMIT $2`, [words.map((word) => `${word}:*`).join(' & '), limit]);
      return (rows as { id: string; version: string; body: string }[]).map((row) => ({ id: row.id, version: row.version, text: row.body }));
    },
    async textOf(id) {
      const { rows } = await db.query(`SELECT id, version, body FROM ${table}_text WHERE id = $1`, [id]);
      const row = (rows as { id: string; version: string; body: string }[])[0];
      return row && { id: row.id, version: row.version, text: row.body };
    },
    async activity(id, limit) {
      const { rows } = await db.query(`SELECT line FROM ${table}_activity WHERE entry = $1 OR parent = $1 OR origin = $1 ORDER BY seq DESC LIMIT $2`, [id, limit]);
      return (rows as { line: Activity | string }[]).map((row) => (typeof row.line === 'string' ? (JSON.parse(row.line) as Activity) : row.line));
    },
    async activityAfter(cursor) {
      if (cursor === undefined) return { lines: [], cursor: String(((await db.query(`SELECT coalesce(max(seq), 0) AS n FROM ${table}_activity`)).rows[0] as { n: string | number }).n) };
      const { rows } = await db.query(`SELECT seq, line FROM ${table}_activity WHERE seq > $1 ORDER BY seq LIMIT 1000`, [cursor]);
      const found = rows as { seq: string | number; line: Activity | string }[];
      return { lines: found.map((row) => (typeof row.line === 'string' ? (JSON.parse(row.line) as Activity) : row.line)), cursor: String(found.at(-1)?.seq ?? cursor) };
    },
    async activityBy(user, limit) {
      const { rows } = await db.query(`SELECT line FROM ${table}_activity WHERE line->>'by' = $1 ORDER BY seq DESC LIMIT $2`, [user, limit]);
      return (rows as { line: Activity | string }[]).map((row) => (typeof row.line === 'string' ? (JSON.parse(row.line) as Activity) : row.line));
    },
    async activityLatest(limit) {
      const { rows } = await db.query(`SELECT line FROM ${table}_activity ORDER BY seq DESC LIMIT $1`, [limit]);
      return (rows as { line: Activity | string }[]).map((row) => (typeof row.line === 'string' ? (JSON.parse(row.line) as Activity) : row.line));
    },
    async comments(entry) {
      return parsed((await db.query(`SELECT comment FROM ${table}_comments WHERE entry = $1 ORDER BY at`, [entry])).rows);
    },
    async comment(id) {
      return parsed((await db.query(`SELECT comment FROM ${table}_comments WHERE id = $1`, [id])).rows)[0];
    },
    async keepComment(comment) {
      await db.query(`INSERT INTO ${table}_comments (id, entry, by_whom, at, comment) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (id) DO UPDATE SET comment = excluded.comment`, [
        comment.id,
        comment.entry,
        comment.by,
        comment.at,
        JSON.stringify(comment),
      ]);
    },
    async removeComment(id) {
      await db.query(`DELETE FROM ${table}_comments WHERE id = $1`, [id]);
    },
    async commentsBy(user) {
      return parsed((await db.query(`SELECT comment FROM ${table}_comments WHERE by_whom = $1 ORDER BY at`, [user])).rows);
    },
    async setSetting(name, value) {
      await db.query(`INSERT INTO ${table}_settings (name, value) VALUES ($1, $2::jsonb) ON CONFLICT (name) DO UPDATE SET value = excluded.value`, [name, JSON.stringify(value)]);
    },
  };
}
