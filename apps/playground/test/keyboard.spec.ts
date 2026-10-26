// The drive with the keyboard alone: no click from the first key to the last.
// Its own person (`?as=keys-…`), so it starts from a drive of its own.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const said = (page: Page) => page.locator('.rf-sr[aria-live]');
const focused = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute('aria-label'));

test('makes folders from the menu, goes into one, uploads, renames, moves and trashes, by keys', async ({ page }) => {
  // A person of its own each time, so it starts from an empty drive however often it runs.
  await page.goto(`/?as=keys-${Date.now()}`);
  await expect(said(page)).toHaveText('My files · 0 items');

  // The menu: the arrows go round it, Escape gives the focus back.
  const upload = page.getByRole('button', { name: 'Upload' });
  await upload.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  expect(await focused(page)).toBe('Upload files');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('New folder');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('Upload files');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(upload).toBeFocused();

  for (const name of ['Archive', 'Projects']) {
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await expect(item(page, name)).toBeVisible();
    await upload.focus();
  }

  // The list: the arrows choose, Enter goes in, and where one is is said.
  await page.getByRole('listbox').focus();
  await page.keyboard.press('End');
  await expect(item(page, 'Projects')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(said(page)).toHaveText('Projects · 0 items');

  await page.locator('input[type=file]').setInputFiles([{ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('The plan.') }]);
  await expect(item(page, 'plan.txt')).toBeVisible();
  await page.getByRole('listbox').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('F2');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('plan v2.txt');
  await page.keyboard.press('Enter');
  await expect(item(page, 'plan v2.txt')).toBeVisible();

  // Moved from the dialog, reached by Tab from the list.
  await page.getByRole('listbox').focus();
  await page.keyboard.press('Home');
  const move = page.getByRole('complementary', { name: 'Details' }).getByRole('button', { name: 'Move', exact: true });
  for (let i = 0; i < 12 && !(await move.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(move).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The folders come once the dialog has asked for them: tabbing before would go round what is there without them.
  await expect(dialog.getByRole('button', { name: 'Archive' })).toBeVisible();
  for (let i = 0; i < 8 && (await focused(page)) !== 'Archive'; i++) await page.keyboard.press('Tab');
  expect(await focused(page)).toBe('Archive');
  await page.keyboard.press('Enter');
  // Inside Archive, which has no folders, the focus is on what is left to do.
  await expect(dialog.getByRole('button', { name: 'Move here' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(item(page, 'plan v2.txt')).toBeHidden();

  // Back up by the crumb, into Archive, and the file to the trash with Delete.
  await page.getByRole('button', { name: 'My files' }).last().focus();
  await page.keyboard.press('Enter');
  // As a person would, once it is said where one is.
  await expect(said(page)).toHaveText('My files · 2 items');
  await page.getByRole('listbox').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(said(page)).toHaveText('Archive · 1 item');
  await page.getByRole('listbox').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status').filter({ hasText: 'moved to the trash' })).toBeVisible();
  await expect(said(page)).toHaveText('Archive · 0 items');
});
