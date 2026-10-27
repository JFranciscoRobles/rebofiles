// The application's own fields of a file, in its details: written a line
// each, shown under the rest, and one taken away by taking its line away.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test('fields written in the details, shown there, found by, and one taken away', async ({ page }) => {
  await page.goto('/?as=fields');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'quote.txt', mimeType: 'text/plain', buffer: Buffer.from('quote') }]);
  // Again without the panel of the uploads, which sits over the bottom of the details.
  await expect(item(page, 'quote.txt')).toBeVisible();
  await page.reload();
  await item(page, 'quote.txt').click();
  await details(page).getByRole('button', { name: 'Edit fields' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit fields' });
  await dialog.getByRole('textbox').fill('client: acme\nstage: sent');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(details(page).getByRole('definition').filter({ hasText: 'acme' })).toBeVisible();
  await expect(details(page).getByRole('term').filter({ hasText: 'stage' })).toBeVisible();

  const found = await (await page.request.get('/api/files/fields?name=client&value=acme', { headers: { 'x-user': 'fields' } })).json();
  expect(found.entries.map((entry: { name: string }) => entry.name)).toEqual(['quote.txt']);

  await details(page).getByRole('button', { name: 'Edit fields' }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue('client: acme\nstage: sent');
  await dialog.getByRole('textbox').fill('client: acme');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(details(page).getByRole('term').filter({ hasText: 'stage' })).toHaveCount(0);
  await expect(details(page).getByRole('definition').filter({ hasText: 'acme' })).toBeVisible();
});
