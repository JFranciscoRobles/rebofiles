// A copy of a file from its menu, beside it with "(2)"; and a folder shared
// with someone for a week, until when said in its details and in the dialog.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test('a copy made from the menu, beside the file', async ({ page }) => {
  await page.goto('/?as=copier');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'budget.txt', mimeType: 'text/plain', buffer: Buffer.from('the budget') }]);
  await item(page, 'budget.txt').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Make a copy' }).click();
  await expect(item(page, 'budget (2).txt')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status').getByText('A copy of “budget.txt” made')).toBeVisible();
});

test('shared for a week: until when, in the dialog and the details', async ({ page }) => {
  await page.request.post('/api/files/folders', { headers: { 'x-user': 'weekly' }, data: { name: 'Audit', parent: null } });
  await page.goto('/?as=weekly');
  await item(page, 'Audit').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: /Audit/ });
  await dialog.getByRole('textbox', { name: 'Who, by their id' }).fill('auditor');
  await dialog.getByRole('combobox', { name: 'For how long' }).selectOption('7');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  const until = new Date(Date.now() + 7 * 86_400_000);
  await expect(dialog.locator('.rf-share-until')).toContainText(String(until.getDate()));
  await dialog.getByRole('button', { name: 'Done' }).click();
  await item(page, 'Audit').click();
  await expect(
    details(page)
      .getByRole('definition')
      .filter({ hasText: /auditor · Viewer · Until/ }),
  ).toBeVisible();
  const shared = await (await page.request.get('/api/files/shared', { headers: { 'x-user': 'auditor' } })).json();
  expect(shared.entries.map((entry: { name: string }) => entry.name)).toContain('Audit');
});
