// The schema of the database: the tables the stores of @rebofiles/server make,
// what is in each row, and why it is laid out so. Written from
// packages/server/src/metadata.ts and packages/core/src/model.ts: change them together.

import { hrefOf } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../ui';

export const POSTGRES = `-- The entries: one row each, the whole entry as JSON.
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

export const PRISMA = `// What \`prisma db pull\` reads from the tables ReboFiles made, named as an application names its models.
// \`prisma migrate diff\` between it and the database: an empty migration.

/// A folder or a file of the drive: the whole entry, as @rebofiles/core has it, in \`entry\`.
model DriveEntry {
  id     String  @id
  parent String?
  entry  Json

  @@index([parent], map: "rebofiles_entries_parent")
  @@map("rebofiles_entries")
}

/// The drive's settings, each person's, the passwords of links: by name.
model DriveSetting {
  name  String @id
  value Json

  @@map("rebofiles_entries_settings")
}

/// One row, one number: one more at every change. The table has CHECK (id = 1), which Prisma does not model.
model DriveRevision {
  id Int    @id
  n  BigInt

  @@map("rebofiles_entries_revision")
}

/// What was done, a line each.
model DriveActivity {
  seq    BigInt  @id @default(autoincrement())
  entry  String
  parent String?
  origin String?
  line   Json

  @@index([entry, seq], map: "rebofiles_entries_activity_entry")
  @@index([parent, seq], map: "rebofiles_entries_activity_parent")
  @@index([origin, seq], map: "rebofiles_entries_activity_origin")
  @@map("rebofiles_entries_activity")
}

/// What is written in each file, to find it by.
model DriveText {
  id      String                  @id
  version String
  body    String
  words   Unsupported("tsvector")

  @@index([words], map: "rebofiles_entries_text_words", type: Gin)
  @@map("rebofiles_entries_text")
}`;

export const ONE_POOL = `// lib/db.ts: one pool, for your Prisma and for the drive.
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// app/api/files/[...path]/route.ts
import { byRoles, createDriveHandler, postgresMetadata, s3OptionsFrom, s3Storage } from '@rebofiles/server';
import { pool } from '@/lib/db';

const handle = createDriveHandler({
  storage: s3Storage(s3OptionsFrom(process.env)),
  metadata: await postgresMetadata(pool), // a pool: each change holds a lock of the database
  identify, authorize: byRoles, secret: process.env.REBOFILES_SECRET!, base: '/api/files',
});`;

export const BASELINE = `# The tables are there already, made by ReboFiles: add the models, then tell Prisma they exist.
npx prisma db pull                      # or paste the models above into schema.prisma
mkdir -p prisma/migrations/0_rebofiles
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/0_rebofiles/migration.sql
npx prisma migrate resolve --applied 0_rebofiles

# From then on, migrate dev leaves them as they are: its next migration about them is empty.
npx prisma migrate dev`;

export const FRESH = `# A new database: your migrations make the tables first, ReboFiles finds them when it starts.
npx prisma migrate deploy`;

export const PRISMA_QUERIES = `import { Prisma } from '@/lib/generated/prisma/client';
import type { Entry } from '@rebofiles/core';
import { prisma } from '@/lib/db';

// Ana's files and folders.
const anas = await prisma.driveEntry.findMany({ where: { entry: { path: ['owner'], equals: 'ana' } } });
const names = anas.map((row) => (row.entry as unknown as Entry).name);

// What is in a folder; the folders at the top.
const inside = await prisma.driveEntry.findMany({ where: { parent: folderId } });
const top = await prisma.driveEntry.findMany({ where: { parent: null, entry: { path: ['kind'], equals: 'folder' } } });

// What was done to it, and in it.
const lines = await prisma.driveActivity.findMany({
  where: { OR: [{ entry: folderId }, { parent: folderId }] },
  orderBy: { seq: 'desc' },
  take: 20,
});

// A person's own settings.
const mine = await prisma.driveSetting.findUnique({ where: { name: 'person:ana' } });

