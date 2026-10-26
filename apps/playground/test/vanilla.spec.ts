// The drive of @rebofiles/drive on a page with no framework at all: the same
// screen, its keys and its dialogs, and not a module of React loaded.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('makes a folder, uploads into it, renames and trashes, with no React in the page', async ({ page }) => {
  await page.goto('/vanilla.html?as=vanilla');
  await expect(page.getByText('This folder is empty.')).toBeVisible();

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Plain');
  await page.getByRole('button', { name: 'Create' }).click();
  await item(page, 'Plain').dblclick();
  await page.locator('input[type=file]').setInputFiles([{ name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from('No framework.') }]);
  await item(page, 'plain.txt').click();
  await expect(page.getByRole('complementary', { name: 'Details' }).getByText('No framework.')).toBeVisible();

  await page.keyboard.press('F2');
  await page.getByRole('textbox', { name: 'New name' }).fill('still plain.txt');
  await page.keyboard.press('Enter');
  await expect(item(page, 'still plain.txt')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status').filter({ hasText: 'moved to the trash' })).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
  expect(loaded.filter((name) => /\/react(-dom)?[./_-]/.test(name))).toEqual([]);
});
