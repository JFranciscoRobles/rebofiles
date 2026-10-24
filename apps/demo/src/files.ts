// The bytes of the demo's files, made in the page: Word documents with
// Rebodocs' engine, PDFs written by hand, pictures drawn on a canvas. None is
// a real document; each says what its preview shows.

import { createDoc, exportDocx, insertText, setParagraphStyle, splitParagraph } from '@rebodocs/core';

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** A title in Word's Heading 1, and its paragraphs. */
export function docx(title: string, paragraphs: string[]): Blob {
  let doc = createDoc();
  const lines = [title, ...paragraphs];
  lines.forEach((line, i) => {
    doc = insertText(doc, { para: i, offset: 0 }, line).doc;
    if (i < lines.length - 1) doc = splitParagraph(doc, { para: i, offset: line.length }).doc;
  });
  return new Blob([exportDocx(setParagraphStyle(doc, 0, 0, 'Heading1')) as BlobPart], { type: DOCX });
}

/** A page of a PDF with a title and some lines, in Helvetica: the least a viewer opens. */
export function pdf(title: string, text: string): Blob {
  // Helvetica of a PDF takes Latin-1; the few other characters here are said in it.
  const plain = (s: string) =>
    s
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–]/g, '-')
      .replace(/[\\()]/g, '\\$&');
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    if (lines.length && `${lines[lines.length - 1]} ${word}`.length <= 78) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  const content = `BT /F1 22 Tf 72 720 Td (${plain(title)}) Tj /F1 12 Tf 0 -34 Td ${lines.map((line) => `(${plain(line)}) Tj 0 -18 Td`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff)], { type: 'application/pdf' });
}

/** A picture drawn on a canvas, as PNG or JPEG. */
export function picture(type: 'image/png' | 'image/jpeg', draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 420;
  draw(canvas.getContext('2d')!, canvas.width, canvas.height);
  return new Promise((done) => canvas.toBlob((blob) => done(blob!), type, 0.86));
}

/** A spreadsheet as the list of its rows: CSV, which every spreadsheet opens. */
export const csv = (rows: string[][]): Blob => new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
