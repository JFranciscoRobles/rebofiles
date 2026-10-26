// Files shown in the drive itself, without a tab of their own: a picture, a
// page of Markdown, a table of a CSV, code, a Word document in its pages; and
// the others before and after, with the arrows.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { sampleDocx } from '../../../tools/sample-docx';

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
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a-agreement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(sampleDocx()) },
    { name: 'b-house.png', mimeType: 'image/png', buffer: pixel },
    { name: 'c-notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Visit\n\nThe **client** comes on *Friday*.\n\n- Kitchen\n- Garden\n\n[Map](javascript:alert(1))') },
    { name: 'd-prices.csv', mimeType: 'text/csv', buffer: Buffer.from('Property,Price\n"Casa Rivera, 3 rooms",4500000\n') },
    { name: 'e-config.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1,"b":[2,3]}') },
  ]);
  await expect(item(page, 'e-config.json')).toBeVisible();

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
  await expect(docx.getByText('1 page')).toBeVisible();
  await expect(docx.getByRole('button', { name: 'All pages' })).toHaveAttribute('aria-pressed', 'true');
  await docx.getByRole('button', { name: 'One by one' }).click();
  await expect(docx.getByRole('button', { name: 'One by one' })).toHaveAttribute('aria-pressed', 'true');
  await expect(docx.locator('.rf-view-pages .dx-page').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /agreement/ })).toHaveCount(0);
  await expect(page.locator('.rf-items')).toBeFocused();
  await expect(item(page, 'a-agreement.docx')).toHaveAttribute('aria-selected', 'true');
  expect(tabs).toEqual([]);
});
