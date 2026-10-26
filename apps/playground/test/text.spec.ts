// A file found by what is written in it, with a piece of the text in the row.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a search finds a file by its text as well as by its name, and shows where', async ({ page }) => {
  await page.goto(`/?as=text-${Date.now()}`);
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'meeting.txt', mimeType: 'text/plain', buffer: Buffer.from('We agreed to call Zanzíbar Ltd about the lease on Monday.') },
    { name: 'zanzibar-photo.txt', mimeType: 'text/plain', buffer: Buffer.from('Nothing much.') },
  ]);
  await expect(item(page, 'zanzibar-photo.txt')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search in the drive' }).fill('zanzibar');
  // By its name first, then by what is written in it.
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('listbox').getByRole('option').first()).toHaveAccessibleName(/^zanzibar-photo\.txt/);
  await expect(item(page, 'meeting.txt')).toContainText('call Zanzíbar Ltd about the lease');

  await page.getByRole('searchbox', { name: 'Search in the drive' }).fill('lease monday');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await expect(item(page, 'meeting.txt')).toBeVisible();
});
