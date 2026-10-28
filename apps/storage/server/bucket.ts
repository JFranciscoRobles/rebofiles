// The backend against a real bucket: the bytes there, as `.env` says, and the
// entries in `storage/bucket.sqlite` at the root of the repository, apart from
// the playground's. Delete that file to start over; what it named stays in the
// bucket until deleted there.
//
// No one signs in, as in the playground: whoever the page says it is (`?as=bea`)
// is who asks, the one of this computer unless said, who alone may configure
// the drive. What each may do is `byRoles`; Bea and Carl are in the group
// `team`, to share with `group:team`. It is for trying a bucket from this
// computer, not for a site.
//
// Everything the server does is on: what is made of a file (a PDF's first page,
// its text), files checked once they arrive, the events, comments, holds and
// the days things are kept; who is who from a directory, who read what, the
// reminders of requests for files and what is about to expire, each written in
// its console where an application would send a mail or keep an audit; and an
// assistant at /api/mcp.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMcpHandler } from '@rebofiles/mcp';
import { byRoles, checkType, createDriveHandler, mailReminders, s3OptionsFrom, s3Storage, sqliteMetadata } from '@rebofiles/server';
import { deriveAll, docx, ocr, pdf, pictures, text, xlsx } from '@rebofiles/server/derive';

const ENV = resolve(import.meta.dirname, '../.env');
if (!existsSync(ENV)) throw new Error('No apps/storage/.env yet: copy .env.example beside it and fill it in.');
process.loadEnvFile(ENV);

const STORAGE = resolve(import.meta.dirname, '../../../storage');
mkdirSync(STORAGE, { recursive: true });

// The secret of `.env`, or one made once and kept, so tokens of an upload begun before a restart still work after it.
const secretFile = resolve(STORAGE, 'bucket-secret');
if (!process.env.REBOFILES_SECRET && !existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = process.env.REBOFILES_SECRET || readFileSync(secretFile, 'utf8');

export const storage = s3Storage(s3OptionsFrom(process.env));

/** Who is in which group, as an application would say it. */
const GROUPS: Record<string, string[]> = { bea: ['team'], carl: ['team'] };
/** Who works here, as the application's directory would say: to share with by name, and their names shown for their ids. */
const PEOPLE = [
  { id: 'bea', name: 'Bea Ruiz', detail: 'bea@acme.test' },
  { id: 'carl', name: 'Carl Soto', detail: 'carl@acme.test' },
  { id: 'group:team', name: 'Team', detail: 'Bea and Carl' },
];
/** The page's port, as `vite.config.ts` has it: where a reminder's link opens. */
const PORT = 5183;

export const handle = createDriveHandler({
  storage,
  metadata: await sqliteMetadata(resolve(STORAGE, 'bucket.sqlite')),
  // The one of this machine may configure the drive; whoever `?as=` names may not.
  identify: (request) => {
    const as = request.headers.get('x-user');
    const id = as || process.env.USER || 'me';
    return { id, admin: !as, groups: GROUPS[id] ?? [] };
  },
  authorize: byRoles,
  secret,
  base: '/api/files',
  // What the page does not make of a file, made here and kept in the bucket: a PDF's first page, its text.
  derive: deriveAll(pictures(), pdf(), docx(), xlsx(), text(), ocr({ languages: ['eng', 'spa'] })),
  // A program, or a file whose bytes are not what its name says, refused once it is in the bucket, and taken out.
  inspect: checkType(),
  // The desktop application, as `npm run desktop` opens it, against this bucket.
  cors: { origins: ['http://localhost:5190', 'tauri://localhost', 'http://tauri.localhost'] },
  // Where an application would send a mail.
  onShare: ({ entry, with: who, role, by, first }) => console.log(`${by.id} ${first ? 'shared' : 'changed'} “${entry.name}” with ${who} as ${role}`),
  onComment: ({ entry, mentions, by }) => {
    if (mentions.length) console.log(`${by.id} named ${mentions.join(', ')} on “${entry.name}”`);
  },
  // Who read what, where an application would keep an audit: a folder listed is left out, to keep the console readable.
  onRead: ({ action, user, link, entries }) => {
    if (action !== 'list') console.log(`[read] ${user?.id ?? `link ${link}`} ${action} ${entries.map((entry) => `“${entry.name}”`).join(', ')}`);
  },
  people: {
    search: (query) => PEOPLE.filter((one) => `${one.name} ${one.detail} ${one.id}`.toLowerCase().includes(query.toLowerCase())),
    names: (ids) => Object.fromEntries(PEOPLE.filter((one) => ids.includes(one.id)).map((one) => [one.id, one.name])),
  },
  // Requests for files remind whom they were sent to every so many days, by a mail written here instead of sent.
  reminders: mailReminders({
    mail: (mail) => console.log(`[mail] to ${mail.to}: ${mail.subject}`),
    url: (token) => `http://localhost:${PORT}/?link=${encodeURIComponent(token)}`,
  }),
  expiring: { days: 15, onExpiring: ({ entry, expires }) => console.log(`[expiring] “${entry.name}” on ${expires}`) },
});

// The tools for an assistant, at /api/mcp, as the person `x-user` says:
// `claude mcp add --transport http bucket http://localhost:5183/api/mcp`.
export const mcp = createMcpHandler({
  base: 'http://storage.local/api/files',
  fetch: (input, init) => handle(new Request(String(input), init)),
  headers: (request): Record<string, string> => (request.headers.get('x-user') ? { 'x-user': request.headers.get('x-user')! } : {}),
});
