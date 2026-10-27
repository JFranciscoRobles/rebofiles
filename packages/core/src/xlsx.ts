// An Excel workbook (.xlsx) read as tables: each sheet's name and its cells as
// text, for the drive to show and find it by. With nothing but what the page
// and Node have: the zip read here, its parts inflated by DecompressionStream,
// and the XML read for the little it holds. Numbers are as they are kept (a
// date is the number Excel counts it by); formulas, their last value.

/** A sheet of a workbook: what it is called, and its rows, each cell as text. */
export interface Sheet {
  name: string;
  rows: string[][];
}

/** How much of a workbook is read: the rows and columns of each sheet, and how many sheets. */
export interface SheetLimits {
  rows?: number;
  columns?: number;
  sheets?: number;
}

/** The parts of a zip, by name, each read when asked for. */
function zipParts(bytes: Uint8Array): Map<string, () => Promise<Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end of the central directory: its signature, looked for from the end, past a comment of up to 64 KiB.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65_535); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error('This is not a zip.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const parts = new Map<string, () => Promise<Uint8Array>>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('The zip is broken.');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    parts.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error(`A part of the zip is packed in a way not read here (${method}).`);
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const textOfXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) =>
    name[0] === '#' ? String.fromCodePoint(name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))) : (ENTITIES[name] ?? whole),
  );
const attrsOf = (tag: string) => {
  const found: Record<string, string> = {};
  for (const [, name, value] of tag.matchAll(/([\w:]+)="([^"]*)"/g)) found[name] = textOfXml(value);
  return found;
};
/** The text of runs, `<t>` after `<t>`, as a shared string or an inline one is written. */
const runsOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(([, text]) => textOfXml(text)).join('');
/** A column's number from its letters: A is 0, Z 25, AA 26. */
const columnOf = (ref: string) => {
  let n = 0;
  for (const letter of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? '') n = n * 26 + letter.charCodeAt(0) - 64;
  return n - 1;
};

/** The sheets of a workbook, in their order, each as far as `limits` says: 1000 rows and 100 columns unless said. */
export async function readXlsx(bytes: Uint8Array, limits: SheetLimits = {}): Promise<Sheet[]> {
  const maxRows = limits.rows ?? 1000;
  const maxColumns = limits.columns ?? 100;
  const parts = zipParts(bytes);
  const text = async (name: string) => {
    const read = parts.get(name);
    return read ? new TextDecoder().decode(await read()) : undefined;
  };
  const workbook = await text('xl/workbook.xml');
  if (workbook === undefined) throw new Error('This is not an Excel workbook.');
  const rels = (await text('xl/_rels/workbook.xml.rels')) ?? '';
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => attrsOf(tag)).map((a) => [a.Id, a.Target] as const));
  const shared = [...((await text('xl/sharedStrings.xml')) ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) => runsOf(si));

  const sheets: Sheet[] = [];
  for (const [tag] of [...workbook.matchAll(/<sheet\b[^>]*>/g)].slice(0, limits.sheets ?? 50)) {
    const attrs = attrsOf(tag);
    const target = targets.get(attrs['r:id']) ?? '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = (await text(path)) ?? '';
    const rows: string[][] = [];
    for (const [, rowAttrs, inside] of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const at = Number(attrsOf(rowAttrs).r ?? rows.length + 1) - 1;
      if (at >= maxRows) break;
      const row: string[] = [];
      for (const [, cellAttrs, body = ''] of (inside ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const cell = attrsOf(cellAttrs);
        const column = cell.r ? columnOf(cell.r) : row.length;
        if (column >= maxColumns) continue;
        const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const shown =
          cell.t === 's' ? (shared[Number(value)] ?? '') : cell.t === 'inlineStr' ? runsOf(body) : cell.t === 'b' ? (value === '1' ? 'TRUE' : 'FALSE') : value === undefined ? '' : textOfXml(value);
        row[column] = shown;
      }
      rows[at] = Array.from(row, (cell) => cell ?? '');
    }
    sheets.push({ name: attrs.name ?? `Sheet ${sheets.length + 1}`, rows: Array.from(rows, (row) => row ?? []) });
  }
  return sheets;
}

/** What is written in a workbook, a row a line and its cells apart by tabs: for the drive to find it by. */
export const textOfSheets = (sheets: Sheet[]): string => sheets.map((sheet) => [sheet.name, ...sheet.rows.map((row) => row.join('\t'))].join('\n')).join('\n\n');
