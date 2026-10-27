// The documents' demo as a person goes through it: a document made with
// Upload → New document, written in Rebodocs' editor and saved, then read in the
// viewer and opened again to write; New → New document; two people writing in
// one document at once; and a document downloaded as a PDF.

import { type Browser, type Page, expect, test } from '@playwright/test';
import { DOCUMENTS } from '../../../playwright.config';

/** An empty Word document, from New document of the Upload menu. */
const newDocument = async (page: Page) => {
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New document' }).click();
};
const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a document made, written in the editor, saved, read in the viewer and opened again', async ({ page }) => {
  await page.goto(`${DOCUMENTS}/?as=writer`);
  await newDocument(page);
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

/** A document `owner` makes from the API, shared with `editor` as an editor: its id. */
async function sharedDocument(page: Page, owner: string, editor: string, name: string) {
  await page.goto(`${DOCUMENTS}/?as=${owner}`);
  await newDocument(page);
  await page.getByRole('dialog', { name: 'New document' }).getByRole('textbox').fill(name);
  await page.getByRole('dialog', { name: 'New document' }).getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: `${name}.docx` })
      .locator('.dx-page')
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to the drive' }).click();
  const listed = await (await page.request.get(`${DOCUMENTS}/api/files/entries`, { headers: { 'x-user': owner } })).json();
  const id = listed.entries.find((entry: { name: string }) => entry.name === `${name}.docx`).id as string;
  await page.request.post(`${DOCUMENTS}/api/files/entries/${id}/shares`, { headers: { 'x-user': owner }, data: { with: editor, role: 'editor' } });
  return id;
}

