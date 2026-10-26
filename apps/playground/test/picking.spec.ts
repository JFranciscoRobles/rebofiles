// Several picked at once, with the mouse and with the keyboard, and what is
// done to all of them: moved, put in the trash, restored, deleted for good.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const bar = (page: Page) => page.getByRole('toolbar', { name: /selected$/ });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} · ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('picked with ⌘ and Shift, moved together into a folder, and put in the trash together', async ({ page }) => {
  await page.goto('/?as=picker');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(['a', 'b', 'c', 'd'].map((n) => ({ name: `${n}.txt`, mimeType: 'text/plain', buffer: Buffer.from(n) })));
  for (const n of ['a', 'b', 'c', 'd']) await expect(item(page, `${n}.txt`)).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Archive');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(item(page, 'Archive')).toBeVisible();

  await item(page, 'a.txt').click();
  await item(page, 'c.txt').click({ modifiers: ['ControlOrMeta'] });
  await expect(bar(page)).toContainText('2 selected');
  await item(page, 'd.txt').click({ modifiers: ['Shift'] });
  await expect(bar(page)).toContainText('2 selected');
  await expect(item(page, 'c.txt')).toHaveAttribute('aria-selected', 'true');
  await expect(item(page, 'd.txt')).toHaveAttribute('aria-selected', 'true');
  await item(page, 'a.txt').click({ modifiers: ['ControlOrMeta'] });
  await expect(bar(page)).toContainText('3 selected');
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText('3 selected');
  expect.soft(await axe(page)).toEqual([]);

  await bar(page).getByRole('button', { name: 'Move', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Move 3 items to…' });
  await dialog.getByRole('button', { name: 'Archive' }).click();
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText('Moved 3 items')).toBeVisible();
  await expect(item(page, 'b.txt')).toBeVisible();
  await expect(item(page, 'a.txt')).toHaveCount(0);

  await item(page, 'Archive').dblclick();
  await expect(item(page, 'd.txt')).toBeVisible();
  await item(page, 'a.txt').click();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(bar(page)).toContainText('3 selected');
  await bar(page).getByRole('button', { name: 'Move to trash' }).click();
  await expect(page.getByText('Moved 3 items to the trash')).toBeVisible();
  await expect(page.getByText('This folder is empty.')).toBeVisible();
});

test('picked with the keyboard, restored together, and deleted for good together', async ({ page }) => {
  await page.goto('/?as=picker2');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(['one', 'two', 'three'].map((n) => ({ name: `${n}.md`, mimeType: 'text/markdown', buffer: Buffer.from(`# ${n}`) })));
  for (const n of ['one', 'two', 'three']) await expect(item(page, `${n}.md`)).toBeVisible();
  await item(page, 'one.md').click();
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(bar(page)).toContainText('3 selected');
  await page.keyboard.press('Delete');
  await expect(page.getByText('Moved 3 items to the trash')).toBeVisible();

  await page.getByRole('button', { name: 'Trash' }).click();
  // The trash lists the last thrown first.
  const first = page.getByRole('listbox').getByRole('option').first();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
  const firstName = ((await first.textContent()) ?? '').replace(/picker2.*/, '');
  await first.click();
  // ⌘ or Ctrl with the arrows only moves; Space picks.
  await page.keyboard.press('ControlOrMeta+ArrowDown');
  await page.keyboard.press('Space');
  await expect(bar(page)).toContainText('2 selected');
  await bar(page).getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Restored 2 items')).toBeVisible();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  expect(firstName).toMatch(/\.md$/);

  await page.getByRole('button', { name: 'My files' }).first().click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await page.getByRole('listbox').getByRole('option').first().click();
  await page
    .getByRole('option')
    .last()
    .click({ modifiers: ['Shift'] });
  await bar(page).getByRole('button', { name: 'Move to trash' }).click();
  await expect(page.getByText('Moved 2 items to the trash')).toBeVisible();
  await page.getByRole('button', { name: 'Trash' }).click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
  await page.getByRole('listbox').getByRole('option').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(bar(page)).toContainText('3 selected');
  await bar(page).getByRole('button', { name: 'Delete forever' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByText('Deleted 3 items')).toBeVisible();
  await expect(page.getByText('The trash is empty.')).toBeVisible();
});
