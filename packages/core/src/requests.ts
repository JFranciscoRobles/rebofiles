// A request for files: a link of a folder that takes files (`uploads`), and
// what it asks of whoever sends them: a message, their name, the documents
// wanted one by one, what kind and how large, how many; and what is done
// with what comes: a folder for each who sends, a name of a pattern, fields
// of the application's. What came through it is counted on the link.

import { DriveError } from './errors';
import type { Drive, Entry, EntryId, Link } from './model';
import { FIELD_NAME, MAX_FIELD_VALUE } from './ops';

/** A document asked for by name: one place to put it in the page of the link. */
export interface RequestItem {
  id: string;
  label: string;
  /** Words one of which what is written in it should say (`INE`, `credencial`): a file that says none is marked to look at. */
  words?: string[];
  /** Fields found in what is written in it, by a pattern each: `{ rfc: '[A-Z&Ñ]{3,4}\\d{6}[A-Z0-9]{3}' }`. */
  find?: Record<string, string>;
  /** Its sender asked until when it is good, kept in the field `expires`, to be told before then. */
  expires?: boolean;
}

/** Something asked to be written, besides the files: an RFC, an address. What is said is kept as a field of what comes. */
export interface RequestQuestion {
  id: string;
  label: string;
  /** The field it is kept as, on each file sent and on the folder of its sender (`perSender`). */
  field: string;
  /** Nothing goes until it is said. */
  required?: boolean;
}

export interface FileRequest {
  /** What it is for, as the owner calls it among their requests: “For Northwind”. */
  title?: string;
  /** Said to whoever sends, over where they send. */
  message?: string;
  /** Their name asked for before anything goes: told with each file. */
  askName?: boolean;
  /** Who it was sent to, for the application to remind them and send them a receipt. */
  email?: string;
  /** The documents wanted, each with a place of its own. */
  items?: RequestItem[];
  /** What is asked to be written, besides the files: each kept as a field of what comes. */
  questions?: RequestQuestion[];
  /** A folder of their own, inside the link's, for each who sends. */
  perSender?: boolean;
  /** The name each file is given: `{item}`, `{name}`, `{date}`, `{original}`; its extension kept. */
  rename?: string;
  /** Fields of the application set on each file that comes: `client: acme`. */
  fields?: Record<string, string>;
  /** What may be sent: types (`application/pdf`, `image/*`) and endings (`.docx`). Anything unless said. */
  accept?: string[];
  /** The largest file taken, in bytes. */
  maxSize?: number;
  /** How many files it takes in all. */
  maxFiles?: number;
  /** Closed once every document asked for has come. */
  closeWhenDone?: boolean;
  /** Every how many days whoever it was sent to (`email`) is reminded of what is missing, while it is open. */
  remind?: number;
}

/** A request kept to be made again with a click: “Supplier sign-up”, the documents it asks for and how. */
export interface RequestTemplate {
  id: string;
  name: string;
  request: FileRequest;
}

/** What came through a link: how many files, when the last, of each document asked for, and from whom. */
export interface Received {
  files: number;
  last?: string;
  items?: Record<string, number>;
  from?: string[];
}

const text = (value: unknown, what: string, most: number): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new DriveError('invalid-share', `${what} is a text`);
  const trimmed = value.trim();
  if (trimmed.length > most) throw new DriveError('invalid-share', `${what} is at most ${most} characters`);
  return trimmed || undefined;
};
const positive = (value: unknown, what: string, most: number): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > most) throw new DriveError('invalid-share', `${what} is a whole number from 1 to ${most}`);
  return n;
};

