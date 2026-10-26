// The tools of Rebodocs, on the Word documents of the drive: read a contract,
// fill a template, put a clause in its place, track a change. Each takes the
// id of a .docx file, reads it from the drive as the person, runs the tool of
// @rebodocs/mcp on it, and when the tool changed the document, writes it back
// as a new version of the same file: nothing is kept between calls, and what
// an assistant did is undone by restoring the version before.
//
// Only with @rebodocs/mcp installed beside it; without it, there are none.

import { type FileEntry, splitName } from '@rebofiles/core';
import type { Drive } from './drive';
import { type Tool, brief, isDocx, str } from './tools';

type Rebodocs = typeof import('@rebodocs/mcp');
type Engine = typeof import('@rebodocs/core');
type Doc = ReturnType<Engine['importDocx']>;

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The most of a Word document read here, in bytes: its pictures count. */
export const DOCUMENT_LIMIT = 25_000_000;

/** Tools that work out where the pages fall, which needs the fonts of the document: not here. */
const UNLAID = new Set(['read_pages', 'insert_table_of_contents', 'update_table_of_contents']);

const PICTURES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

const document = { type: 'string', description: 'The id of a Word document (.docx) of the drive, as list_folder or search gave it.' };
const picture = { type: 'string', description: 'The id of a picture of the drive: PNG, JPEG or GIF.' };

/** What a tool of Rebodocs takes from a file on the disk, taken from the drive instead. */
const FROM_THE_DRIVE: Record<string, { properties: Record<string, unknown>; required?: string[]; description?: string }> = {
  insert_image: { properties: { image: picture }, required: ['image'] },
  set_letterhead: { properties: { image: { ...picture, description: `${picture.description} The shape of the paper.` } } },
  compare_documents: {
    properties: {
      version: { type: 'string', description: 'A version of the same document to compare with, from get_info. Left out, with "other" also left out: the version before the current one.' },
      other: { type: 'string', description: 'Another Word document of the drive to compare with, instead.' },
    },
    description:
      'What changed between this document and another version of it: an earlier version of the same file (the one before the current, unless "version" says), or another document ("other"). The paragraphs put in, taken out and changed, of the text and of its headers, footers, notes and text boxes, and the notes on the text, with what was taken out as [-…-] and what was put in as {+…+}. Tracked changes are compared as if accepted, as Word does. By default the other is the earlier one; with "file_is" "later", it is the later one.',
  },
};

const base64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** The bytes of a Word document of the drive, as it is now or of a version: the file, the version, and the bytes. */
async function docx(drive: Drive, id: string, version?: string) {
  const { entry } = await drive.entry(id);
  if (entry.kind !== 'file') throw new TypeError(`"${entry.name}" is a folder, not a Word document.`);
  if (!isDocx(entry.name, entry.type)) throw new TypeError(`"${entry.name}" is ${entry.type}, not a Word document (.docx).`);
  const at = version ? entry.versions.find((v) => v.id === version) : entry.versions[0];
  if (!at) throw new TypeError(`"${entry.name}" has no version ${version}: get_info lists them.`);
  if (at.size > DOCUMENT_LIMIT) throw new TypeError(`"${entry.name}" is ${at.size} bytes, more than the ${DOCUMENT_LIMIT} worked on here.`);
  return { file: entry, version: at.id, bytes: await drive.bytes(entry.id, version) };
}

/** A Word document of the drive as it is now: the file, its version, and its document. */
async function open(drive: Drive, engine: Engine, id: string) {
  const { file, version, bytes } = await docx(drive, id);
  try {
    return { file, version, doc: engine.importDocx(bytes) };
  } catch (error) {
    throw new TypeError(`"${file.name}" could not be read as a Word document: ${(error as Error).message}`);
  }
}

