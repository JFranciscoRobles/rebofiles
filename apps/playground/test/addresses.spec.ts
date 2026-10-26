// The addresses of what a view shows: asked for together, one request for a
// grid of pictures; and a picture that did not load, asked for again.

import { type Page, expect, test } from '@playwright/test';

/** A picture of one colour, as PNG bytes, drawn in the page. */
const picture = (page: Page, colour: string) =>
  page.evaluate(async (fill) => {
    const canvas = new OffscreenCanvas(40, 30);
    const context = canvas.getContext('2d')!;
    context.fillStyle = fill;
    context.fillRect(0, 0, 40, 30);
    return Array.from(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()));
  }, colour);

test('a grid of pictures asks for their addresses in one request, and a picture that did not load is asked for again', async ({ page }) => {
  await page.goto('/?as=addresses');
  const colours = ['#0b57d0', '#0e7c52', '#c026d3', '#dc2626', '#ea580c', '#334155'];
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(await Promise.all(colours.map(async (c, i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: Buffer.from(await picture(page, c)) }))));
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(6);

  const asked: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/files/urls' || path.endsWith('/download')) asked.push(path.endsWith('/download') ? 'download' : 'urls');
  });
  // The first time each picture is read from the bytes it fails, as an address out of date would.
  const failedOnce = new Set<string>();
  await page.route('**/api/files/bytes?**', (route) => {
    if (!failedOnce.has(route.request().url())) {
      failedOnce.add(route.request().url());
      return route.fulfill({ status: 403, body: 'That address is out of date.' });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Grid' }).click();
  const pictures = page.locator('.rf-thumb img');
  await expect(pictures).toHaveCount(6);
  await expect.poll(() => pictures.evaluateAll((all) => all.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(failedOnce.size).toBeGreaterThanOrEqual(6);
  expect(asked.filter((a) => a === 'download')).toEqual([]);
  // One for the grid, and one again for the picture that failed.
  expect(asked.filter((a) => a === 'urls').length).toBeLessThanOrEqual(3);
});