/** A request as given, checked, with what is not said left out. */
export function readRequest(value: unknown): FileRequest {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new DriveError('invalid-share', 'A request is an object');
  const given = value as Record<string, unknown>;
  const items = given.items === undefined ? [] : given.items;
  if (!Array.isArray(items) || items.length > 30) throw new DriveError('invalid-share', 'A request asks for at most 30 documents');
  const seen = new Set<string>();
  const asked = items.map((item, i) => {
    const raw = (typeof item === 'string' ? { label: item } : item) as { id?: unknown; label?: unknown; words?: unknown; find?: unknown; expires?: unknown };
    const label = text(raw?.label, 'A document asked for', 120);
    if (!label) throw new DriveError('invalid-share', 'Each document asked for has a name');
    let id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : `d${i + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const words = raw.words === undefined ? [] : raw.words;
    if (!Array.isArray(words) || words.length > 20 || !words.every((word) => typeof word === 'string' && word.trim().length > 0 && word.length <= 60))
      throw new DriveError('invalid-share', `The words of "${label}" are a list of at most 20`);
    const find: Record<string, string> = {};
    if (raw.find !== undefined) {
      if (typeof raw.find !== 'object' || raw.find === null || Array.isArray(raw.find)) throw new DriveError('invalid-share', `What is found in "${label}" is an object of fields and patterns`);
      for (const [name, pattern] of Object.entries(raw.find)) {
        if (!FIELD_NAME.test(name) || typeof pattern !== 'string' || pattern.length > 200) throw new DriveError('invalid-share', `The field "${name}" is not a name and a pattern`);
        try {
          new RegExp(pattern, 'u');
        } catch {
          throw new DriveError('invalid-share', `The pattern of "${name}" is not one`);
        }
        find[name] = pattern;
      }
    }
    return {
      id,
      label,
      ...(words.length ? { words: (words as string[]).map((word) => word.trim()) } : {}),
      ...(Object.keys(find).length ? { find } : {}),
      ...(raw.expires === true ? { expires: true } : {}),
    };
  });
  const questions = given.questions === undefined ? [] : given.questions;
  if (!Array.isArray(questions) || questions.length > 20) throw new DriveError('invalid-share', 'A request asks at most 20 questions');
  const fieldsAsked = new Set<string>();
  const asking = questions.map((question, i): RequestQuestion => {
    const raw = (question ?? {}) as { id?: unknown; label?: unknown; field?: unknown; required?: unknown };
    const label = text(raw.label, 'A question', 120);
    if (!label) throw new DriveError('invalid-share', 'Each question has a name');
    const field = typeof raw.field === 'string' && raw.field ? raw.field : fieldFor(label);
    if (!FIELD_NAME.test(field) || RESERVED_FIELDS.has(field)) throw new DriveError('invalid-share', `"${field}" is not a field a question may be kept as`);
    if (fieldsAsked.has(field)) throw new DriveError('invalid-share', `Two questions are kept as "${field}"`);
    fieldsAsked.add(field);
    let id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : `q${i + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    return { id, label, field, ...(raw.required === true ? { required: true } : {}) };
  });
  const fields: Record<string, string> = {};
  if (given.fields !== undefined) {
    if (typeof given.fields !== 'object' || given.fields === null || Array.isArray(given.fields)) throw new DriveError('invalid-share', 'The fields are an object of names and texts');
    for (const [name, field] of Object.entries(given.fields)) {
      if (!FIELD_NAME.test(name) || typeof field !== 'string' || field.length > MAX_FIELD_VALUE) throw new DriveError('invalid-share', `The field "${name}" is not a name and a text`);
      fields[name] = field;
    }
  }
  const accept = given.accept === undefined ? [] : given.accept;
  if (!Array.isArray(accept) || accept.length > 20 || !accept.every((one) => typeof one === 'string' && /^(\.[a-z0-9]{1,10}|[a-z]+\/(\*|[\w.+-]+))$/i.test(one)))
    throw new DriveError('invalid-share', 'What a request takes is a list of types (image/*) and endings (.pdf)');
  const email = text(given.email, 'The email', 254);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DriveError('invalid-share', `"${email}" is not an email`);
  const rename = text(given.rename, 'The pattern of names', 200);
  const request: FileRequest = {
    title: text(given.title, 'The title', 120),
    message: text(given.message, 'The message', 1000),
    askName: given.askName === true || undefined,
    email,
    items: asked.length ? asked : undefined,
    questions: asking.length ? asking : undefined,
    perSender: given.perSender === true || undefined,
    rename,
    fields: Object.keys(fields).length ? fields : undefined,
    accept: accept.length ? (accept as string[]).map((one) => one.toLowerCase()) : undefined,
    maxSize: positive(given.maxSize, 'The largest file', Number.MAX_SAFE_INTEGER),
    maxFiles: positive(given.maxFiles, 'How many files', 10_000),
    closeWhenDone: given.closeWhenDone === true || undefined,
    remind: positive(given.remind, 'Every how many days to remind', 30),
  };
  for (const key of Object.keys(request) as (keyof FileRequest)[]) if (request[key] === undefined) delete request[key];
  return request;
}

/** The fields a request keeps of its own on what comes: a question is not kept as one of them. */
export const RESERVED_FIELDS = new Set(['via', 'request', 'from', 'item', 'expires', 'check', 'same', 'review', 'reviewReason']);

/** The field a question is kept as, of its name: “Número de póliza” is `numero_de_poliza`. */
export function fieldFor(label: string): string {
  const made = plain(label)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(made) ? made : `q_${made || 'answer'}`;
}

/**
 * What a sender wrote, against the questions of the request: each answer to one it asks, trimmed and as long as a
 * field may be, by the field it is kept as. Throws, naming them, when one it needs is not said.
 */
export function answersTo(request: FileRequest | undefined, given: Record<string, unknown>): Record<string, string> {
  const answers: Record<string, string> = {};
  const missing: string[] = [];
  for (const question of request?.questions ?? []) {
    const said = given[question.id];
    const value = typeof said === 'string' ? said.trim().slice(0, MAX_FIELD_VALUE) : '';
    if (value) answers[question.field] = value;
    else if (question.required) missing.push(question.label);
  }
  if (missing.length) throw new DriveError('invalid-share', `Say ${missing.join(', ')} first`);
  return answers;
}

/** Whether a file of this name and type is one the request takes. */
export function accepts(request: FileRequest | undefined, name: string, type: string): boolean {
  if (!request?.accept?.length) return true;
  const ending = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  const kind = type.toLowerCase();
  return request.accept.some((one) => (one.startsWith('.') ? ending === one : one.endsWith('/*') ? kind.startsWith(one.slice(0, -1)) : kind === one));
}

/** What a file that came is called, by the request's pattern: its extension kept, and nothing a name may not have. */
export function renamed(request: FileRequest | undefined, file: { name: string; item?: string; from?: string; at: string }): string {
  if (!request?.rename) return file.name;
  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot) : '';
  const made = request.rename
    .replace(/\{item\}/g, file.item ?? stem)
    .replace(/\{name\}/g, file.from ?? '')
    .replace(/\{date\}/g, file.at.slice(0, 10))
    .replace(/\{original\}/g, stem)
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '-')
    .replace(/\s+-\s+(?=-|$)|^\s*-\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${made || stem}${ext}`;
}

/** The documents of a request still to come. */
export const missingOf = (link: Link): RequestItem[] => (link.request?.items ?? []).filter((item) => !link.got?.items?.[item.id]);

/** Whether a request for files has had all it asks for: every document it names, or as many files as it takes. */
export const requestDone = (link: Link): boolean =>
  link.request?.items?.length ? missingOf(link).length === 0 : link.request?.maxFiles !== undefined && (link.got?.files ?? 0) >= link.request.maxFiles;

/** A file that came through a link counted on it, of a document asked for and from whom; closed when that was all it asked, if it says so. */
export function receivedThrough(drive: Drive, linkId: string, came: { at: string; item?: string; from?: string }): Drive {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (!link) continue;
    const got: Received = {
      files: (link.got?.files ?? 0) + 1,
      last: came.at,
      ...(link.got?.items || came.item ? { items: { ...link.got?.items, ...(came.item ? { [came.item]: (link.got?.items?.[came.item] ?? 0) + 1 } : {}) } } : {}),
      ...(link.got?.from || came.from ? { from: [...new Set([...(link.got?.from ?? []), ...(came.from ? [came.from] : [])])].slice(0, 50) } : {}),
    };
    let next: Link = { ...link, got };
    if (next.request?.closeWhenDone && requestDone(next)) next = { ...next, closed: came.at };
    return { entries: new Map(drive.entries).set(entry.id, { ...entry, links: entry.links!.map((l) => (l.id === linkId ? next : l)) }) };
  }
  return drive;
}

/** A file taken back by who sent it: no longer counted on the link, nor for the document it was. */
export function retracted(drive: Drive, linkId: string, item?: string): Drive {
  for (const entry of drive.entries.values()) {
    const link = entry.links?.find((l) => l.id === linkId);
    if (!link?.got) continue;
    const items = { ...link.got.items };
    if (item && items[item]) items[item]--;
    if (item && items[item] === 0) delete items[item];
    const got: Received = { ...link.got, files: Math.max(0, link.got.files - 1), ...(link.got.items ? { items } : {}) };
    // Closed for having had all it asked for, it opens again: what was taken back is still wanted.
    const next: Link = link.closed && link.request?.closeWhenDone && !requestDone({ ...link, got }) ? (({ closed: _, ...rest }) => ({ ...rest, got }))(link) : { ...link, got };
    return { entries: new Map(drive.entries).set(entry.id, { ...entry, links: entry.links!.map((l) => (l.id === linkId ? next : l)) }) };
  }
  return drive;
}

/** A link changed: until when, what it takes, what it asks; or closed, or open again. */
export function updateLink(drive: Drive, id: EntryId, linkId: string, change: { expires?: string; uploads?: 'also' | 'only'; request?: FileRequest; closed?: string | null }, at: string): Drive {
  const entry = drive.entries.get(id);
  const link = entry?.links?.find((l) => l.id === linkId);
  if (!entry || !link) throw new DriveError('not-found', 'There is no such link');
  if (change.expires !== undefined && !(change.expires > at)) throw new DriveError('invalid-share', 'A link has to expire after now');
  if (change.uploads !== undefined && (!['also', 'only'].includes(change.uploads) || entry.kind !== 'folder'))
    throw new DriveError('invalid-share', 'Files are put through a link of a folder, also or only');
  let next: Link = { ...link, ...(change.expires ? { expires: change.expires } : {}), ...(change.uploads ? { uploads: change.uploads } : {}) };
  if (change.request) next = Object.keys(change.request).length ? { ...next, request: change.request } : (({ request: _, ...rest }) => rest)(next);
  if (change.closed === null) next = (({ closed: _, ...rest }) => rest)(next);
  else if (change.closed) next = { ...next, closed: change.closed };
  return { entries: new Map(drive.entries).set(id, { ...entry, links: entry.links!.map((l) => (l.id === linkId ? next : l)) }) };
}

/** The requests kept as templates, checked; at most 50, each with a name. */
export function readTemplates(value: unknown): RequestTemplate[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) throw new DriveError('invalid-share', 'The templates are a list of at most 50');
  const seen = new Set<string>();
  return value.map((one, i) => {
    const raw = (one ?? {}) as { id?: unknown; name?: unknown; request?: unknown };
    const name = text(raw.name, 'The name of a template', 80);
    if (!name) throw new DriveError('invalid-share', 'Each template has a name');
    let id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : `t${i + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    return { id, name, request: readRequest(raw.request) };
  });
}

