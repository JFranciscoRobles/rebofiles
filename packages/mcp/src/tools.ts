// What an assistant may do with the drive, one tool each: look, read, write
// text, rename, move, and put in the trash and take out of it. Not delete for
// good, and not share: nothing it does cannot be undone from the trash or the
// versions of a file, and nothing it does reaches anyone else.
//
// Each answers in words for the model and as data for the client, and says
// what the server refused as an error the model reads, not as a failure of
// the protocol.

import { type Entry, FOLDER_COLORS, type FileEntry, type FolderColor, sizeOf, splitName, versionNumber } from '@rebofiles/core';
import type { Drive } from './drive';

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false };
  run(drive: Drive, args: Record<string, unknown>): Promise<{ text: string; data: Record<string, unknown> }>;
}

/** The most of a file read as text, in bytes: a model reads a page, not a database. */
export const READ_LIMIT = 1_000_000;
/** The most characters of text given back. */
const TEXT_LIMIT = 100_000;

const id = { type: 'string', description: 'The id of a file or a folder, as another tool gave it.' };
const folder = { type: ['string', 'null'], description: 'The id of a folder; null or left out for the top of My files.' };

/** An entry as a model needs it: what it is, where, how large, since when, whose. */
export const brief = (entry: Entry) => ({
  id: entry.id,
  name: entry.name,
  kind: entry.kind,
  ...(entry.kind === 'file' ? { type: entry.type, size: sizeOf(entry), versions: entry.versions.length } : {}),
  folder: entry.parent,
  ...(entry.kind === 'folder' && entry.color ? { color: entry.color } : {}),
  owner: entry.owner,
  modified: entry.modified,
  ...(entry.trashed ? { trashed: true } : {}),
});

const line = (entry: Entry) =>
  `${entry.kind === 'folder' ? 'folder' : 'file'} "${entry.name}" (id ${entry.id}${entry.kind === 'file' ? `, ${sizeOf(entry)} bytes` : ''}, ${entry.owner}, ${entry.modified})`;
const lines = (entries: Entry[], none: string) => (entries.length ? entries.map(line).join('\n') : none);

export const str = (args: Record<string, unknown>, name: string): string => {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`"${name}" is needed, as text.`);
  return value;
};
const optional = (args: Record<string, unknown>, name: string): string | null => (typeof args[name] === 'string' && args[name] ? (args[name] as string) : null);

const TEXT_TYPES = /^(text\/|application\/(json|xml|yaml|x-yaml|javascript|csv))/;
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'html', 'css', 'js', 'ts', 'ini', 'toml']);
const isText = (name: string, type: string) => TEXT_TYPES.test(type) || TEXT_EXTENSIONS.has(splitName(name).ext.slice(1).toLowerCase());
export const isDocx = (name: string, type: string) => type.includes('wordprocessingml') || splitName(name).ext.toLowerCase() === '.docx';

/** The text of a Word document, by Rebodocs' engine when it is installed. */
async function docxText(bytes: Uint8Array): Promise<string | null> {
  try {
    const rebodocs = await import('@rebodocs/core');
    return rebodocs
      .importDocx(bytes)
      .paragraphs.map((p) => rebodocs.paragraphText(p))
      .join('\n');
  } catch {
    return null;
  }
}

/** The media type a text file is given by its name, as a browser would. */
const typeOf = (name: string) =>
  ({
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
    html: 'text/html',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
  })[splitName(name).ext.slice(1).toLowerCase()] ?? 'text/plain';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

