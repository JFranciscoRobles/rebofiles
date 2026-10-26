// The same file uploaded again, or another of a name already there: asked
// about in the panel of uploads before it goes.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });
const put = (page: Page, name: string, text: string) => page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name, mimeType: 'text/plain', buffer: Buffer.from(text) }]);

test('the same bytes again are skipped or uploaded anyway; a name taken is replaced as a new version, or both kept', async ({ page }) => {
  await page.goto(`/?as=dup-${Date.now()}`);
  const panel = page.getByRole('region', { name: 'Uploads' });
  await put(page, 'plan.txt', 'first');
  await expect(item(page, 'plan.txt')).toBeVisible();

  await put(page, 'copy.txt', 'first');
  await expect(panel.getByText('Already in the drive, as “plan.txt”')).toBeVisible();
  await panel.getByRole('group', { name: 'What to do with copy.txt' }).getByRole('button', { name: 'Skip' }).click();
  await expect(panel.getByText('Not uploaded')).toBeVisible();
  await expect(item(page, 'copy.txt')).toBeHidden();

  await put(page, 'plan.txt', 'second');
  const asked = panel.getByRole('group', { name: 'What to do with plan.txt' });
  await expect(panel.getByText('There is a “plan.txt” here already')).toBeVisible();
  await asked.getByRole('button', { name: 'Replace' }).click();
  await expect(asked).toBeHidden();
  await item(page, 'plan.txt').click();
  await expect(details(page).getByRole('tab', { name: 'Versions · 2' })).toBeVisible();

  await put(page, 'plan.txt', 'third');
  await panel.getByRole('group', { name: 'What to do with plan.txt' }).getByRole('button', { name: 'Keep both' }).click();
  await expect(item(page, 'plan (2).txt')).toBeVisible();
});