const DAY = 86_400_000;

/** The open requests sent to someone, due to be reminded of what is missing: every `remind` days since it was made or last reminded. */
export function remindersDue(entries: Iterable<Entry>, at: string): { entry: Entry; link: Link; missing: RequestItem[] }[] {
  const due: { entry: Entry; link: Link; missing: RequestItem[] }[] = [];
  for (const entry of entries)
    for (const link of entry.links ?? []) {
      const every = link.request?.remind;
      if (!every || !link.request?.email || !link.uploads || link.closed || !(link.expires > at) || requestDone(link)) continue;
      if (Date.parse(at) - Date.parse(link.reminded ?? link.at) < every * DAY) continue;
      // A request of no documents named reminds until something came.
      if (!link.request.items?.length && (link.got?.files ?? 0) > 0) continue;
      due.push({ entry, link, missing: missingOf(link) });
    }
  return due;
}

/** A link's whoever it was sent to reminded, now. */
export function reminded(drive: Drive, id: EntryId, linkId: string, at: string): Drive {
  const entry = drive.entries.get(id);
  if (!entry?.links?.some((l) => l.id === linkId)) throw new DriveError('not-found', 'There is no such link');
  return { entries: new Map(drive.entries).set(id, { ...entry, links: entry.links.map((l) => (l.id === linkId ? { ...l, reminded: at } : l)) }) };
}

