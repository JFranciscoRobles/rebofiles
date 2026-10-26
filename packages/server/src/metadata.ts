// Where the drive's entries are kept: folders, names, owners, the trash,
// versions. A bucket keeps none of that, so it is a store of its own, beside
// the bytes. The server loads the drive, changes it with core and writes back
// only what changed.

import { type Activity, type Changes, type Drive, type Entry, type EntryId, driveOf, emptyDrive, wordsOf } from '@rebofiles/core';

export interface MetadataStore {
  load(): Promise<Drive>;
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

/** In memory: gone when the process ends. For tests and demos. */
export function memoryMetadata(entries: Iterable<Entry> = []): MetadataStore {
  let drive = driveOf(entries);
  const settings = new Map<string, unknown>();
  const lines: Activity[] = [];
  const texts = new Map<EntryId, KeptText>();
  let saved = 0;
  return {
    async keepText(id, version, text) {
      texts.set(id, { id, version, text });
    },
    async findText() {
      // All of them: the server looks for the words itself.
      return [...texts.values()];
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
  const all = db.prepare('SELECT entry FROM rebofiles_entries');
  const upsert = db.prepare('INSERT INTO rebofiles_entries (id, parent, entry) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET parent = excluded.parent, entry = excluded.entry');
  const remove = db.prepare('DELETE FROM rebofiles_entries WHERE id = ?');
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
  const match = db.prepare('SELECT id, version, body FROM rebofiles_text WHERE rebofiles_text MATCH ? ORDER BY rank LIMIT ?');
  return {
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
        for (const entry of put) upsert.run(entry.id, entry.parent, JSON.stringify(entry));
        for (const id of removed) remove.run(id);
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
  });
  // One statement: the rows removed and the rows put, together or not at all, without a transaction to hold open.
  // The revision goes up in the same statement: the change and the number that says it, together or not at all.
  const write = `WITH removed AS (DELETE FROM ${table} WHERE id = ANY($2::text[])),
    bumped AS (UPDATE ${table}_revision SET n = n + 1 WHERE id = 1)
    INSERT INTO ${table} (id, parent, entry) SELECT e->>'id', e->>'parent', e FROM jsonb_array_elements($1::jsonb) AS e
    ON CONFLICT (id) DO UPDATE SET parent = excluded.parent, entry = excluded.entry`;
  return {
    async load() {
      const { rows } = await db.query(`SELECT entry FROM ${table}`);
      // jsonb comes parsed from most drivers, and as text from some.
      const entries = (rows as { entry: Entry | string }[]).map((row) => (typeof row.entry === 'string' ? (JSON.parse(row.entry) as Entry) : row.entry));
      return entries.length ? driveOf(entries) : emptyDrive();
    },
    async save({ put, removed }) {
      if (put.length || removed.length) await db.query(write, [JSON.stringify(put), removed]);
    },
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
    async activity(id, limit) {
      const { rows } = await db.query(`SELECT line FROM ${table}_activity WHERE entry = $1 OR parent = $1 OR origin = $1 ORDER BY seq DESC LIMIT $2`, [id, limit]);
      return (rows as { line: Activity | string }[]).map((row) => (typeof row.line === 'string' ? (JSON.parse(row.line) as Activity) : row.line));
    },
    async setSetting(name, value) {
      await db.query(`INSERT INTO ${table}_settings (name, value) VALUES ($1, $2::jsonb) ON CONFLICT (name) DO UPDATE SET value = excluded.value`, [name, JSON.stringify(value)]);
    },
  };
}