async function openAs(browser: Browser, who: string, name: string, from: 'files' | 'shared') {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${DOCUMENTS}/?as=${who}`);
  if (from === 'shared') await page.getByRole('button', { name: /Shared with me/ }).click();
  await item(page, name).dblclick();
  await page
    .getByRole('dialog', { name: new RegExp(name.replace('.', '\\.')) })
    .getByRole('button', { name: 'Open in Rebodocs' })
    .click();
  const editor = page.getByRole('dialog', { name });
  await expect(editor.locator('.dx-page').first()).toBeVisible();
  return { page, editor };
}

test('two people write in one document at once, each seeing what the other writes', async ({ page, browser }) => {
  test.setTimeout(60_000);
  await sharedDocument(page, 'ana', 'bea', 'Minutes');
  const ana = await openAs(browser, 'ana', 'Minutes.docx', 'files');
  const bea = await openAs(browser, 'bea', 'Minutes.docx', 'shared');
  // The sheet the editor writes on is over its pages: clicked where the page is.
  await ana.editor.locator('.dx-page').first().click({ force: true });
  await ana.page.keyboard.type('Ana was here.');
  await expect(bea.editor.locator('.dx-page').first()).toContainText('Ana was here.', { timeout: 15_000 });
  await bea.editor.locator('.dx-page').first().click({ force: true });
  await bea.page.keyboard.press('ControlOrMeta+End');
  await bea.page.keyboard.type(' Bea too.');
  await expect(ana.editor.locator('.dx-page').first()).toContainText('Bea too.', { timeout: 15_000 });
  await ana.page.context().close();
  await bea.page.context().close();
});

test('a document downloaded as a PDF, from the editor and from the viewer', async ({ page }) => {
  await page.goto(`${DOCUMENTS}/?as=printer`);
  await newDocument(page);
  await page.getByRole('dialog', { name: 'New document' }).getByRole('textbox').fill('Invoice');
  await page.getByRole('dialog', { name: 'New document' }).getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Invoice.docx' });
  await editor.locator('.dx-page').first().click();
  await page.keyboard.type('Total due: 100.');
  const fromEditor = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Download as PDF' }).click();
  expect((await fromEditor).suggestedFilename()).toBe('Invoice.pdf');
  await editor.locator('.dx-page').first().click();
  await page.keyboard.press('ControlOrMeta+s');
  await expect(editor.getByText('Saved as a new version')).toBeVisible();
  await editor.getByRole('button', { name: 'Back to the drive' }).click();

  await item(page, 'Invoice.docx').dblclick();
  const viewer = page.getByRole('dialog', { name: /Invoice/ });
  await expect(viewer.locator('.dx-page').first()).toContainText('Total due');
  const fromViewer = page.waitForEvent('download');
  await viewer.getByRole('button', { name: 'Download as PDF' }).click();
  const pdf = await fromViewer;
  expect(pdf.suggestedFilename()).toBe('Invoice.pdf');
  const bytes = await (await import('node:fs/promises')).readFile((await pdf.path())!);
  expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-');
});

test('two versions of a document compared, from its history, what changed between them shown', async ({ page }) => {
  await page.goto(`${DOCUMENTS}/?as=compare`);
  await newDocument(page);
  await page.getByRole('dialog', { name: 'New document' }).getByRole('textbox').fill('Terms');
  await page.getByRole('dialog', { name: 'New document' }).getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Terms.docx' });
  await editor.locator('.dx-page').first().click();
  await page.keyboard.type('Payment within thirty days.');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(editor.getByText('Saved as a new version')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' Late payment adds a fee.');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(async () => (await (await page.request.get(`${DOCUMENTS}/api/files/entries`, { headers: { 'x-user': 'compare' } })).json()).entries[0].versions.length).toBe(3);
  await editor.getByRole('button', { name: 'Back to the drive' }).click();

  await item(page, 'Terms.docx').click();
  const details = page.getByRole('complementary', { name: 'Details' });
  await details.getByRole('tab', { name: /Versions/ }).click();
  await details.getByRole('button', { name: 'Compare · Version 2' }).click();
  const viewer = page.getByRole('dialog', { name: /Terms/ });
  await expect(viewer.locator('.dx-vv')).toBeVisible();
  await expect(viewer.locator('.dx-vv-count')).toBeVisible();
  await expect(viewer.locator('.dx-page').first()).toContainText('Late payment adds a fee.');
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
});

test('a request for files opened here, a file sent through it; and each change told to the webhook, checked', async ({ page, browser }) => {
  const as = { headers: { 'x-user': 'hooks' } };
  const folder = (await (await page.request.post(`${DOCUMENTS}/api/files/folders`, { ...as, data: { name: 'Signed contracts', parent: null } })).json()).entry;
  const { token } = await (await page.request.post(`${DOCUMENTS}/api/files/entries/${folder.id}/links`, { ...as, data: { days: 7, uploads: 'only' } })).json();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`${DOCUMENTS}/?link=${encodeURIComponent(token)}`);
  await expect(guest.getByRole('heading', { name: 'hooks asks you for files' })).toBeVisible();
  await guest.getByRole('textbox', { name: /Your name/ }).fill('Northwind');
  await guest.locator('.rf-send-file').setInputFiles([{ name: 'signed.txt', mimeType: 'text/plain', buffer: Buffer.from('signed by both') }]);
  await expect(guest.getByText('Sent', { exact: true })).toBeVisible();
  await guest.context().close();

  await page.goto(`${DOCUMENTS}/?as=hooks&view=list`);
  await item(page, 'Signed contracts').dblclick();
  await expect(item(page, 'signed.txt')).toBeVisible();
  // The demo is the service its webhook tells: each delivery checked by its signature, and kept.
  await expect
    .poll(async () => ((await (await page.request.get(`${DOCUMENTS}/api/hooks`)).json()).told as { action: string; entry: { name: string } | null }[]).map((one) => `${one.action} ${one.entry?.name}`))
    .toEqual(expect.arrayContaining(['created Signed contracts', 'linked Signed contracts', 'uploaded signed.txt']));
  const forged = await page.request.post(`${DOCUMENTS}/api/hooks`, {
    data: { action: 'deleted' },
    headers: { 'x-rebofiles-timestamp': String(Math.floor(Date.now() / 1000)), 'x-rebofiles-signature': 'sha256=00' },
  });
  expect(forged.status()).toBe(401);
});
