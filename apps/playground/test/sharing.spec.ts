// Sharing in Chrome, with two people: Ana, and Bea, who the playground is as
// `?as=bea`. And a link, opened by someone who is neither.

import { type Page, expect, test } from '@playwright/test';

// A row is read with its owner, date and size after its name: found by what it starts with.
const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

test.describe.configure({ mode: 'serial' });

test('Ana shares a folder with Bea as an editor, and Bea finds it and puts a file in it', async ({ page }) => {
  await page.goto('/?as=ana');
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Team');
  await page.getByRole('button', { name: 'Create' }).click();

  await item(page, 'Team').click();
  await details(page).getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share “Team”' });
  await dialog.getByRole('textbox', { name: 'Who, by their id' }).fill('bea');
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).selectOption('editor');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Role · bea' })).toHaveValue('editor');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(details(page).getByText('bea · Editor')).toBeVisible();

  await page.goto('/?as=bea');
  await expect(item(page, 'Team')).toBeHidden();
  await page.getByRole('button', { name: 'Shared with me' }).click();
  await item(page, 'Team').dblclick();
  // The crumb leads back to where it was found.
  await expect(page.getByRole('button', { name: 'Shared with me' }).last()).toBeVisible();
  await page.locator('input[type=file]').setInputFiles([{ name: 'from-bea.txt', mimeType: 'text/plain', buffer: Buffer.from('Hello, Ana.') }]);
  await expect(item(page, 'from-bea.txt')).toBeVisible();

  await page.goto('/?as=ana');
  await item(page, 'Team').dblclick();
  await expect(item(page, 'from-bea.txt')).toBeVisible();
});

test('a link reads the folder without signing in, until it is taken back', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?as=ana');
  await item(page, 'Team').click();
  await details(page).getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share “Team”' });
  await dialog.getByRole('button', { name: 'Create a link for 7 days' }).click();
  await expect(page.getByRole('status')).toHaveText('Link copied');
  const address = await page.evaluate(() => navigator.clipboard.readText());
  expect(address).toMatch(/\?link=/);

  const someone = await context.browser()!.newPage();
  await someone.goto(address);
  await expect(someone.getByRole('button', { name: 'Team', exact: true })).toBeVisible();
  await expect(someone.getByRole('button', { name: 'from-bea.txt', exact: true })).toBeVisible();
  await expect(someone.getByRole('button', { name: 'Download · from-bea.txt' })).toBeVisible();

  await dialog.getByRole('button', { name: /^Remove · Until/ }).click();
  await expect(dialog.getByText('No links.')).toBeVisible();
  await someone.reload();
  await expect(someone.getByRole('alert')).toHaveText('This link does not work any more.');
  await someone.close();
});
