// Several files and a folder downloaded as one .zip made in the page: what is
// in it, at its paths, every byte as it was.

import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('picked files and a folder go in one .zip, the folder with what is in it', async ({ page }) => {
  await page.goto('/?as=zipper');
  const photo = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 13) % 256));
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Visita\n'.repeat(300)) },
    { name: 'photo.bin', mimeType: 'application/octet-stream', buffer: photo },
  ]);
  await expect(item(page, 'photo.bin')).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Contratos');
  await page.getByRole('button', { name: 'Create' }).click();
  await item(page, 'Contratos').dblclick();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles({ name: 'año.txt', mimeType: 'text/plain', buffer: Buffer.from('dentro') });
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

test('a link to a folder downloads it whole as a .zip, without signing in', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?as=linkzip');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Expediente');
  await page.getByRole('button', { name: 'Create' }).click();
  await item(page, 'Expediente').dblclick();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'acta.txt', mimeType: 'text/plain', buffer: Buffer.from('Acta de entrega.') },
    { name: 'plano.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(2048, 7) },
  ]);
  await expect(item(page, 'plano.bin')).toBeVisible();
  await page.getByRole('button', { name: 'My files' }).first().click();
  await item(page, 'Expediente').click();
  await page.getByRole('complementary', { name: 'Details' }).getByRole('button', { name: 'Share' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create link' }).click();
  await expect(page.getByRole('status')).toHaveText('Link copied');
  const address = await page.evaluate(() => navigator.clipboard.readText());

  // Someone with the link, in a window of their own, signed in as no one.
  const someone = await (await context.browser()!.newContext()).newPage();
  await someone.goto(address);
  const saving = someone.waitForEvent('download');
  await someone.getByRole('button', { name: 'Download as .zip', exact: true }).click();
  const zip = await saving;
  expect(zip.suggestedFilename()).toBe('Expediente.zip');
  const read = unzipSync(new Uint8Array(readFileSync((await zip.path())!)));
  expect(Object.keys(read).sort()).toEqual(['Expediente/', 'Expediente/acta.txt', 'Expediente/plano.bin']);
  expect(new TextDecoder().decode(read['Expediente/acta.txt'])).toBe('Acta de entrega.');
  await someone.close();
});

test('a file that could not be read is left out, said, and downloaded on its own after', async ({ page }) => {
  await page.goto('/?as=zipmiss');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'one.txt', mimeType: 'text/plain', buffer: Buffer.from('one') },
    { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from('two') },
  ]);
  await expect(item(page, 'two.txt')).toBeVisible();
  // The first file read for the archive fails, as a cut connection would.
  let failed = false;
  await page.route('**/api/files/bytes?**', (route) => {
    if (!failed && route.request().method() === 'GET') {
      failed = true;
      return route.abort('connectionreset');
    }
    return route.continue();
  });
  await item(page, 'one.txt').click();
  await item(page, 'two.txt').click({ modifiers: ['Shift'] });
  const first = page.waitForEvent('download');
  await page.getByRole('toolbar', { name: '2 selected' }).getByRole('button', { name: 'Download as .zip' }).click();
  expect(Object.keys(unzipSync(new Uint8Array(readFileSync((await (await first).path())!))))).toHaveLength(1);
  await expect(page.getByRole('status')).toContainText('1 files could not be read');
  const rest = page.waitForEvent('download');
  // By the keyboard: right after a download, Playwright takes the page for one still moving, though nothing in it does.
  await page.getByRole('status').getByRole('button', { name: 'Download those' }).press('Enter');
  const again = await rest;
  expect(again.suggestedFilename()).toMatch(/\(the rest\)\.zip$/);
  expect(Object.keys(unzipSync(new Uint8Array(readFileSync((await again.path())!))))).toEqual(['one.txt']);
});