/** Bytes of the drive that a tool of Rebodocs would have read from a path. */
async function fromTheDrive(drive: Drive, name: string, args: Record<string, unknown>, opened: { file: FileEntry; version: string }) {
  if (name === 'insert_image' || (name === 'set_letterhead' && args.image !== undefined && args.remove !== true)) {
    const { image, ...rest } = args;
    const { entry } = await drive.entry(str({ image }, 'image'));
    const type = entry.kind === 'file' ? (PICTURES[splitName(entry.name).ext.toLowerCase()] ?? Object.values(PICTURES).find((t) => t === entry.type)) : undefined;
    if (!type) throw new TypeError(`"${entry.name}" is not a picture that goes in a document: PNG, JPEG or GIF.`);
    return { ...rest, type, data: base64(await drive.bytes(entry.id)) };
  }
  if (name === 'compare_documents') {
    const { version, other, ...rest } = args;
    const asked = typeof version === 'string' && version ? version : undefined;
    if (typeof other === 'string' && other) return { ...rest, data: base64((await docx(drive, other, asked)).bytes) };
    const versions = opened.file.versions;
    const earlier = asked ?? versions[versions.findIndex((v) => v.id === opened.version) + 1]?.id;
    if (!earlier) throw new TypeError(`"${opened.file.name}" has only one version: there is nothing earlier to compare it with.`);
    return { ...rest, data: base64((await docx(drive, opened.file.id, earlier)).bytes) };
  }
  return args;
}

/** The tools of Rebodocs on the drive's documents, and one to start a document; none without Rebodocs. */
export async function documentTools(): Promise<Tool[]> {
  let rebodocs: Rebodocs;
  let engine: Engine;
  try {
    [rebodocs, engine] = await Promise.all([import('@rebodocs/mcp'), import('@rebodocs/core')]);
  } catch {
    return [];
  }

  /** The document written back, as a new version, unless someone saved another meanwhile. */
  const save = async (drive: Drive, opened: Awaited<ReturnType<typeof open>>, doc: Doc) => {
    const { entry } = await drive.entry(opened.file.id);
    if (entry.kind === 'file' && entry.versions[0].id !== opened.version)
      throw new TypeError(`"${entry.name}" was saved by ${entry.modifiedBy} while this was done, and was not changed: read it again and do it on what it is now.`);
    return drive.upload(engine.exportDocx(doc), opened.file.type || DOCX, { file: opened.file.id });
  };

  const wrapped = rebodocs.TOOLS.filter((tool) => !UNLAID.has(tool.name)).map((tool): Tool => {
    const own = FROM_THE_DRIVE[tool.name];
    const { path: _, ...properties } = rebodocs.toolProperties(tool);
    return {
      name: tool.name,
      title: tool.title,
      description: own?.description ?? tool.description,
      inputSchema: {
        type: 'object',
        properties: { document, ...properties, ...own?.properties },
        required: ['document', ...(tool.required ?? []).filter((name) => name !== 'path'), ...(own?.required ?? [])],
        additionalProperties: false,
      },
      // A change is a new version of the file: the one before is there to restore.
      annotations: { readOnlyHint: !tool.writes, destructiveHint: false, idempotentHint: !tool.writes || !!tool.idempotent, openWorldHint: false },
      async run(drive, args) {
        const { document: id, ...rest } = args;
        const opened = await open(drive, engine, str({ document: id }, 'document'));
        const given = await fromTheDrive(drive, tool.name, rest, opened);
        let result: ReturnType<Rebodocs['runTool']>;
        try {
          result = rebodocs.runTool(opened.doc, tool.name, given);
        } catch (error) {
          // What the assistant got wrong is said to it, for it to do otherwise.
          if (error instanceof rebodocs.ToolError) throw new TypeError(error.message);
          throw error;
        }
        if (!result.doc || result.doc === opened.doc) return { text: result.text, data: { ...brief(opened.file), version: opened.version, changed: false } };
        const saved = await save(drive, opened, result.doc);
        return {
          text: `${result.text}\nSaved as version ${saved.versions.length} of "${saved.name}"; restore_version with the one before undoes it.`,
          data: { ...brief(saved), version: saved.versions[0].id, previous: opened.version, changed: true },
        };
      },
    };
  });

  const create: Tool = {
    name: 'create_document',
    title: 'Start a Word document',
    description: 'A new, empty Word document (.docx) in the drive, to write in with insert_paragraphs (after_paragraph 0); with "(2)" after its name when the name is taken there.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Its name; ".docx" is put after it when it does not end so.' },
        folder: { type: ['string', 'null'], description: 'The id of a folder; left out for the top of My files.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(drive, args) {
      const asked = str(args, 'name').trim();
      const name = splitName(asked).ext.toLowerCase() === '.docx' ? asked : `${asked}.docx`;
      const made = await drive.upload(engine.exportDocx(engine.createDoc()), DOCX, { name, parent: typeof args.folder === 'string' && args.folder ? args.folder : null });
      return { text: `Made "${made.name}" (id ${made.id}). It is empty: insert_paragraphs with after_paragraph 0 writes in it.`, data: brief(made) };
    },
  };

  return [create, ...wrapped];
}
