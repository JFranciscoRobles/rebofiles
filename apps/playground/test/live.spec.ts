// What others change, shown as it happens, without asking the page to load
// again; and a folder of many, of which only what is in sight is in the page,
// gone through with the keyboard as one of a few.

import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a folder made in one window is there in the other, and its new name too', async ({ browser }) => {
  const oneContext = await browser.newContext();
  const one = await oneContext.newPage();
  const twoContext = await browser.newContext();
  const two = await twoContext.newPage();
  await one.goto('/?as=live');
  await two.goto('/?as=live');
  await expect(one.getByText('This folder is empty.')).toBeVisible();
  await expect(two.getByText('This folder is empty.')).toBeVisible();

  await one.getByRole('button', { name: 'Upload' }).click();
  await one.getByRole('menuitem', { name: 'New folder' }).click();
  await one.getByRole('textbox', { name: 'Folder name' }).fill('Arrived live');
  await one.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(item(two, 'Arrived live')).toBeVisible({ timeout: 5000 });

  await item(one, 'Arrived live').click();
  await one.keyboard.press('F2');
  const rename = one.getByRole('dialog', { name: 'Rename' });
  await rename.getByRole('textbox').fill('Renamed live');
  await rename.getByRole('button', { name: 'Save' }).click();
  await expect(item(two, 'Renamed live')).toBeVisible({ timeout: 5000 });
  await expect(item(two, 'Arrived live')).toBeHidden();
  // Each window watching holds a connection: let go of, for the tests after.
  await oneContext.close();
  await twoContext.close();
});

test('a folder of four hundred: only what is in sight is in the page, the keyboard goes through all', async ({ page }) => {
  const who = { 'x-user': 'many', 'content-type': 'application/json' };
  const many = await (await page.request.post('/api/files/folders', { headers: who, data: { name: 'Many', parent: null } })).json();
  for (let n = 1; n <= 400; n++) await page.request.post('/api/files/folders', { headers: who, data: { name: `Folder ${String(n).padStart(3, '0')}`, parent: many.entry.id } });

  await page.goto('/?as=many');
  await item(page, 'Many').dblclick();
  await expect(item(page, 'Folder 001')).toBeVisible();
  const options = page.getByRole('listbox').getByRole('option');
  expect(await options.count()).toBeLessThan(80);
  await expect(options.first()).toHaveAttribute('aria-setsize', '400');

  await item(page, 'Folder 001').click();
  await page.keyboard.press('End');
  await expect(item(page, 'Folder 400')).toBeVisible();
  await expect(item(page, 'Folder 400')).toHaveAttribute('aria-posinset', '400');
  await expect(item(page, 'Folder 001')).toHaveCount(0);
  expect(await options.count()).toBeLessThan(80);
  // The current one is the one a screen reader is told of: in the page.
  const current = await page.getByRole('listbox').getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${current}"]`)).toHaveAttribute('aria-posinset', '400');

  await page.keyboard.press('Home');
  await expect(item(page, 'Folder 001')).toBeVisible();
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
  await expect(item(page, 'Folder 031')).toBeVisible();

  // Scrolled by hand to the middle: what is there comes.
  await page.getByRole('listbox').evaluate((box) => (box.scrollTop = box.scrollHeight / 2 - box.clientHeight / 2));
  await expect(item(page, 'Folder 200')).toBeVisible();

  // And in the grid, rows of cards.
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.getByRole('listbox').focus();
  await page.keyboard.press('End');
  await expect(item(page, 'Folder 400')).toBeVisible();
  expect(await options.count()).toBeLessThan(120);
  // Everything, picked with the keyboard, is all four hundred, not only those in the page.
  await page.getByRole('listbox').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.getByRole('heading', { name: '400 selected' })).toBeVisible();
});
