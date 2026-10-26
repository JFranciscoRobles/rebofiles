// Files shown in the drive itself, without a tab of their own: a picture, a
// page of Markdown, a table of a CSV, code, a Word document in its pages; and
// the others before and after, with the arrows.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { exportDocx, importDocx } from '@rebodocs/core';
import { sampleDocx, sampleDocxWithPicture } from '../../../tools/sample-docx';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

async function axe(page: Page) {
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} · ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('each kind shown in the viewer, the arrows going through them, no tab opened', async ({ page }) => {
  await page.goto('/?as=viewer');
  // Popups of the drive's page: axe opens a page of its own, which is not one.
  const tabs: string[] = [];
  page.on('popup', (opened) => tabs.push(opened.url()));
  // A picture taller than the screen, drawn in the page.
  const pixel = Buffer.from(
    await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(600, 2400);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#0b57d0';
      context.fillRect(0, 0, 600, 2400);
      return Array.from(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()));
    }),
  );
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'a-agreement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(sampleDocx()) },
    { name: 'b-house.png', mimeType: 'image/png', buffer: pixel },
    { name: 'c-notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Visit\n\nThe **client** comes on *Friday*.\n\n- Kitchen\n- Garden\n\n[Map](javascript:alert(1))') },
    { name: 'd-prices.csv', mimeType: 'text/csv', buffer: Buffer.from('Property,Price\n"Casa Rivera, 3 rooms",4500000\n') },
    { name: 'e-config.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1,"b":[2,3]}') },
  ]);
  await expect(item(page, 'e-config.json')).toBeVisible();

  // A Word document's thumbnail is a picture of its first page, made when it was uploaded and kept with it.
  await expect
    .poll(async () => {
      const found = (await (await page.request.get('/api/files/search?q=agreement', { headers: { 'x-user': 'viewer' } })).json()).entries[0];
      return found.versions[0].renditions?.map((r: { type: string }) => r.type);
    })
    // WebP, which keeps the text of a page sharper and lighter than JPEG.
    .toEqual(['image/webp', 'image/webp']);
  await item(page, 'a-agreement.docx').click();
  await expect(page.getByRole('complementary', { name: 'Details' }).locator('img.rf-doc-pic')).toBeVisible();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(item(page, 'a-agreement.docx').locator('img.rf-doc-pic')).toBeVisible();
  await page.getByRole('button', { name: 'List' }).click();

  await item(page, 'c-notes.md').dblclick();
  const viewer = page.getByRole('dialog', { name: 'c-notes.md' });
  await expect(viewer).toBeFocused();
  await expect(viewer.getByRole('heading', { name: 'Visit' })).toBeVisible();
  await expect(viewer.locator('strong', { hasText: 'client' })).toBeVisible();
  await expect(viewer.getByText('3 of 5')).toBeVisible();
  // A link that would run in the page is shown as its words, not as a link.
  await expect(viewer.getByRole('link', { name: 'Map' })).toHaveCount(0);
  expect.soft(await axe(page)).toEqual([]);

  await page.keyboard.press('ArrowRight');
  const table = page.getByRole('dialog', { name: 'd-prices.csv' });
  await expect(table.getByRole('columnheader', { name: 'Property' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Casa Rivera, 3 rooms' })).toBeVisible();

  await table.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'e-config.json' }).locator('pre')).toContainText('"b": [');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'b-house.png' }).getByRole('img', { name: 'b-house.png' })).toBeVisible();
  // Whole on the screen: nothing to scroll.
  expect(await page.locator('.rf-view-image').evaluate((box) => box.scrollHeight <= box.clientHeight && box.scrollWidth <= box.clientWidth)).toBe(true);

  await page.keyboard.press('ArrowLeft');
  const docx = page.getByRole('dialog', { name: 'a-agreement.docx' });
  // Its pages, by Rebodocs' engine.
  await expect(docx.locator('.rf-view-pages .dx-page').first()).toBeVisible({ timeout: 15_000 });
  await expect(docx.getByRole('button', { name: 'Open in Rebodocs' })).toBeVisible();
  // Printed as its pages are shown, in place of a tab of its own.
  await expect(docx.getByRole('button', { name: 'Print' })).toBeVisible();
  await expect(docx.getByRole('button', { name: 'Open in a new tab' })).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void (window as unknown as { printed: number }).printed++;
  });
  await docx.getByRole('button', { name: 'Print' }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await expect(page.locator('body > .dx-print .dx-print-page')).toHaveCount(1);
  // One page under another at first; Rebodocs' bar floating over them sets all of them out, and zooms.
  const bar = docx.locator('.rf-doc-zoom');
  await expect(bar.locator('[data-name="column"]')).toHaveClass(/dx-on/);
  await expect(bar.getByText('Page 1 of 1')).toBeVisible();
  await expect(bar.locator('[data-name="notes"], [data-name="flow"]')).toHaveCount(0);
  await bar.locator('[data-name="grid"]').click();
  await expect(bar.locator('[data-name="grid"]')).toHaveClass(/dx-on/);
  const zoom = bar.locator('.dx-sb-percent');
  const before = await zoom.textContent();
  await bar.locator('[data-name="zoom-in"]').click();
  await expect(zoom).not.toHaveText(before ?? '');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /agreement/ })).toHaveCount(0);
  await expect(page.locator('.rf-items')).toBeFocused();
  await expect(item(page, 'a-agreement.docx')).toHaveAttribute('aria-selected', 'true');
  expect(tabs).toEqual([]);
});

test('a Word document’s thumbnail has its pictures in it', async ({ page }) => {
  await page.goto('/?as=pictures');
  await page
    .locator('input[type=file]:not([webkitdirectory])')
    .setInputFiles({ name: 'house.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(sampleDocxWithPicture()) });
  await expect(item(page, 'house.docx')).toBeVisible();
  let id = '';
  await expect
    .poll(async () => {
      const found = (await (await page.request.get('/api/files/search?q=house', { headers: { 'x-user': 'pictures' } })).json()).entries[0];
      id = found.id;
      return found.versions[0].renditions?.length ?? 0;
    })
    .toBe(2);
  // Where the picture is on the page, under the title, the thumbnail is its green.
  const colour = await page.evaluate(async (file) => {
    const { url } = await (await fetch(`/api/files/entries/${file}/download?size=640`, { headers: { 'x-user': 'pictures' } })).json();
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const [r, g, b] = context.getImageData(Math.round(bitmap.width * 0.2), Math.round(bitmap.height * 0.2), 1, 1).data;
    return [r, g, b];
  }, id);
  expect(Math.abs(colour[0] - 14) + Math.abs(colour[1] - 124) + Math.abs(colour[2] - 82)).toBeLessThan(40);
});

test('a Word document lying down is shown whole in its thumbnail', async ({ page }) => {
  const upright = importDocx(sampleDocx());
  const lying = exportDocx({ ...upright, page: { ...upright.page, width: upright.page.height, height: upright.page.width } });
  await page.goto('/?as=lying');
  await page
    .locator('input[type=file]:not([webkitdirectory])')
    .setInputFiles({ name: 'plan.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(lying) });
  await item(page, 'plan.docx').click();
  await expect(page.getByRole('complementary', { name: 'Details' }).locator('.rf-doc-thumb.rf-wide img.rf-doc-pic')).toBeVisible({ timeout: 15_000 });
});
