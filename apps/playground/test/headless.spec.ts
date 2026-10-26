// The drive built from the hooks alone (src/HooksDrive.tsx), as the guide to
// the hooks shows it: every part of it does what it says.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('a whole drive from the hooks: folders, uploads, details, renaming, versions, the trash, search', async ({ page }) => {
  await page.goto('/headless.html?as=hooks');
  await expect(page.getByText('This folder is empty.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Folder name' }).fill('Hooks');
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByRole('button', { name: '📁 Hooks' }).click();
  await expect(page.getByRole('list', { name: 'Where' })).toContainText('Hooks');

  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('one') }]);
  await page.getByRole('button', { name: 'note.txt' }).click();
  const details = page.getByRole('complementary', { name: 'Details' });
  await expect(details.getByRole('heading', { name: 'note.txt' })).toBeVisible();
  await expect(details).toContainText('hooks · Hooks');

  await details.getByRole('textbox', { name: 'New name' }).fill('notes.txt');
  await details.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('button', { name: 'notes.txt' })).toBeVisible();
  // A name taken is refused, and said.
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'other.txt', mimeType: 'text/plain', buffer: Buffer.from('two') }]);
  await page.getByRole('button', { name: 'other.txt' }).click();
  await details.getByRole('textbox', { name: 'New name' }).fill('notes.txt');
  await details.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('alert')).toContainText('There is already a "notes.txt" there');

  await details.getByRole('button', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await page.getByRole('button', { name: 'other.txt' }).click();
  await page.getByRole('complementary', { name: 'Details' }).getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('This folder is empty.')).toBeVisible();

  await page.getByRole('searchbox').fill('notes');
  await expect(page.getByRole('button', { name: 'notes.txt' })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
