// The backend of the documents' demo: the bytes in `storage/documents/files`
// and the entries in `storage/documents/drive.sqlite`, at the root of the
// repository, apart from the playground's. Delete the folder to start over.
//
// No one signs in: whoever the page says it is (`?as=bea`) is who asks, the
// one of this computer unless said, who alone may configure the drive. For
// this computer only. Documents are written by several at once through
// `collab.ts`.
//
// Everything the server does is on: what is made of a file (pictures of
// pictures and of a frame of a video, a PDF's first page, the text of PDFs,
// Word documents, workbooks and of pictures by OCR), files checked by their
// bytes, and each change told to a webhook, which this same demo takes at
// /api/hooks, checks and writes in its console. Requests for files remind
// whom they were sent to by a mail kept at /api/outbox instead of sent; what
// is written in what comes is checked against what was asked; what stops
// being good is told before; and who read what is written in its console, as
// an audit would keep it. Two templates of requests come with it.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { type Mail, byRoles, checkType, createDriveHandler, diskStorage, mailReminders, sqliteMetadata, verifyWebhook, webhook } from '@rebofiles/server';
import { deriveAll, docx, ocr, pdf, pictures, text, video, xlsx } from '@rebofiles/server/derive';

// `REBOFILES_STORAGE` puts it elsewhere, as the tests do, to start from nothing.
const STORAGE = resolve(process.env.REBOFILES_STORAGE || resolve(import.meta.dirname, '../../../storage/documents'));
mkdirSync(STORAGE, { recursive: true });

// A secret made once and kept beside the files, so addresses signed before a restart still work after it.
const secretFile = resolve(STORAGE, 'secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const secret = readFileSync(secretFile, 'utf8');

export const storage = diskStorage({ folder: resolve(STORAGE, 'files'), secret, label: 'disk:storage/documents/files' });
export const metadata = await sqliteMetadata(resolve(STORAGE, 'drive.sqlite'));
export { secret };

// The secret the webhook is signed with, and where it is sent: this demo itself, at its port.
const hookSecret = `${secret}:hooks`;
const PORT = Number(process.env.PORT) || 5184;

/** The mails the drive would send, newest first: written in the console, and given at GET /api/outbox. */
export const outbox: (Mail & { at: string })[] = [];

/** The templates the drive starts with, until someone changes them in its settings. */
const TEMPLATES = [
  {
    id: 'supplier',
    name: 'Alta de proveedor',
    request: {
      message: 'Hola, para darte de alta como proveedor necesitamos estos documentos.',
      askName: true,
      perSender: true,
      rename: '{item} - {name}',
      closeWhenDone: true,
      remind: 3,
      items: [
        { id: 'tax', label: 'Constancia de situación fiscal', words: ['situación fiscal', 'SAT'], find: { rfc: '\\b([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})\\b' } },
        { id: 'address', label: 'Comprobante de domicilio' },
        { id: 'bank', label: 'Estado de cuenta (carátula)', words: ['CLABE', 'cuenta'] },
      ],
    },
  },
  {
    id: 'client',
    name: 'Expediente de cliente',
    request: {
      askName: true,
      perSender: true,
      rename: '{item} - {name}',
      closeWhenDone: true,
      remind: 7,
      accept: ['application/pdf', 'image/*'],
      items: [
        { id: 'id', label: 'Identificación oficial', words: ['INE', 'credencial', 'pasaporte', 'electoral'], expires: true },
        { id: 'address', label: 'Comprobante de domicilio' },
        { id: 'policy', label: 'Póliza de seguro', expires: true },
      ],
    },
  },
];

/** Who works here, as the application's own directory would say: to share with by name, and to show their names. */
const PEOPLE = [
  { id: 'carla', name: 'Carla Ruiz', detail: 'carla@acme.test' },
  { id: 'beto', name: 'Beto Díaz', detail: 'beto@acme.test' },
  { id: 'group:legal', name: 'Jurídico', detail: 'Equipo' },
  { id: 'group:sales', name: 'Ventas', detail: 'Equipo' },
];
const plainText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const handle = createDriveHandler({
  storage,
  metadata,
  identify: (request) => ({ id: request.headers.get('x-user') || process.env.USER || 'me', admin: !request.headers.get('x-user') }),
  authorize: byRoles,
  secret,
  base: '/api/files',
  // What the page does not make of a file, made here: video with ffmpeg and OCR with Tesseract, when they are there.
  derive: deriveAll(pictures(), pdf(), docx(), xlsx(), text(), video(), ocr({ languages: ['eng', 'spa'] })),
  // A file whose bytes are not what its name says, refused once it arrived.
  inspect: checkType(),
  onChange: webhook({ url: `http://localhost:${PORT}/api/hooks`, secret: hookSecret, onFailure: (error) => console.warn(`[webhook] not delivered: ${error.message}`) }),
  // Where an application would send a mail.
  onShare: ({ entry, with: who, role, by, first }) => console.log(`[share] ${by.id} ${first ? 'shared' : 'changed'} “${entry.name}” with ${who} as ${role}`),
  onComment: ({ entry, mentions, by }) => {
    if (mentions.length) console.log(`[comment] ${by.id} named ${mentions.join(', ')} on “${entry.name}”`);
  },
  people: {
    search: (query) => PEOPLE.filter((one) => [one.name, one.detail, one.id].some((said) => plainText(said).includes(plainText(query)))),
    names: (ids) => Object.fromEntries(PEOPLE.filter((one) => ids.includes(one.id)).map((one) => [one.id, one.name])),
  },
  settings: { company: 'Acme', requestTemplates: TEMPLATES },
  // Reminders, every so many days a request says, and at once from the drive: kept here, as a mail service would send them.
  reminders: mailReminders({
    mail: (mail) => {
      outbox.unshift({ ...mail, at: new Date().toISOString() });
      outbox.splice(50);
      console.log(`[mail] to ${mail.to}: ${mail.subject}`);
    },
    url: (token) => `http://localhost:${PORT}/?link=${encodeURIComponent(token)}`,
  }),
  expiring: { days: 15, onExpiring: ({ entry, expires }) => console.log(`[expiring] “${entry.name}” on ${expires}`) },
  // Who read what, where an application would keep an audit: a folder listed is left out, to keep the console readable.
  onRead: ({ action, user, link, entries }) => {
    if (action !== 'list') console.log(`[read] ${user?.id ?? `link ${link}`} ${action} ${entries.map((entry) => `“${entry.name}”`).join(', ')}`);
  },
});

/** The mails kept, for the page: GET /api/outbox. */
export function mails(_request: IncomingMessage, response: ServerResponse) {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ mails: outbox }));
}

/** The last changes the webhook told, newest first: written in the console, and given at GET /api/hooks. */
export const told: unknown[] = [];

/** The service the webhook tells, as another application would be: each delivery checked before it is taken. */
export async function hooks(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json');
  if (request.method !== 'POST') return void response.end(JSON.stringify({ told }));
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString();
  const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name, String(value)]));
  if (!verifyWebhook(hookSecret, body, headers)) {
    response.statusCode = 401;
    return void response.end(JSON.stringify({ error: 'bad-signature' }));
  }
  const delivery = JSON.parse(body) as { action: string; by: string; entry: { name: string } | null };
  console.log(`[webhook] ${delivery.by} ${delivery.action} “${delivery.entry?.name ?? '—'}”`);
  told.unshift(delivery);
  told.length = Math.min(told.length, 50);
  response.end(JSON.stringify({ ok: true }));
}
