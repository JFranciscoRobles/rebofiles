// Where the drive's entries are kept: folders, names, owners, the trash,
// versions. A bucket keeps none of that, so it is a store of its own, beside
// the bytes. The server loads the drive, changes it with core and writes back
// only what changed.

import { type Changes, type Drive, type Entry, driveOf, emptyDrive } from '@rebofiles/core';

export interface MetadataStore {
  load(): Promise<Drive>;
  save(changes: Changes): Promise<void>;
}

/** In memory: gone when the process ends. For tests and demos. */
export function memoryMetadata(entries: Iterable<Entry> = []): MetadataStore {
  let drive = driveOf(entries);
  return {
    async load() {
      return drive;
    },
    async save({ put, removed }) {
      const next = new Map(drive.entries);
      for (const entry of put) next.set(entry.id, entry);
      for (const id of removed) next.delete(id);
      drive = { entries: next };
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
  return {
    async load() {
      const rows = all.all() as { entry: string }[];
      return rows.length ? driveOf(rows.map((row) => JSON.parse(row.entry) as Entry)) : emptyDrive();
    },
    async save({ put, removed }) {
      db.exec('BEGIN');
      try {
        for (const entry of put) upsert.run(entry.id, entry.parent, JSON.stringify(entry));
        for (const id of removed) remove.run(id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
