// A PDF uploaded from the page: its first page made a picture by the server,
// a moment after, and shown in the grid as it comes; and found by what is
// written in it.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

function onePagePdf(line: string): Buffer {
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
  return Buffer.from(out);
}

test('a PDF gets a picture of its first page, and is found by its words', async ({ page }) => {
  await page.goto(`/?as=pdf-${Date.now()}`);
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'results.pdf', mimeType: 'application/pdf', buffer: onePagePdf('Quarterly results of Northwind') }]);
  await expect(item(page, 'results.pdf')).toBeVisible();
  // Made by the server after the upload, and told to the page, which shows it without being asked.
  // Its placeholder, blurred, and the picture over it.
  const picture = item(page, 'results.pdf').locator('.rf-thumb img[loading="lazy"]');
  await expect(picture).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);

  await page.getByRole('searchbox').fill('northwind quarterly');
  await expect(item(page, 'results.pdf')).toBeVisible();
});
