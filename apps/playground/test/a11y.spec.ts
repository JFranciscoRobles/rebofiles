// axe on every state of the drive a person reaches: what a screen reader is
// told and what a keyboard can get to, checked by the rules of WCAG 2.2 AA.
// Its own person (`?as=axe`), so it starts from a drive of its own.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });

/** What axe finds, said as one line each, so a failure reads as a list of what to fix. */
async function axe(page: Page) {
  // Once what comes in has come: halfway, a toast's text is faded and reads as too faint.
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} · ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe.configure({ mode: 'serial' });

test('the drive, empty and with files, in the list and the grid, with a file selected', async ({ page }) => {
  await page.goto('/?as=axe');
  await expect(page.getByText('This folder is empty.')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);

  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Some notes.') },
    { name: 'budget.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') },
  ]);
  await expect(item(page, 'budget.csv')).toBeVisible();
  await item(page, 'notes.txt').click();
  await expect(details(page).getByText('Some notes.')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Grid' }).click();
  expect.soft(await axe(page)).toEqual([]);
});

test('each dialog', async ({ page }) => {
  await page.goto('/?as=axe');
  await page.getByRole('button', { name: 'Upload' }).click();
  expect.soft(await axe(page)).toEqual([]);
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  expect.soft(await axe(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await item(page, 'notes.txt').click();
  for (const name of ['Rename', 'Move', 'Share']) {
    await details(page).getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect.soft(await axe(page), name).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('the trash, Shared with me, and a search', async ({ page }) => {
  await page.goto('/?as=axe');
  await item(page, 'budget.csv').click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(item(page, 'budget.csv')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Shared with me' }).click();
  expect.soft(await axe(page)).toEqual([]);
  await page.getByRole('searchbox').fill('notes');
  await expect(item(page, 'notes.txt')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
});

test('in Spanish, at the width of a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/?as=axe&lang=es');
  await expect(item(page, 'notes.txt')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
});

test('dark: the list, the grid, a file selected, and sharing it', async ({ page }) => {
  await page.goto('/?as=axe&theme=dark');
  await item(page, 'notes.txt').click();
  await expect(details(page).getByText('Some notes.')).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Grid' }).click();
  expect.soft(await axe(page)).toEqual([]);
  await details(page).getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('bea');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Role · bea' })).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
});

test('dark, as the system is', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/?as=axe&theme=auto');
  await expect(item(page, 'notes.txt')).toBeVisible();
  expect(await page.locator('.rf-drive').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(31, 30, 28)');
  expect.soft(await axe(page)).toEqual([]);
  await context.close();
});

test('a link, opened signed out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?as=axe-link');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'linked.txt', mimeType: 'text/plain', buffer: Buffer.from('Through a link.') }]);
  await item(page, 'linked.txt').click();
  await details(page).getByRole('button', { name: 'Share' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Create a link/ })
    .click();
  await expect(page.getByRole('status')).toHaveText('Link copied');
  const address = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(address);
  await expect(page.getByRole('button', { name: 'linked.txt', exact: true })).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
  await page.goto(`${address}&theme=dark`);
  await expect(page.getByRole('button', { name: 'linked.txt', exact: true })).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);
});
