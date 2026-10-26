// A Word document made in code, for the tests and the playground: a title in
// Word's Heading 1 and a few clauses. `npm run sample -- out.docx` writes it
// (tools/sample.ts).

import { createDoc, exportDocx, insertImage, insertText, setParagraphStyle, splitParagraph } from '@rebodocs/core';
import { zlibSync } from 'fflate';

export function sampleDocx(title = 'Service agreement', clauses = ['The parties agree to what follows.', 'Payment is due within thirty days.', 'Either party may end it in writing.']): Uint8Array {
  let doc = createDoc();
  const lines = [title, ...clauses];
  lines.forEach((line, i) => {
    doc = insertText(doc, { para: i, offset: 0 }, line).doc;
    if (i < lines.length - 1) doc = splitParagraph(doc, { para: i, offset: line.length }).doc;
  });
  return exportDocx(setParagraphStyle(doc, 0, 0, 'Heading1'));
}

/** A picture of `width` × `height` in one colour, as a PNG made by hand: for a document with a picture in it. */
export function samplePng(width = 300, height = 120, [r, g, b] = [14, 124, 82]): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set([r, g, b], y * (width * 3 + 1) + 1 + x * 3);
  const crc = (bytes: Uint8Array) => {
    let c = ~0;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, width);
  new DataView(header.buffer).setUint32(4, height);
  header.set([8, 2], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlibSync(raw)), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) png.set(part, at), (at += part.length);
  return png;
}

/** A title and a picture under it. */
export function sampleDocxWithPicture(title = 'Casa Rivera'): Uint8Array {
  let doc = insertText(createDoc(), { para: 0, offset: 0 }, title).doc;
  doc = splitParagraph(setParagraphStyle(doc, 0, 0, 'Heading1'), { para: 0, offset: title.length }).doc;
  const made = insertImage(doc, { para: 1, offset: 0 }, { bytes: samplePng(), type: 'image/png', width: 300, height: 120 });
  return exportDocx(made.doc);
}
