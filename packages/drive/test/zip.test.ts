// The .zip as it is written: what a reader of the format finds in it, the
// text deflated and the rest kept, names in any language, folders, and ZIP64.

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type ZipItem, blobSink, crc32, worthDeflating, writeZip } from '../src/zip';

const stream = (bytes: Uint8Array) => new Response(bytes as Uint8Array<ArrayBuffer>).body!;
const file = (path: string, text: string | Uint8Array, compress = false): ZipItem => {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  return { path, modified: new Date(2026, 9, 26, 10, 30, 14), size: bytes.length, compress, open: async () => stream(bytes) };
};
async function zipped(items: ZipItem[], zip64 = false) {
  const sink = blobSink();
  await writeZip(items, sink, { zip64 });
  return new Uint8Array(await sink.blob().arrayBuffer());
}

describe('a .zip written as its files come', () => {
  const noise = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7919) % 251);
  const items = () => [
    { path: 'Contratos/', modified: new Date(2026, 9, 26) },
    file('Contratos/notas — año 2026.md', '# Notas\n'.repeat(2000), true),
    file('Contratos/foto.png', noise),
    { path: 'Vacía/', modified: new Date(2026, 9, 26) },
    file('léeme.txt', ''),
  ];

  it('holds every file as it was, the text deflated, names in UTF-8, folders and an empty one', async () => {
    const bytes = await zipped(items());
    const read = unzipSync(bytes);
    expect(Object.keys(read).sort()).toEqual(['Contratos/', 'Contratos/foto.png', 'Contratos/notas — año 2026.md', 'Vacía/', 'léeme.txt']);
    expect(new TextDecoder().decode(read['Contratos/notas — año 2026.md'])).toBe('# Notas\n'.repeat(2000));
    expect(Buffer.from(read['Contratos/foto.png']).equals(Buffer.from(noise))).toBe(true);
    expect(read['léeme.txt']).toHaveLength(0);
    // The text, 16 KB, deflated to a fraction; the noise kept as it is.
    expect(bytes.length).toBeLessThan(70_000 + 2_000);
  });

  it('holds the same written as ZIP64', async () => {
    const read = unzipSync(await zipped(items(), true));
    expect(new TextDecoder().decode(read['Contratos/notas — año 2026.md'])).toBe('# Notas\n'.repeat(2000));
    expect(Buffer.from(read['Contratos/foto.png']).equals(Buffer.from(noise))).toBe(true);
  });

  it('works out the CRC-32 of the format, piece by piece', () => {
    const text = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
    expect(crc32(text).toString(16)).toBe('414fa339');
    expect(crc32(text.subarray(10), crc32(text.subarray(0, 10)))).toBe(crc32(text));
  });

  it('deflates text and leaves what is compressed already', () => {
    expect(worthDeflating('text/plain', 'a.txt')).toBe(true);
    expect(worthDeflating('application/json', 'a.json')).toBe(true);
    expect(worthDeflating('image/svg+xml', 'a.svg')).toBe(true);
    for (const [type, name] of [
      ['image/jpeg', 'a.jpg'],
      ['application/pdf', 'a.pdf'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'],
      ['application/octet-stream', 'a.zip'],
    ])
      expect(worthDeflating(type, name)).toBe(false);
  });
});
