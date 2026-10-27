// Starred: a file and a folder starred from their details and their menu,
// marked wherever they are shown, found in Starred, the last first; one's own
// alone; and no longer starred, gone from it.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test('starred from the details and the menu, found in Starred, and taken out again', async ({ page }) => {
  await page.goto('/?as=stars');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('plan') }]);
  await page.locator('.rf-new').click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Clients');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await item(page, 'plan.txt').click();
  await details(page).getByRole('button', { name: 'Add to starred' }).click();
  await expect(details(page).getByRole('button', { name: 'Remove from starred' })).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, 'plan.txt').getByRole('img', { name: 'Starred' })).toBeVisible();
  await item(page, 'Clients').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add to starred' }).click();

  await page.getByRole('button', { name: 'Starred', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Starred' })).toBeVisible();
  const names = page.getByRole('listbox').getByRole('option');
  await expect(names).toHaveCount(2);
  await expect(names.first()).toHaveAccessibleName(/^Clients/);

  // One's own: another person sees none of them.
  const other = await (await page.context().browser()!.newContext()).newPage();
  await other.goto('/?as=nostars');
  await other.getByRole('button', { name: 'Starred', exact: true }).click();
  await expect(other.getByText('Nothing starred yet')).toBeVisible();
  await other.context().close();

  await item(page, 'plan.txt').click();
  await details(page).getByRole('button', { name: 'Remove from starred' }).click();
  await expect(names).toHaveCount(1);
});
