// The schema of the database: the tables the stores of @rebofiles/server make,
// what is in each row, and why it is laid out so. Written from
// packages/server/src/metadata.ts and packages/core/src/model.ts: change them together.

import { hrefOf } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../ui';

const POSTGRES = `-- The entries: one row each, the whole entry as JSON.
CREATE TABLE rebofiles_entries (
  id     text PRIMARY KEY,
  parent text,                 -- the folder it is in; null at the top
  entry  jsonb NOT NULL        -- the entry itself: see "An entry, as it is kept"
);
CREATE INDEX rebofiles_entries_parent ON rebofiles_entries (parent);

-- Settings by name: the drive's, each person's, the passwords of links.
CREATE TABLE rebofiles_entries_settings (
  name  text PRIMARY KEY,
  value jsonb NOT NULL
);

-- One row, one number, one more at every change by any process.
CREATE TABLE rebofiles_entries_revision (
  id int PRIMARY KEY CHECK (id = 1),
  n  bigint NOT NULL
);
INSERT INTO rebofiles_entries_revision (id, n) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- What was done: a line each, found by the entry and the folders it is about.
CREATE TABLE rebofiles_entries_activity (
  seq    bigserial PRIMARY KEY,
  entry  text NOT NULL,        -- what it was done to
  parent text,                 -- the folder it is in (for one moved, the one it went to)
  origin text,                 -- for one moved, the folder it left
  line   jsonb NOT NULL
);
CREATE INDEX rebofiles_entries_activity_entry  ON rebofiles_entries_activity (entry, seq);
CREATE INDEX rebofiles_entries_activity_parent ON rebofiles_entries_activity (parent, seq);
CREATE INDEX rebofiles_entries_activity_origin ON rebofiles_entries_activity (origin, seq);

-- What is written in each file, to find it by: the version it is of, and its words.
CREATE TABLE rebofiles_entries_text (
  id      text PRIMARY KEY,    -- the file
  version text NOT NULL,       -- the version the text is of; another one's is not found
  body    text NOT NULL,       -- the first 100,000 characters
  words   tsvector NOT NULL    -- to_tsvector('simple', …) of the words, without case or accents
);
CREATE INDEX rebofiles_entries_text_words ON rebofiles_entries_text USING gin (words);`;

const SQLITE = `CREATE TABLE rebofiles_entries (id TEXT PRIMARY KEY, parent TEXT, entry TEXT NOT NULL);
CREATE INDEX rebofiles_entries_parent ON rebofiles_entries (parent);

CREATE TABLE rebofiles_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE rebofiles_revision (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL);
INSERT OR IGNORE INTO rebofiles_revision (id, n) VALUES (1, 0);

CREATE TABLE rebofiles_activity (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL, parent TEXT, origin TEXT, line TEXT NOT NULL
);
CREATE INDEX rebofiles_activity_entry  ON rebofiles_activity (entry, seq);
CREATE INDEX rebofiles_activity_parent ON rebofiles_activity (parent, seq);
CREATE INDEX rebofiles_activity_origin ON rebofiles_activity (origin, seq);

-- SQLite's own full-text search: without minding case or accents.
CREATE VIRTUAL TABLE rebofiles_text USING fts5(id UNINDEXED, version UNINDEXED, body, tokenize = 'unicode61 remove_diacritics 2');`;

const FILE = `{
  "kind": "file",
  "id": "5b0c…",
  "name": "contract.docx",
  "parent": "a1f3…",                      // the folder; null at the top
  "owner": "ana",                          // the id identify() gave
  "created": "2026-10-20T09:12:00.000Z",
  "modified": "2026-10-26T16:40:00.000Z",
  "modifiedBy": "bea",
  "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "versions": [                            // the newest first; never empty
    {
      "id": "v2…", "key": "5b0c…/v2…",     // where the bytes are in the bucket
      "size": 48213, "at": "2026-10-26T16:40:00.000Z", "by": "bea",
      "sha256": "9f86d0…",                 // to tell the same file uploaded again
      "placeholder": "data:image/jpeg;base64,/9j/4AAQ…",
      "renditions": [                      // its first page, or a picture, made smaller
        { "size": 480, "width": 480, "height": 679, "key": "5b0c…/v2…@480", "type": "image/jpeg", "bytes": 31877 }
      ]
    },
    { "id": "v1…", "key": "5b0c…/v1…", "size": 47990, "at": "2026-10-20T09:12:00.000Z", "by": "ana" }
  ],
  "shares": [{ "with": "bea", "role": "editor", "by": "ana", "at": "2026-10-21T10:00:00.000Z" }],
  "links": [
    { "id": "l9…", "role": "viewer", "expires": "2026-11-02T00:00:00.000Z", "locked": true, "uses": 1, "used": 0, "by": "ana", "at": "2026-10-26T17:00:00.000Z" }
  ]
}`;

