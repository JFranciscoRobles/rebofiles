// Several files and a folder downloaded as one .zip made in the page: what is
// in it, at its paths, every byte as it was.

import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('picked files and a folder go in one .zip, the folder with what is in it', async ({ page }) => {
  await page.goto('/?as=zipper');
  const photo = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 13) % 256));
  await page.locator('input[type=file]').setInputFiles([
    { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Visita\n'.repeat(300)) },
    { name: 'photo.bin', mimeType: 'application/octet-stream', buffer: photo },
  ]);
  await expect(item(page, 'photo.bin')).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Contratos');
  await page.getByRole('button', { name: 'Create' }).click();
  await item(page, 'Contratos').dblclick();
  await page.locator('input[type=file]').setInputFiles({ name: 'año.txt', mimeType: 'text/plain', buffer: Buffer.from('dentro') });
  await expect(item(page, 'año.txt')).toBeVisible();
  await page.getByRole('button', { name: 'My files' }).first().click();

  await item(page, 'Contratos').click();
  await item(page, 'notes.md').click({ modifiers: ['ControlOrMeta'] });
  await item(page, 'photo.bin').click({ modifiers: ['ControlOrMeta'] });
  const saving = page.waitForEvent('download');
  await page.getByRole('toolbar', { name: '3 selected' }).getByRole('button', { name: 'Download as .zip' }).click();
  const download = await saving;
  expect(download.suggestedFilename()).toMatch(/^Files \d{4}-\d{2}-\d{2}\.zip$/);
  const read = unzipSync(new Uint8Array(readFileSync((await download.path())!)));
  expect(Object.keys(read).sort()).toEqual(['Contratos/', 'Contratos/año.txt', 'notes.md', 'photo.bin']);
  expect(new TextDecoder().decode(read['notes.md'])).toBe('# Visita\n'.repeat(300));
  expect(Buffer.from(read['photo.bin']).equals(photo)).toBe(true);
  await expect(page.getByText(/^Downloaded Files .*\.zip$/)).toBeVisible();

  // A folder alone, from its details.
  await item(page, 'Contratos').click();
  const folderSaving = page.waitForEvent('download');
  await page.getByRole('complementary', { name: 'Details' }).getByRole('button', { name: 'Download as .zip' }).click();
  const folderZip = await folderSaving;
  expect(folderZip.suggestedFilename()).toBe('Contratos.zip');
  expect(Object.keys(unzipSync(new Uint8Array(readFileSync((await folderZip.path())!)))).sort()).toEqual(['Contratos/', 'Contratos/año.txt']);
});
