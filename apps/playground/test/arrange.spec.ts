// The list put in order by a column or a choice, one kind of file shown; the
// menu of an entry, by the mouse and by the keyboard; and a change undone.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const names = (page: Page) =>
  page
    .getByRole('listbox')
    .getByRole('option')
    .evaluateAll((all) => all.map((one) => one.querySelector('.rf-name span:last-child')?.textContent));

async function some(page: Page, who: string) {
  await page.goto(`/?as=${who}`);
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'b-medium.txt', mimeType: 'text/plain', buffer: Buffer.alloc(3000, 97) },
    { name: 'a-small.txt', mimeType: 'text/plain', buffer: Buffer.alloc(10, 97) },
    { name: 'c-large.png', mimeType: 'image/png', buffer: Buffer.alloc(9000, 1) },
  ]);
  await expect(item(page, 'c-large.png')).toBeVisible();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
}

test('in order by a column, the other way at a second click, kept for the next visit; and one kind alone', async ({ page }) => {
  await some(page, 'order');
  expect(await names(page)).toEqual(['a-small.txt', 'b-medium.txt', 'c-large.png']);
  await page.getByRole('button', { name: 'Order by Size' }).click();
  expect(await names(page)).toEqual(['c-large.png', 'b-medium.txt', 'a-small.txt']);
  await page.getByRole('button', { name: /^Size, in order from the last/ }).click();
  expect(await names(page)).toEqual(['a-small.txt', 'b-medium.txt', 'c-large.png']);
  await page.reload();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Size, in order from the first/ })).toBeVisible();

  await page.getByRole('combobox', { name: 'Kind of file' }).selectOption('image');
  expect(await names(page)).toEqual(['c-large.png']);
  await page.getByRole('combobox', { name: 'Kind of file' }).selectOption('video');
  await expect(page.getByText('Nothing of this kind here.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Kind of file' }).selectOption('all');
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.getByRole('combobox', { name: 'Order' }).selectOption('name:-1');
  expect(
    await page
      .getByRole('listbox')
      .getByRole('option')
      .evaluateAll((all) => all.map((one) => one.querySelector('.rf-name span:last-child')?.textContent)),
  ).toEqual(['c-large.png', 'b-medium.txt', 'a-small.txt']);
  await page.getByRole('combobox', { name: 'Order' }).selectOption('name:1');
  await page.getByRole('button', { name: 'List' }).click();
});

test('the menu of an entry, by the mouse and by the keyboard, and a trash undone and a rename undone', async ({ page }) => {
  await some(page, 'menu');
  await item(page, 'b-medium.txt').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'b-medium.txt' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['Open', 'Download', 'Rename', 'Move', 'Share', 'Add to starred', 'Move to trash']);
  await expect(menu.getByRole('menuitem', { name: 'Open' })).toBeFocused();
  expect.soft((await new AxeBuilder({ page }).include('.rf-ctx').analyze()).violations.map((v) => v.id)).toEqual([]);
  // Up from the first is the last, as round a menu.
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: 'Move to trash' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(item(page, 'b-medium.txt')).toHaveCount(0);
  // The toast says it, and undoes it.
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(item(page, 'b-medium.txt')).toBeVisible();
  await expect(page.getByText('Undone')).toBeVisible();

  // From the keyboard: Shift+F10 on the one the list is on; several picked, the menu is of all of them.
  await item(page, 'a-small.txt').click();
  await item(page, 'c-large.png').click({ modifiers: ['Shift'] });
  await page.keyboard.press('Shift+F10');
  const many = page.getByRole('menu', { name: '3 selected' });
  await expect(many.getByRole('menuitem')).toHaveText(['Download as .zip', 'Move', 'Move to trash']);
  await page.keyboard.press('Escape');
  await expect(many).toHaveCount(0);
  await expect(page.locator('.rf-items')).toBeFocused();

  // A rename, undone with ⌘Z or Ctrl+Z.
  await item(page, 'a-small.txt').click();
  await page.keyboard.press('F2');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('renamed.txt');
  await page.keyboard.press('Enter');
  await expect(item(page, 'renamed.txt')).toBeVisible();
  await page.locator('.rf-items').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(item(page, 'a-small.txt')).toBeVisible();
  await expect(item(page, 'renamed.txt')).toHaveCount(0);
});

test('in order by type, by when made and by colour, and with the folders among the files when asked', async ({ page }) => {
  await some(page, 'kinds');
  for (const [name, colour] of [
    ['Zeta', 'Red'],
    ['Alfa', null],
  ] as const) {
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New folder' }).click();
    await page.getByRole('textbox', { name: 'Folder name' }).fill(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(item(page, name)).toBeVisible();
    if (colour) {
      await item(page, name).click({ button: 'right' });
      await page.getByRole('menu').getByRole('menuitemradio', { name: colour }).click();
    }
  }
  const order = page.getByRole('combobox', { name: 'Order' });
  await order.selectOption('type:1');
  expect(await names(page)).toEqual(['Alfa', 'Zeta', 'c-large.png', 'a-small.txt', 'b-medium.txt']);
  await order.selectOption('color:1');
  expect(await names(page)).toEqual(['Zeta', 'Alfa', 'a-small.txt', 'b-medium.txt', 'c-large.png']);
  // The newest made first: the folders, made after the files.
  await order.selectOption('created:-1');
  expect((await names(page)).slice(0, 2)).toEqual(['Alfa', 'Zeta']);

  await order.selectOption('name:1');
  const mixed = page.getByRole('button', { name: 'Folders first' });
  await expect(mixed).toHaveAttribute('aria-pressed', 'true');
  await mixed.click();
  expect(await names(page)).toEqual(['a-small.txt', 'Alfa', 'b-medium.txt', 'c-large.png', 'Zeta']);
  await page.reload();
  await expect(item(page, 'Zeta')).toBeVisible();
  expect(await names(page)).toEqual(['a-small.txt', 'Alfa', 'b-medium.txt', 'c-large.png', 'Zeta']);
  await page.getByRole('button', { name: 'Folders first' }).click();
});
