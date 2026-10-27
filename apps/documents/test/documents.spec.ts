// The documents' demo as a person goes through it: a document made with
// "Create document", written in Rebodocs' editor and saved, then read in the
// viewer and opened again to write; and New → New document.

import { type Page, expect, test } from '@playwright/test';
import { DOCUMENTS } from '../../../playwright.config';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a document made, written in the editor, saved, read in the viewer and opened again', async ({ page }) => {
  await page.goto(`${DOCUMENTS}/?as=writer`);
  await page.getByRole('button', { name: 'Create document' }).click();
  const naming = page.getByRole('dialog', { name: 'New document' });
  await expect(naming.getByRole('textbox')).toHaveValue('Untitled document');
  await naming.getByRole('textbox').fill('Contract');
  await naming.getByRole('button', { name: 'Create', exact: true }).click();

  // Made in the folder one is in, and open in the editor at once.
  const editor = page.getByRole('dialog', { name: 'Contract.docx' });
  await expect(editor.locator('.dx-page').first()).toBeVisible();
  await editor.locator('.dx-page').first().click();
  await page.keyboard.type('Signed by both parties.');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(editor.getByText('Saved as a new version')).toBeVisible();
  await editor.getByRole('button', { name: 'Back to the drive' }).click();
  await expect(editor).toHaveCount(0);

  // Read in the viewer, in its pages and with Rebodocs' bar, what was written.
  await item(page, 'Contract.docx').dblclick();
  const viewer = page.getByRole('dialog', { name: /Contract/ });
  await expect(viewer.locator('.dx-viewer-bar')).toBeVisible();
  await expect(viewer.locator('.dx-page').first()).toContainText('Signed by both parties.');
  await viewer.getByRole('button', { name: 'Open in Rebodocs' }).click();
  await expect(page.getByRole('dialog', { name: 'Contract.docx' }).locator('.dx-page').first()).toContainText('Signed by both parties.');
});

test('New has New document, in Spanish too', async ({ page }) => {
  await page.goto(`${DOCUMENTS}/?as=menu&lang=es`);
  await page.locator('.rf-new').click();
  await page.getByRole('menuitem', { name: 'Documento nuevo' }).click();
  const naming = page.getByRole('dialog', { name: 'Documento nuevo' });
  await expect(naming.getByRole('textbox')).toHaveValue('Documento sin título');
  await naming.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByRole('dialog', { name: 'Documento sin título.docx' }).locator('.dx-page').first()).toBeVisible();
  await page.getByRole('button', { name: 'Volver al drive' }).click();
  await expect(item(page, 'Documento sin título.docx')).toBeVisible();
});
