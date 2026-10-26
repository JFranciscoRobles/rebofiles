// What the server makes of a file itself, after it is kept: the pictures of a
// picture and of a PDF's first page, their placeholder, and what is written in
// a PDF and a text, found by a search; nothing of what the page says it made.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { type DriveServerOptions, createDriveHandler, diskStorage, memoryMetadata } from '../src';
import { deriveAll, pdf, pictures, text } from '../src/derive';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-derive-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** A PDF of one page with a line of text, written by hand. */
export function onePagePdf(line: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

function drive(extra: Partial<DriveServerOptions> = {}) {
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' }),
    metadata: memoryMetadata(),
    identify: () => ({ id: 'ana' }),
    authorize: () => true,
    secret: 'u',
    base: '/api/files',
    derive: deriveAll(),
    ...extra,
  });
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => handle(new Request(String(url), init))) as typeof globalThis.fetch;
  return { handle, client: createDriveClient({ base: 'http://drive.test/api/files', fetch, remember: null }), fetch };
}

describe('what the server makes of a file', () => {
  it('of a picture: smaller ones in the drive’s sizes, never larger than it, and its placeholder', async () => {
    const { handle, client, fetch } = drive();
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#0b57d0' } })
      .png()
      .toBuffer();
    const file = await client.upload(new File([png], 'photo.png', { type: 'image/png' }));
    await handle.idle();
    const now = ((await client.entry(file.id)).entry as FileEntry).versions[0];
    expect(now.renditions?.map((r) => [r.size, r.width, r.height, r.type])).toEqual([
      [160, 160, 107, 'image/jpeg'],
      [480, 480, 320, 'image/jpeg'],
      [1024, 1024, 683, 'image/jpeg'],
    ]);
    expect(now.placeholder).toMatch(/^data:image\/webp;base64,/);
    // The smaller one is what the grid is given, and it is a picture of that size.
    const small = await client.url(file.id, { inline: true, size: 160 });
    const read = await sharp(Buffer.from(await (await fetch(small)).arrayBuffer())).metadata();
    expect([read.width, read.height, read.format]).toEqual([160, 107, 'jpeg']);
  });

  it('of a PDF: its first page drawn, and what is written in it, found by a search', async () => {
    const { handle, client } = drive();
    const file = await client.upload(new File([onePagePdf('Quarterly results of Northwind') as BlobPart], 'results.pdf', { type: 'application/pdf' }));
    await handle.idle();
    const now = ((await client.entry(file.id)).entry as FileEntry).versions[0];
    expect(now.renditions?.map((r) => [r.size, r.type])).toEqual([
      [480, 'image/webp'],
      [1024, 'image/webp'],
    ]);
    expect(now.renditions?.[0].height).toBe(480);
    expect(now.placeholder).toMatch(/^data:image\/png;base64,/);
    const found = await client.searchText('northwind quarterly');
    expect(found.map((f) => f.entry.name)).toEqual(['results.pdf']);
    expect(found[0].snippet).toContain('Quarterly results of Northwind');
  });

  it('of a text, what is written in it; and nothing of what the page said it made', async () => {
    const { handle, client } = drive({ derive: deriveAll(pictures(), pdf(), text()) });
    await client.upload(new File(['the budget for next year'], 'notes.md', { type: 'text/markdown' }));
    const png = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const made = await client.upload(new File([png], 'made.png', { type: 'image/png' }), { madeHere: ['pictures', 'text'] });
    await handle.idle();
    expect((await client.searchText('budget')).map((f) => f.entry.name)).toEqual(['notes.md']);
    expect(((await client.entry(made.id)).entry as FileEntry).versions[0].renditions).toBeUndefined();
  });

  it('is not made, and the upload is as it was, when what makes it fails', async () => {
    const { handle, client } = drive({
      derive: async () => {
        throw new Error('no sharp here');
      },
      logger: { error: () => undefined, warn: () => undefined },
    });
    const file = await client.upload(new File(['x'], 'x.txt'));
    await handle.idle();
    expect(((await client.entry(file.id)).entry as FileEntry).versions[0].renditions).toBeUndefined();
  });
});
