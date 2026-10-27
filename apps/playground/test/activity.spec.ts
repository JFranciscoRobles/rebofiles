// What was done, in the details: who did what to a file, and in a folder.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test('the activity of a file and of its folder, the newest first, as it changes', async ({ page }) => {
  const who = `act-${Date.now()}`;
  await page.goto(`/?as=${who}`);
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Log');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await item(page, 'Log').dblclick();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await item(page, 'notes.txt').click();
  await details(page).getByRole('button', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename' });
  await rename.getByRole('textbox').fill('notes-final.txt');
  await rename.getByRole('button', { name: 'Save' }).click();
  await expect(item(page, 'notes-final.txt')).toBeVisible();

  await item(page, 'notes-final.txt').click();
  await details(page).getByRole('tab', { name: 'Activity' }).click();
  const lines = details(page).getByRole('list', { name: 'Activity' }).getByRole('listitem');
  await expect(lines).toHaveCount(2);
  await expect(lines.first()).toContainText(`${who} renamed notes.txt to notes-final.txt`);
  await expect(lines.last()).toContainText(`${who} uploaded notes.txt`);

  // The folder's: what was done in it too.
  await page.getByRole('main').getByRole('button', { name: 'My files' }).click();
  await item(page, 'Log').click();
  await details(page).getByRole('tab', { name: 'Activity' }).click();
  await expect(lines).toHaveCount(3);
  await expect(lines.last()).toContainText(`${who} created Log`);
});