// The bytes each person keeps: what JSON paths cannot say, in SQL.
const bytes = await prisma.$queryRaw<{ owner: string; bytes: number }[]>(Prisma.sql\`
  SELECT entry->>'owner' AS owner, sum((v->>'size')::bigint)::float8 AS bytes
  FROM rebofiles_entries, jsonb_array_elements(entry->'versions') v
  GROUP BY 1\`);

// Files by what is written in them: words is Unsupported("tsvector"), so in SQL too.
const found = await prisma.$queryRaw<{ id: string; body: string }[]>(Prisma.sql\`
  SELECT id, body FROM rebofiles_entries_text WHERE words @@ to_tsquery('simple', \${'payment & 30'})\`);`;

/** Every field of an entry, as packages/core/src/model.ts has it: [field, type, what it is]. */
export const ENTRY_FIELDS: [string, string, string][] = [
  ['kind', "'file' | 'folder'", 'What it is.'],
  ['id', 'string', 'Its id, a UUID unless newId says otherwise; also the column id.'],
  ['name', 'string', 'As the person reads it, extension included; never twice in a folder, whatever the case or the accents.'],
  ['parent', 'string | null', 'The folder it is in; null at the top. Also the column parent.'],
  ['owner', 'string', 'The id identify() gave whoever made it; at the top, whose My files it is in.'],
  ['created', 'ISO 8601', 'When it was made or first uploaded.'],
  ['modified, modifiedBy', 'ISO 8601, string', 'Its last change of name, place or bytes, and by whom. A colour or a share does not count.'],
  ['type', 'string', 'Of a file: its media type, as the upload said it (application/pdf, image/png).'],
  ['versions', 'Version[]', 'Of a file: its versions, the newest first, never empty. versions[0] is the file as it is now.'],
  ['color', 'FolderColor', 'Of a folder: red, orange, yellow, green, teal, blue, purple, pink or gray; left out for the drive’s own.'],
  ['trashed', '{ at, by }', 'Only on what was put in the trash itself; what is inside it is in the trash through it.'],
  ['shares', 'Share[]', 'Who else it is shared with: { with, role, by, at }, with "*" for everyone signed in.'],
  ['links', 'Link[]', 'Its links: { id, role, expires, locked?, uses?, used?, spent?, by, at }.'],
];

export const VERSION_FIELDS: [string, string, string][] = [
  ['id', 'string', 'Its id.'],
  ['key', 'string', 'Where its bytes are in the bucket: the file’s id and its own, "<file>/<version>". Never a path.'],
  ['size', 'number', 'In bytes, as the server checked them when the upload finished.'],
  ['at, by', 'ISO 8601, string', 'When it was uploaded, and by whom.'],
  ['sha256', 'string', 'The SHA-256 of its bytes in hex, as the page said it (files of up to 64 MiB): to tell the same file uploaded again.'],
  ['placeholder', 'string', 'Of a picture or a Word document: a data: URL of a few hundred bytes, shown blurred while it comes.'],
  ['renditions', 'Rendition[]', 'Smaller copies: { size, width, height, key, type, bytes }, the key "<file>/<version>@<size>".'],
  ['restoredFrom', 'string', 'Of one made by bringing back an old version: which.'],
  ['note', 'string', 'A word on it, when one was given.'],
];

export const FILE = `{
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

export const FOLDER = `{
  "kind": "folder", "id": "a1f3…", "name": "Clients", "parent": null, "color": "teal",
  "owner": "ana", "created": "…", "modified": "…", "modifiedBy": "ana",
  "trashed": { "at": "2026-10-26T18:00:00.000Z", "by": "ana" }   // only on what was put in the trash itself
}`;

export const LINE = `{
  "at": "2026-10-26T16:41:00.000Z", "by": "bea",
  "action": "renamed",                  // created, uploaded, version, renamed, moved, trashed, restored,
                                        // deleted, shared, unshared, linked, unlinked, colored
  "entry": "5b0c…", "name": "contract-final.docx", "kind": "file",
  "parent": "a1f3…",
  "was": "contract.docx"                // for one renamed; "from" for one moved; "with", "role" for one shared
}`;

export const QUERIES = `-- Each person's files, and the bytes they keep (every version counts, as the quota counts them).
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

export const STORE = `import type { MetadataStore } from '@rebofiles/server';

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
  description: 'The tables @rebofiles/server makes in Postgres and SQLite, every field of a file, its settings, Prisma ORM models and migrations, and queries of your own.',
  source: 'apps/site/components/docs/pages/schema.tsx',
  lead: (
    <>
      The bytes are in the bucket; everything else is in a database: folders, names, owners, versions, shares, links, the trash, settings, activity and the text of files. The store makes its tables
      the first time it starts, so there is nothing to run by hand: this page is for knowing what is there.
    </>
  ),
  tip: 'tip: five tables, nothing to migrate by hand — and models for Prisma',
  sections: [
    {
      id: 'the-tables',
      title: 'The tables',
      badge: 'Overview',
      color: 'blue',
      lead: 'Five, named after the table of the entries: rebofiles_entries unless postgresMetadata is given { table }. sqliteMetadata makes the same in one file, named rebofiles_*, the text in a table of SQLite’s full-text search (FTS5).',
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
      id: 'the-fields-of-a-file',
      title: 'The fields of a file',
      badge: 'Metadata',
      color: 'yellow',
      lead: 'The metadata of each file and folder is the column entry of rebofiles_entries: there is no other table of files. Every field of it:',
      body: (
        <>
          <Table label="Fields of an entry" columns={['Field', 'Type', 'What it is']} code={[0]} rows={ENTRY_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <P>And of each of its versions:</P>
          <Table label="Fields of a version" columns={['Field', 'Type', 'What it is']} code={[0]} rows={VERSION_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <Callout title="Not kept, yet:">
            the width and height of the original picture (only of its smaller copies), what a camera writes in a picture (EXIF), the length of a video or a song, and the pages of a document. A table
            of your own beside it can hold them, by the id of the file.
          </Callout>
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
      id: 'with-prisma',
      title: 'With Prisma ORM',
      badge: 'Prisma',
      color: 'yellow',
      lead: 'For an application that keeps its own tables with Prisma 7: the drive’s, as models of its schema.prisma, to read them with Prisma and to keep its migrations from touching them.',
      body: (
        <>
          <Code lang="prisma" code={PRISMA} file="prisma/schema.prisma" />
          <List
            items={[
              <>
                <C>@@map</C> keeps the tables’ own names; with <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C>, map to those instead.
              </>,
              <>
                <C>words</C> is a <C>tsvector</C>, which Prisma reads as <C>Unsupported</C>: the model of the text is read in SQL, and written only by the drive.
              </>,
              <>
                <C>prisma db pull</C> warns of the <C>CHECK (id = 1)</C> of the revision: it stays in the table, Prisma only does not model it.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'one-pool',
      title: 'One pool for Prisma and the drive',
      badge: 'Prisma',
      color: 'green',
      lead: 'Prisma 7 talks to Postgres through @prisma/adapter-pg, which takes a pg.Pool: give the same one to postgresMetadata.',
      body: <Code code={ONE_POOL} />,
    },
    {
      id: 'migrations-with-prisma',
      title: 'Migrations with Prisma',
      badge: 'Prisma',
      color: 'purple',
      lead: 'Prisma Migrate takes tables it does not know for drift, and offers to reset the database, everything in it gone: put the drive’s tables in the schema, and mark them as made.',
      body: (
        <>
          <Code lang="bash" code={BASELINE} />
          <Code lang="bash" code={FRESH} />
          <Callout title="Either way round works.">
            ReboFiles makes its tables with <C>IF NOT EXISTS</C> and its one row of the revision with <C>ON CONFLICT DO NOTHING</C>: tables Prisma made first are taken as they are.
          </Callout>
        </>
      ),
    },
    {
      id: 'queries-with-prisma',
      title: 'Queries with Prisma',
      badge: 'Prisma',
      color: 'pink',
      lead: 'Read the drive with Prisma’s client and JSON paths, and in SQL for what they cannot say. Change it through the drive’s routes, so the revision goes up and the tree stays whole.',
      body: <Code code={PRISMA_QUERIES} />,
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
