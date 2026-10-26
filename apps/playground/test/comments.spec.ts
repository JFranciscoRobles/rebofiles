// Comments in the details of a file, as two people say them; and a legal hold,
// put by who may configure the drive, keeping it from the trash.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test('a comment, a reply under it, one’s own changed, the thread resolved, and seen by the other', async ({ browser }) => {
  const who = `say-${Date.now()}`;
  const anaContext = await browser.newContext();
  const ana = await anaContext.newPage();
  await ana.goto(`/?as=${who}`);
  await ana.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('the plan') }]);
  // The panel of uploads, over the corner where the box of comments is: gone with the page loaded again.
  await expect(item(ana, 'plan.txt')).toBeVisible();
  await expect(ana.getByRole('region', { name: 'Uploads' }).getByRole('button', { name: 'Close' })).toBeVisible();
  await ana.reload();
  await item(ana, 'plan.txt').click();
  await details(ana).getByRole('tab', { name: 'Comments' }).click();
  await expect(details(ana).getByText('No comments yet.')).toBeVisible();
  const box = details(ana).getByRole('textbox', { name: 'Add a comment' });
  await box.fill('Is this the last one?');
  await box.press('ControlOrMeta+Enter');
  const list = details(ana).getByRole('list', { name: 'Comments' });
  await expect(list.getByRole('listitem')).toHaveCount(1);

  await list.getByRole('button', { name: `Reply · ${who}` }).click();
  await details(ana)
    .getByRole('textbox', { name: `Reply to ${who}` })
    .fill('Yes, it is.');
  await details(ana).getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').nth(1)).toHaveClass(/rf-reply/);

  await list.getByRole('listitem').first().getByRole('button', { name: 'Edit' }).click();
  await details(ana).getByRole('textbox', { name: 'Edit' }).fill('Is this the final one?');
  await details(ana).getByRole('button', { name: 'Save' }).click();
  await expect(list.getByRole('listitem').first()).toContainText('Is this the final one?');
  await expect(list.getByRole('listitem').first()).toContainText('edited');
  await list.getByRole('listitem').first().getByRole('button', { name: 'Resolve' }).click();
  await expect(list.getByRole('listitem').first()).toContainText(`Resolved by ${who}`);
  const { violations } = await new AxeBuilder({ page: ana }).include('.rf-details').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  // In the same person's other window, as it happens.
  const againContext = await browser.newContext();
  const again = await againContext.newPage();
  await again.goto(`/?as=${who}`);
  await item(again, 'plan.txt').click();
  await details(again).getByRole('tab', { name: 'Comments' }).click();
  await expect(details(again).getByRole('list', { name: 'Comments' }).getByRole('listitem')).toHaveCount(2);
  await box.fill('One more.');
  await box.press('ControlOrMeta+Enter');
  await expect(details(again).getByRole('list', { name: 'Comments' }).getByRole('listitem')).toHaveCount(3, { timeout: 5000 });
  // Each window watching holds a connection: let go of, for the tests after.
  await anaContext.close();
  await againContext.close();
});

test('a legal hold keeps a folder from the trash until it is released', async ({ page }) => {
  // The one of this machine, who may configure the playground's drive.
  const name = `Case ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await item(page, name).click();
  await details(page).getByRole('button', { name: 'Put on hold' }).click();
  await expect(details(page).getByText('On hold', { exact: true })).toBeVisible();
  await details(page).getByRole('button', { name: 'Move to trash' }).click();
  await expect(page.getByText(/is on hold/).first()).toBeVisible();
  await expect(item(page, name)).toBeVisible();
  // A change that fails leaves nothing picked, as one that is done does.
  await item(page, name).click();
  await details(page).getByRole('button', { name: 'Release the hold' }).click();
  await expect(details(page).getByText('On hold', { exact: true })).toBeHidden();
  await details(page).getByRole('button', { name: 'Move to trash' }).click();
  await expect(item(page, name)).toBeHidden();
  // Gone for good: the drive of this machine is the other tests' too, and its trash is to be empty for them.
  const found = (await (await page.request.get(`/api/files/search?q=${encodeURIComponent(name)}&trashed=1`)).json()).entries as { id: string }[];
  for (const entry of found) expect((await page.request.delete(`/api/files/entries/${entry.id}`)).ok()).toBe(true);
});
