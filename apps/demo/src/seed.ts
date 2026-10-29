// Acme's drive, as the landing shows it: four folders and the files in them,
// made with core so that what the demo does is what a real drive does. The
// dates go back from today.

import { type Context, type Drive, addFile, createFolder, emptyDrive } from '@rebofiles/core';
import { DOCX, csv, docx, pdf, picture } from './files';

export const YOU = 'You';
export const CONTRACT = 'c1';

const daysAgo = (days: number, hour = 10): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 12, 0, 0);
  return date.toISOString();
};
const by = (who: string, days: number, hour?: number): Context => ({ by: who, at: daysAgo(days, hour) });

export async function seed(): Promise<{ drive: Drive; blobs: Map<string, Blob> }> {
  const blobs = new Map<string, Blob>();
  let drive = emptyDrive();
  const folder = (id: string, name: string, parent: string | null, context: Context) => {
    drive = createFolder(drive, { id, name, parent }, context);
  };
  const file = (id: string, name: string, parent: string | null, blob: Blob, context: Context) => {
    const key = `${id}/v1`;
    blobs.set(key, blob);
    drive = addFile(drive, { id, name, parent, type: blob.type || DOCX, version: { id: 'v1', key, size: blob.size } }, context);
  };

  folder('f1', 'Contracts', null, by('Ana', 12));
  folder('f2', 'Invoices', null, by(YOU, 12));
  folder('f3', 'Brand assets', null, by(YOU, 12));
  folder('f4', 'Reports 2026', null, by('Luis', 12));

  file('r1', 'receipt.docx', null, docx('Receipt', ['Billed to Northwind S.A. — payment due in 15 days.', 'The total amount is paid on the day of the reservation.']), by(YOU, 0, 9));
  file('r2', 'onboarding.pdf', null, pdf('Welcome to Acme', 'Your first week: accounts, tools, the people you will work with and where everything lives.'), by('Ana', 21));
  file(
    'r3',
    'roadmap.csv',
    null,
    csv([
      ['Quarter', 'Item', 'Owner'],
      ['Q4', 'Sync client', 'Luis'],
      ['Q4', 'Sharing v2', 'Ana'],
      ['Q4', 'MCP tools', 'You'],
    ]),
    by('Luis', 4),
  );
  file(
    CONTRACT,
    'contract-final(2).docx',
    'f1',
    docx('Service agreement', [
      'This agreement is made between Acme Ltd. and Northwind S.A. for the provision of services described below.',
      'Payment is due within thirty days of each invoice.',
      'Either party may end it in writing, with thirty days of notice.',
    ]),
    by('Ana', 1),
  );
  file('c2', 'nda-studio-lumen.docx', 'f1', docx('Mutual NDA', ['Each party agrees to hold the other party’s confidential information in strict confidence.']), by(YOU, 4));
  file('c3', 'msa-casa-rivera.pdf', 'f1', pdf('Master services agreement', 'Signed copy. Terms effective from 1 October 2026 for a period of twelve months.'), by('Ana', 26));
  file('i1', 'invoice-0142.pdf', 'f2', pdf('Invoice 0142', 'Northwind S.A. - $2,500.00 - Due 15 Oct'), by(YOU, 23));
  file('i2', 'invoice-0143.pdf', 'f2', pdf('Invoice 0143', 'Studio Lumen - $1,180.00 - Due 30 Oct'), by(YOU, 9));
  file(
    'b1',
    'logo-mark.png',
    'f3',
    await picture('image/png', (ctx, w, h) => {
      ctx.fillStyle = '#fcebdd';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 110, h / 2 - 80, 220, 160, 28);
      ctx.fill();
      ctx.fillStyle = '#fcebdd';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 70, h / 2 - 40, 140, 90, 12);
      ctx.fill();
    }),
    by(YOU, 6),
  );
  file(
    'b2',
    'office.jpg',
    'f3',
    await picture('image/jpeg', (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#fbf3db');
      sky.addColorStop(1, '#fcebdd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e86a8c';
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.3, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a4a9c';
      for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 96, h - 120 - (i % 3) * 50, 70, 120 + (i % 3) * 50);
    }),
    by('Ana', 14),
  );
  file('p1', 'q3-summary.docx', 'f4', docx('Q3 summary', ['Revenue grew across all regions.', 'The sync client shipped to the first design partners.']), by('Luis', 8));

  return { drive, blobs };
}