const FOLDER = `{
  "kind": "folder", "id": "a1f3…", "name": "Clients", "parent": null, "color": "teal",
  "owner": "ana", "created": "…", "modified": "…", "modifiedBy": "ana",
  "trashed": { "at": "2026-10-26T18:00:00.000Z", "by": "ana" }   // only on what was put in the trash itself
}`;

const LINE = `{
  "at": "2026-10-26T16:41:00.000Z", "by": "bea",
  "action": "renamed",                  // created, uploaded, version, renamed, moved, trashed, restored,
                                        // deleted, shared, unshared, linked, unlinked, colored
  "entry": "5b0c…", "name": "contract-final.docx", "kind": "file",
  "parent": "a1f3…",
  "was": "contract.docx"                // for one renamed; "from" for one moved; "with", "role" for one shared
}`;

const QUERIES = `-- Each person's files, and the bytes they keep (every version counts, as the quota counts them).
SELECT entry->>'owner' AS owner,
       count(*) AS files,
       sum((SELECT sum((v->>'size')::bigint) FROM jsonb_array_elements(entry->'versions') v)) AS bytes
FROM rebofiles_entries
WHERE entry->>'kind' = 'file'
GROUP BY 1 ORDER BY bytes DESC;

-- What is shared with Bea, directly.
SELECT entry->>'name', s->>'role'
FROM rebofiles_entries, jsonb_array_elements(entry->'shares') s
WHERE s->>'with' IN ('bea', '*');

-- What was put in the trash before a date.
SELECT id, entry->>'name' FROM rebofiles_entries WHERE (entry->'trashed'->>'at') < '2026-10-01';

-- What Bea did this week.
SELECT line FROM rebofiles_entries_activity WHERE line->>'by' = 'bea' AND line->>'at' > '2026-10-20' ORDER BY seq DESC;

-- An index for a query you make often, as for the owner:
CREATE INDEX rebofiles_entries_owner ON rebofiles_entries ((entry->>'owner'));`;

const STORE = `import type { MetadataStore } from '@rebofiles/server';

export const myStore: MetadataStore = {
  async load() { /* every entry, as driveOf(entries) */ },
  async save({ put, removed }) { /* upsert put by id, delete removed: in one transaction */ },
  // Optional; without them the server keeps each in the process.
  async revision() { /* a value that changes with every save, by any process */ },
  async lock(work) { /* work() while no other process saves */ },
  async getSetting(name) {}, async setSetting(name, value) {},
  async record(lines) {}, async activity(id, limit) {},
  async keepText(id, version, text) {}, async findText(query, limit) {},
};`;