/** Text as compared: no case, no accents. */
const plain = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * What is written in a file that came, against the document it was asked as: whether it says one of its words, and
 * the fields its patterns find. Nothing to say of it when the document asks neither.
 */
export function checkWritten(item: RequestItem | undefined, written: string): { missing?: string[]; fields: Record<string, string> } | undefined {
  if (!item?.words?.length && !item?.find) return undefined;
  const said = plain(written);
  const fields: Record<string, string> = {};
  for (const [name, pattern] of Object.entries(item.find ?? {})) {
    const found = new RegExp(pattern, 'u').exec(written);
    if (found) fields[name] = (found[1] ?? found[0]).trim().slice(0, MAX_FIELD_VALUE);
  }
  const missing = item.words?.length && !item.words.some((word) => said.includes(plain(word))) ? item.words : undefined;
  return { ...(missing ? { missing } : {}), fields };
}

/** Whether a date (YYYY-MM-DD, or ISO 8601) is one. */
export const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value) && !Number.isNaN(Date.parse(value));

/** The files whose field `field` says they stop being good within `days` days of `at`, or did already; the soonest first. */
export function expiringWithin(entries: Iterable<Entry>, field: string, at: string, days: number): { entry: Entry; expires: string; days: number }[] {
  const now = Date.parse(at);
  const found: { entry: Entry; expires: string; days: number }[] = [];
  for (const entry of entries) {
    const expires = entry.fields?.[field];
    if (entry.kind !== 'file' || !expires || !isDate(expires)) continue;
    const left = Math.ceil((Date.parse(expires.slice(0, 10)) - now) / DAY);
    if (left <= days) found.push({ entry, expires: expires.slice(0, 10), days: left });
  }
  return found.sort((a, b) => a.days - b.days);
}
