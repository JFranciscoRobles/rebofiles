// Pictures made one PDF, a page each: the pages of a document a phone's
// camera took, sent as one. Each drawn on a canvas as a JPEG, no larger than
// it needs, and put in the PDF as it is (DCTDecode), its page as large as
// fits a sheet of A4 at its own shape. Nothing to install: the PDF is a few
// objects written here.

const encoder = new TextEncoder();

/** A picture as a JPEG no longer than `most` pixels on its longest side, and its size. */
async function jpegOf(picture: Blob, most: number): Promise<{ width: number; height: number; bytes: Uint8Array }> {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, most / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  // Paper: a picture with no colour of its own is white, not black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The picture could not be drawn.'))), 'image/jpeg', 0.85));
  return { width, height, bytes: new Uint8Array(await jpeg.arrayBuffer()) };
}

/** Pictures as one PDF, a page each in their order. */
export async function picturesToPdf(pictures: Blob[], most = 2000): Promise<Blob> {
  if (!pictures.length) throw new Error('There is no picture to make a PDF of.');
  const pages = [];
  for (const picture of pictures) pages.push(await jpegOf(picture, most));
  const parts: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];
  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, ...body: (string | Uint8Array)[]) => {
    offsets[n] = length;
    write(`${n} 0 obj\n`);
    for (const part of body) write(part);
    write('\nendobj\n');
  };
  // A binary comment after the header, as readers expect of a file with binary streams.
  write('%PDF-1.4\n');
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((page, i) => {
    // A sheet of A4 (595 × 842 points) at the picture's own shape.
    const fit = Math.min(595 / page.width, 842 / page.height);
    const w = Math.round(page.width * fit);
    const h = Math.round(page.height * fit);
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(3 + i * 3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${4 + i * 3} 0 R >> >> /Contents ${5 + i * 3} 0 R >>`);
    object(
      4 + i * 3,
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      page.bytes,
      '\nendstream',
    );
    object(5 + i * 3, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });
  const size = 3 + pages.length * 3;
  const table = length;
  write(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let n = 1; n < size; n++) write(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
