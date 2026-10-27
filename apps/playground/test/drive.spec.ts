// The drive in Chrome, as a person goes through it: what the walk by hand of
// the roadmap did, kept. Each test goes on from the drive the one before left.

import { type Page, expect, test } from '@playwright/test';

const PART = 8 * 1024 * 1024;

// A row is read with its owner, date and size after its name: found by what it starts with.
const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });
const upload = (page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) => page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(files);

test.describe.configure({ mode: 'serial' });

test('makes a folder and uploads into it, a large file in parts among them', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('This folder is empty.')).toBeVisible();

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Clients');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await item(page, 'Clients').dblclick();
  await expect(page.getByRole('button', { name: 'Clients', exact: true })).toHaveAttribute('aria-current', 'page');

  await upload(page, [
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Call Acme on Monday.') },
    { name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(PART + 1000, 7) },
  ]);
  await expect(item(page, 'notes.txt')).toBeVisible();
  await expect(item(page, 'video.mp4')).toBeVisible({ timeout: 20_000 });

  await item(page, 'notes.txt').click();
  await expect(details(page).getByText('Call Acme on Monday.')).toBeVisible();
});

test('keeps both files, when asked, when one comes with a name already taken', async ({ page }) => {
  await page.goto('/');
  await item(page, 'Clients').dblclick();
  await upload(page, [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('A second one.') }]);
  // Asked first, as there is one of that name here.
  await page.getByRole('region', { name: 'Uploads' }).getByRole('button', { name: 'Keep both' }).click();
  await expect(item(page, 'notes (2).txt')).toBeVisible();
});

test('renames with F2, and goes through the trash with Delete and back', async ({ page }) => {
  await page.goto('/');
  await item(page, 'Clients').dblclick();
  await item(page, 'notes (2).txt').click();
  await page.keyboard.press('F2');
  const name = page.getByRole('textbox', { name: 'New name' });
  await name.fill('minutes.txt');
  await name.press('Enter');
  await expect(item(page, 'minutes.txt')).toBeVisible();

  await item(page, 'minutes.txt').click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('moved to the trash');
  await expect(item(page, 'minutes.txt')).toBeHidden();

  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await item(page, 'minutes.txt').click();
  await details(page).getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('The trash is empty.')).toBeVisible();
});

test('finds a file by name, whatever its case', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('MINUTES');
  await expect(item(page, 'minutes.txt')).toBeVisible();
});

test('moves a file from the dialog', async ({ page }) => {
  await page.goto('/');
  await item(page, 'Clients').dblclick();
  await item(page, 'video.mp4').click();
  await details(page).getByRole('button', { name: 'Move', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('My files').click();
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(item(page, 'video.mp4')).toBeHidden();
  await page.getByRole('button', { name: 'My files' }).first().click();
  await expect(item(page, 'video.mp4')).toBeVisible();
});

test('deletes for good from the trash', async ({ page }) => {
  await page.goto('/');
  await item(page, 'video.mp4').click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await page.getByRole('button', { name: 'Empty trash' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Empty trash' }).click();
  await expect(page.getByText('The trash is empty.')).toBeVisible();
});

test('is in Spanish at the width of a phone, without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/?lang=es');
  await expect(page.getByRole('button', { name: 'Mis archivos' }).first()).toBeVisible();
  await expect(item(page, 'Clients')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