export const schema: DocPage = {
  title: 'Database schema',
  description: 'The tables @rebofiles/server makes in Postgres and SQLite, what is in each row, the settings it keeps, why it is laid out so, and queries of your own.',
  source: 'apps/site/components/docs/pages/schema.tsx',
  lead: (
    <>
      The bytes are in the bucket; everything else is in a database: folders, names, owners, versions, shares, links, the trash, settings, activity and the text of files. The store makes its tables
      the first time it starts, so there is nothing to run by hand: this page is for knowing what is there.
    </>
  ),
  tip: 'tip: five tables, and nothing to migrate by hand',
  sections: [
    {
      id: 'the-tables',
      title: 'The tables',
      badge: 'Overview',
      color: 'blue',
      lead: 'Five, named after the table of the entries: rebofiles_entries unless postgresMetadata is given { table }. SQLite has the same, named rebofiles_*.',
      body: (
        <Table
          label="Tables"
          columns={['Table', 'A row is', 'Written when']}
          code={[0]}
          rows={[
            ['rebofiles_entries', 'A folder or a file, whole, as JSON', 'Every change, only the rows it touched'],
            ['…_settings', 'A setting by its name, as JSON', 'Settings are saved; a link with a password is made; Shared with me is looked at'],
            ['…_revision', 'One row: a number', 'It goes up with every change, in the same statement'],
            ['…_activity', 'A line of what was done', 'After every change, a line for each thing it did'],
            ['…_text', 'What is written in a file', 'A file is uploaded and the page read its text'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: 'On Postgres',
      badge: 'Postgres',
      color: 'green',
      lead: 'As postgresMetadata makes them, under a lock of the database so two processes starting at once do not both try.',
      body: <Code lang="sql" code={POSTGRES} file="postgresMetadata(pool)" />,
    },
    {
      id: 'on-sqlite',
      title: 'On SQLite',
      badge: 'SQLite',
      color: 'yellow',
      lead: 'As sqliteMetadata makes them, in one file, with Node’s own node:sqlite. JSON is kept as TEXT.',
      body: <Code lang="sql" code={SQLITE} file="sqliteMetadata('drive.sqlite')" />,
    },
    {
      id: 'an-entry',
      title: 'An entry, as it is kept',
      badge: 'entry',
      color: 'purple',
      lead: 'The column entry is the entry of @rebofiles/core as it is: a file with its versions, shares and links; a folder with its colour.',
      body: (
        <>
          <Code lang="jsonc" code={FILE} file="a file" />
          <Code lang="jsonc" code={FOLDER} file="a folder" />
          <List
            items={[
              <>
                <C>id</C> and <C>parent</C> are also columns, for the index of what is in a folder; the rest is only in the JSON.
              </>,
              <>The key of a version is its file’s id and its own, never a path: renaming and moving never touch the bucket.</>,
              <>
                What is inside a folder in the trash is in the trash through it: only the folder has <C>trashed</C>. Shares are the same: what is inside a shared folder is shared through it.
              </>,
              <>
                A link’s password is not here: <C>locked: true</C> says it has one, and the settings keep it.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'settings',
      title: 'Settings, by name',
      badge: 'settings',
      color: 'orange',
      body: (
        <Table
          label="Settings kept"
          columns={['Name', 'Value']}
          code={[0]}
          rows={[
            ['drive', '{ language, theme, brand, images: { enabled, sizes, format, quality }, quota, trashDays }: the drive’s, as whoever may configure it saved them.'],
            ['person:<id>', '{ language, theme }: one person’s own, over the drive’s.'],
            ['link:<link id>', '"salt:hash": the password of a link, as scrypt makes it (32 bytes, a salt of 16), never the password.'],
            ['seen-shared:<id>', 'When the person last looked at Shared with me, as ISO 8601: what is newer is new.'],
          ]}
        />
      ),
    },
    {
      id: 'activity',
      title: 'A line of activity',
      badge: 'activity',
      color: 'pink',
      lead: 'The column line; entry, parent and origin are beside it, to find the lines of a file and of what is in a folder.',
      body: <Code lang="jsonc" code={LINE} />,
    },
    {
      id: 'why-so',
      title: 'Why it is laid out so',
      badge: 'Design',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>One row, one entry.</strong> The drive is read whole once and held in memory, read again only when the revision says it changed, so the database is asked by id, never joined: a
              listing of 20,000 entries is under a millisecond.
            </>,
            <>
              <strong>Only what changed is written.</strong> A rename writes one row; moving a folder writes the folder, not what is in it, as its children name it by id.
            </>,
            <>
              <strong>Whole or not at all.</strong> On Postgres a change is one statement: the rows removed, the rows put and the revision, together. With a pool, each change also holds{' '}
              <C>pg_advisory_xact_lock</C>, so two servers never change the drive at once.
            </>,
            <>
              <strong>No foreign keys.</strong> The model checks the tree (a folder never inside itself, a name never twice in a folder) before anything is written; the database only keeps it.
            </>,
            <>
              <strong>Fine for a team and well beyond;</strong> not for millions of entries, which would need the store asked by folder.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'queries-of-your-own',
      title: 'Queries of your own',
      badge: 'SQL',
      color: 'green',
      lead: 'For a report, an export or a job: read it as you like. Change it through the server or @rebofiles/core, so the revision goes up and the tree stays whole.',
      body: (
        <>
          <Code lang="sql" code={QUERIES} />
          <Callout title="Writing to the tables by hand">
            is not seen by a process that holds the drive until the revision goes up: bump it in the same transaction, or change the drive through the routes.
          </Callout>
        </>
      ),
    },
    {
      id: 'making-it-yourself',
      title: 'Making it yourself',
      badge: 'Migrations',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              The user the server connects with needs to create tables the first time, and to read and write them after. To make them yourself, with your own migrations, run the DDL above first:{' '}
              <C>IF NOT EXISTS</C> leaves them as they are.
            </>,
            <>
              <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C> names them <C>acme_files</C>, <C>acme_files_settings</C>… beside your application’s own tables, in its schema.
            </>,
            <>A new version of ReboFiles that needs a table or a column more makes it the same way, at its first start.</>,
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: 'A store of your own',
      badge: 'MetadataStore',
      color: 'purple',
      lead: 'Another database, or tables of your own laid out otherwise: two methods, and the rest optional.',
      body: (
        <>
          <Code code={STORE} />
          <P>
            <C>save</C> is given the entries put and the ids removed by each change, from <C>changes(before, after)</C> of core. <a href={hrefOf('metadata')}>Metadata</a> says what each store is for.
          </P>
        </>
      ),
    },
  ],
};
