// What is written in a file, read in the page as it is uploaded, for the
// drive to find it by: text as it is, a workbook by its cells, and a Word
// document by what reads it (`textOfDocx` of '@rebofiles/drive/rebodocs').
// Nothing for anything else.

import { readXlsx, splitName, textOfSheets } from '@rebofiles/core';

/** The most of a file read as text: the start of a long one is enough to find it by. */
export const TEXT_READ = 2 * 1024 * 1024;

const TEXT_TYPES = /^(text\/|application\/(json|xml|yaml|x-yaml|javascript|csv|rtf))/;
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'html', 'htm', 'css', 'js', 'ts', 'ini', 'toml', 'rtf']);
const isDocx = (name: string, type: string) => type.includes('wordprocessingml') || splitName(name).ext.toLowerCase() === '.docx';

/** The text of a file, or undefined for one that has none to read here; `document` reads a Word document. */
export async function textOf(file: Blob, name: string, document?: (bytes: Uint8Array) => string | Promise<string>): Promise<string | undefined> {
  const ext = splitName(name).ext.slice(1).toLowerCase();
  if (TEXT_TYPES.test(file.type) || TEXT_EXTENSIONS.has(ext)) {
    const text = await file.slice(0, TEXT_READ).text();
    // Bytes that are not text, under a name that said they were.
    return text.includes('\u0000') ? undefined : text;
  }
  if (document && isDocx(name, file.type) && file.size <= 50 * 1024 * 1024) return document(new Uint8Array(await file.arrayBuffer()));
  // A workbook, by what its cells say.
  if ((ext === 'xlsx' || file.type.includes('spreadsheetml')) && file.size <= 20 * 1024 * 1024)
    return textOfSheets(await readXlsx(new Uint8Array(await file.arrayBuffer()), { rows: 5000, columns: 100 })).slice(0, TEXT_READ);
  return undefined;
}