export const TOOLS: Tool[] = [
  {
    name: 'list_folder',
    title: 'List a folder',
    description: 'What is in a folder of the drive, folders first, or at the top of My files. Gives the id of each, for the other tools.',
    inputSchema: { type: 'object', properties: { folder }, additionalProperties: false },
    annotations: READ,
    async run(drive, args) {
      const listed = await drive.list(optional(args, 'folder'));
      const where = listed.path.map((f) => f.name).join(' / ') || 'My files';
      return {
        text: `${where}:\n${lines(listed.entries, 'Nothing is in it.')}`,
        data: { folder: listed.folder && brief(listed.folder), path: listed.path.map((f) => f.name), entries: listed.entries.map(brief) },
      };
    },
  },
  {
    name: 'search',
    title: 'Search by name',
    description: 'Files and folders whose name has every word of the query, in any case and with or without accents; inside a folder, or in the trash, when asked.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words of the name.' },
        folder: { type: 'string', description: 'Only inside this folder.' },
        in_trash: { type: 'boolean', description: 'Search the trash instead.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: READ,
    async run(drive, args) {
      const found = await drive.search(str(args, 'query'), optional(args, 'folder') ?? undefined, args.in_trash === true);
      return { text: lines(found, 'Nothing is called that.'), data: { entries: found.map(brief) } };
    },
  },
  {
    name: 'search_text',
    title: 'Search by what is written',
    description:
      'Files whose text has every word of the query, in any case and with or without accents, with a piece of the text around what was found: text files and Word documents, as they were read when uploaded.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Words written in the file.' } }, required: ['query'], additionalProperties: false },
    annotations: READ,
    async run(drive, args) {
      const found = await drive.searchText(str(args, 'query'));
      return {
        text: found.length ? found.map(({ entry, snippet }) => `${line(entry)}: "${snippet}"`).join('\n') : 'Nothing has that written in it.',
        data: { results: found.map(({ entry, snippet }) => ({ ...brief(entry), snippet })) },
      };
    },
  },
  {
    name: 'get_info',
    title: 'Details of a file or folder',
    description: 'One file or folder: its type, size, owner, when it changed and by whom, where it is, who it is shared with, and its versions.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'], additionalProperties: false },
    annotations: READ,
    async run(drive, args) {
      const { entry, path, trashed } = await drive.entry(str(args, 'id'));
      const data = {
        ...brief(entry),
        path: path.map((f) => f.name),
        trashed,
        modifiedBy: entry.modifiedBy,
        shared: (entry.shares ?? []).map((s) => ({ with: s.with, role: s.role })),
        ...(entry.kind === 'file' ? { versions: entry.versions.map((v) => ({ id: v.id, size: v.size, at: v.at, by: v.by })) } : {}),
      };
      return { text: JSON.stringify(data, null, 2), data };
    },
  },
  {
    name: 'read_file',
    title: 'Read a file',
    description:
      'The text of a file: plain text, Markdown, CSV, JSON and the like, and Word documents (.docx) when the server has Rebodocs. Of a version, when given. Not pictures or PDFs. Up to a megabyte.',
    inputSchema: {
      type: 'object',
      properties: { id, version: { type: 'string', description: 'The id of a version, from get_info; the current one unless given.' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: READ,
    async run(drive, args) {
      const { entry } = await drive.entry(str(args, 'id'));
      if (entry.kind !== 'file') throw new TypeError(`"${entry.name}" is a folder: list_folder shows what is in it.`);
      const version = optional(args, 'version');
      const size = (version ? entry.versions.find((v) => v.id === version) : entry.versions[0])?.size ?? 0;
      if (size > READ_LIMIT) throw new TypeError(`"${entry.name}" is ${size} bytes, more than the ${READ_LIMIT} read here.`);
      const docx = isDocx(entry.name, entry.type);
      if (!docx && !isText(entry.name, entry.type)) throw new TypeError(`"${entry.name}" is ${entry.type}, which is not read as text here.`);
      const bytes = await drive.bytes(entry.id, version ?? undefined);
      const text = docx ? await docxText(bytes) : new TextDecoder().decode(bytes);
      if (text === null) throw new TypeError(`"${entry.name}" is a Word document, and the server has no Rebodocs to read it with.`);
      const cut = text.length > TEXT_LIMIT;
      const shown = cut ? `${text.slice(0, TEXT_LIMIT)}\n… (${text.length - TEXT_LIMIT} more characters not shown)` : text;
      return { text: shown, data: { id: entry.id, name: entry.name, version: version ?? entry.versions[0].id, truncated: cut } };
    },
  },
  {
    name: 'list_recent',
    title: 'Recent files',
    description: 'The files changed last, that the one the assistant works for may read, the latest first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(drive) {
      const found = await drive.recent();
      return { text: lines(found, 'Nothing changed yet.'), data: { entries: found.map(brief) } };
    },
  },
  {
    name: 'list_shared',
    title: 'Shared with me',
    description: 'What others shared with the one the assistant works for.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(drive) {
      const found = await drive.shared();
      return { text: lines(found, 'Nothing is shared with them.'), data: { entries: found.map(brief) } };
    },
  },
  {
    name: 'get_activity',
    title: 'What was done',
    description: 'Who did what to a file or a folder, and, of a folder, to what is right inside it: made, uploaded, renamed, moved, put in the trash, shared. The newest first.',
    inputSchema: { type: 'object', properties: { id, limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many, 20 unless said.' } }, required: ['id'], additionalProperties: false },
    annotations: READ,
    async run(drive, args) {
      const found = await drive.activity(str(args, 'id'), typeof args.limit === 'number' ? Math.min(200, Math.max(1, Math.floor(args.limit))) : 20);
      const said = (a: (typeof found)[number]) =>
        `${a.at} ${a.by} ${a.action} ${a.kind} "${a.name}" (id ${a.entry})${a.was ? ` from "${a.was}"` : ''}${a.with ? ` with ${a.with}${a.role ? ` as ${a.role}` : ''}` : ''}`;
      return { text: found.length ? found.map(said).join('\n') : 'Nothing done there yet, or not since the activity is kept.', data: { activity: found } };
    },
  },
  {
    name: 'create_folder',
    title: 'Make a folder',
    description: 'A new folder; with "(2)" after its name when the name is taken there.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, folder }, required: ['name'], additionalProperties: false },
    annotations: WRITE,
    async run(drive, args) {
      const made = await drive.createFolder(str(args, 'name'), optional(args, 'folder'));
      return { text: `Made ${line(made)}.`, data: brief(made) };
    },
  },
  {
    name: 'create_text_file',
    title: 'Write a new text file',
    description: 'A new file with the text given, its type from its name (.md, .csv, .json, .txt…); with "(2)" after its name when the name is taken there.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' }, folder }, required: ['name', 'text'], additionalProperties: false },
    annotations: WRITE,
    async run(drive, args) {
      const name = str(args, 'name');
      const made = await drive.upload(new TextEncoder().encode(String(args.text ?? '')), typeOf(name), { name, parent: optional(args, 'folder') });
      await drive.keepText(made, String(args.text ?? ''));
      return { text: `Wrote ${line(made)}.`, data: brief(made) };
    },
  },
  {
    name: 'update_text_file',
    title: 'Write a new version of a text file',
    description: 'The text given becomes the file as it is now; what it was stays as its previous version, to restore.',
    inputSchema: { type: 'object', properties: { id, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false },
    annotations: WRITE,
    async run(drive, args) {
      const { entry } = await drive.entry(str(args, 'id'));
      if (entry.kind !== 'file') throw new TypeError(`"${entry.name}" is a folder.`);
      if (!isText(entry.name, entry.type)) throw new TypeError(`"${entry.name}" is ${entry.type}, not a text file to write.`);
      const saved = await drive.upload(new TextEncoder().encode(String(args.text ?? '')), entry.type, { file: entry.id });
      await drive.keepText(saved, String(args.text ?? ''));
      return { text: `Saved version ${saved.versions.length} of "${saved.name}".`, data: brief(saved) };
    },
  },
  {
    name: 'restore_version',
    title: 'Bring back a version',
    description: 'An earlier version of a file becomes the file as it is now, as a new version: the one it was stays, so this too can be undone.',
    inputSchema: {
      type: 'object',
      properties: { id, version: { type: 'string', description: 'The id of the version, from get_info.' } },
      required: ['id', 'version'],
      additionalProperties: false,
    },
    annotations: WRITE,
    async run(drive, args) {
      const restored = (await drive.restoreVersion(str(args, 'id'), str(args, 'version'))) as FileEntry;
      const was = versionNumber(restored, restored.versions[0].restoredFrom ?? restored.versions[0].id);
      return { text: `"${restored.name}" is as version ${was} was, now as version ${restored.versions.length}.`, data: brief(restored) };
    },
  },
  {
    name: 'rename',
    title: 'Rename',
    description: 'A file or folder given another name; refused when another in the same folder has it.',
    inputSchema: { type: 'object', properties: { id, name: { type: 'string' } }, required: ['id', 'name'], additionalProperties: false },
    annotations: { ...WRITE, idempotentHint: true },
    async run(drive, args) {
      const renamed = await drive.rename(str(args, 'id'), str(args, 'name'));
      return { text: `Renamed to ${line(renamed)}.`, data: brief(renamed) };
    },
  },
  {
    name: 'set_folder_color',
    title: 'Colour a folder',
    description: `A folder given a colour, to tell it apart at a glance: ${FOLDER_COLORS.join(', ')}; or "none" for the drive's own.`,
    inputSchema: { type: 'object', properties: { id, color: { type: 'string', enum: [...FOLDER_COLORS, 'none'] } }, required: ['id', 'color'], additionalProperties: false },
    annotations: { ...WRITE, idempotentHint: true },
    async run(drive, args) {
      const color = str(args, 'color');
      const done = await drive.setColor(str(args, 'id'), color === 'none' ? null : (color as FolderColor));
      return { text: `"${done.name}" is ${color === 'none' ? 'the drive’s own colour' : color} now.`, data: brief(done) };
    },
  },
  {
    name: 'move',
    title: 'Move',
    description: 'A file or folder put into another folder, or at the top of My files; refused when the name is taken there.',
    inputSchema: { type: 'object', properties: { id, folder }, required: ['id'], additionalProperties: false },
    annotations: { ...WRITE, idempotentHint: true },
    async run(drive, args) {
      const moved = await drive.move(str(args, 'id'), optional(args, 'folder'));
      return { text: `Moved ${line(moved)}.`, data: brief(moved) };
    },
  },
  {
    name: 'move_to_trash',
    title: 'Put in the trash',
    description: 'Into the trash, with what is inside it; restore takes it out. Nothing is deleted for good here.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'], additionalProperties: false },
    annotations: { ...WRITE, idempotentHint: true },
    async run(drive, args) {
      const trashed = await drive.moveToTrash(str(args, 'id'));
      return { text: `Put ${line(trashed)} in the trash.`, data: brief(trashed) };
    },
  },
  {
    name: 'restore',
    title: 'Take out of the trash',
    description: 'Back to the folder it was in, or to the top when that folder is gone; with "(2)" when its name was taken meanwhile.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'], additionalProperties: false },
    annotations: { ...WRITE, idempotentHint: true },
    async run(drive, args) {
      const restored = await drive.restore(str(args, 'id'));
      return { text: `Restored ${line(restored)}.`, data: brief(restored) };
    },
  },
];
