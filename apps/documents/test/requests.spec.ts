// A request for files of the documents' demo, with what it does besides:
// started from one of its templates, saved as another and taken out in the
// settings; its QR code; whom it was sent to reminded at once, by a mail the
// demo keeps; what is asked until when it is good, and what came checked
// against the words its document should say; a photo that looks blurry.

import { type Page, expect, test } from '@playwright/test';
import { DOCUMENTS } from '../../../playwright.config';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

/** A PDF of one page that says `text`, written by hand: what a reader of PDFs finds in it is that. */
function pdfSaying(text: string) {
  const content = `BT /F1 18 Tf 20 50 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const table = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** A PNG of one colour: a photo with no edges at all, as blurry as one gets. */
function flatPng() {
  // 1×1, grey, made once by hand.
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC', 'base64');
}

const dayIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('a request from a template, its QR code, a reminder, a date asked, and what came checked', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.request.post(`${DOCUMENTS}/api/files/folders`, { data: { name: 'Clients', parent: null } });
  await page.goto(`${DOCUMENTS}/`);
  await item(page, 'Clients').dblclick();
  await page.getByRole('button', { name: 'Request files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request files for “Clients”' });

  // What it asks, as the template says.
  await dialog.getByRole('combobox', { name: 'Start from a template' }).selectOption({ label: 'Expediente de cliente' });
  await expect(dialog.getByRole('textbox', { name: 'Document 1' })).toHaveValue('Identificación oficial');
  await expect(dialog.getByRole('textbox', { name: 'Document 3' })).toHaveValue('Póliza de seguro');
  await expect(dialog.getByRole('button', { name: 'Every 7 days' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Options of the document · Identificación oficial' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Should say' })).toHaveValue('INE, credencial, pasaporte, electoral');
  await expect(dialog.getByRole('switch', { name: /Ask until when it is good/ })).toBeChecked();
  await dialog.getByRole('textbox', { name: 'For whom' }).fill('Carla Ruiz');
  await dialog.getByRole('textbox', { name: /Their email/ }).fill('carla@northwind.test');
  await dialog.getByRole('button', { name: 'Create link' }).click();

  // Ready: its address, and a QR code of it for a phone, to download.
  const ready = page.getByRole('dialog', { name: 'The link is ready, and copied' });
  const address = await ready.getByRole('textbox', { name: /address/i }).inputValue();
  await expect(ready.getByRole('img', { name: /QR code of the request Carla Ruiz/ }).locator('svg')).toBeVisible();
  const download = page.waitForEvent('download');
  await ready.getByRole('button', { name: 'Download QR' }).click();
  expect((await download).suggestedFilename()).toBe('QR - Carla Ruiz.png');

  // Reminded at once, by a mail the demo keeps instead of sending.
  await ready.getByRole('button', { name: 'Remind now · Carla Ruiz' }).click();
  await expect(page.getByText('Reminder sent to carla@northwind.test')).toBeVisible();
  const mails = (await (await page.request.get(`${DOCUMENTS}/api/outbox`)).json()).mails as { to: string; subject: string; text: string }[];
  expect(mails[0]).toMatchObject({ to: 'carla@northwind.test', subject: 'Reminder: Carla Ruiz' });
  expect(mails[0].text).toContain('Acme is still waiting for these documents:\n- Identificación oficial\n- Comprobante de domicilio\n- Póliza de seguro');
  await expect(ready.getByText(/reminded/)).toBeVisible();
  await ready.getByRole('button', { name: 'Done' }).click();

  // Sent signed out: a date for what expires, a photo that looks blurry, a document that does not say what it should.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(address);
  await guest.getByRole('textbox', { name: 'Your name (needed)' }).fill('Carla');
  const docs = guest.getByRole('list', { name: 'Documents asked of you' }).locator(':scope > li');
  await expect(docs.nth(1).getByLabel('Expires on')).toHaveCount(0);
  await docs.nth(2).getByLabel('Expires on').fill(dayIn(10));
  await guest.locator('.rf-pick-policy').setInputFiles([{ name: 'policy.pdf', mimeType: 'application/pdf', buffer: pdfSaying('Policy 123') }]);
  await expect(docs.nth(2).locator('.rf-sent-ok')).toBeVisible();
  await guest.locator('.rf-camera-address').setInputFiles([{ name: 'bill.png', mimeType: 'image/png', buffer: flatPng() }]);
  await expect(docs.nth(1).getByRole('alert')).toContainText('This photo looks blurry');
  await docs.nth(1).getByRole('button', { name: 'Keep it' }).click();
  await expect(docs.nth(1).getByRole('alert')).toHaveCount(0);
  await guest.locator('.rf-pick-id').setInputFiles([{ name: 'id.pdf', mimeType: 'application/pdf', buffer: pdfSaying('A photo of a cat') }]);
  await expect(docs.nth(0).locator('.rf-sent-ok')).toBeVisible();
  await guest.context().close();

  // In Received: what does not say what it should, marked once its text is read; what expires, with its days.
  await page.getByRole('button', { name: /^Received/ }).click();
  const group = page.getByRole('region', { name: /Carla Ruiz/ });
  await expect(async () => {
    await page.reload();
    await page.getByRole('button', { name: /^Received/ }).click();
    await expect(group.getByText('Does not say INE | credencial | pasaporte | electoral')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect(group.getByText('Expires in 10 days')).toBeVisible();
  await group.getByRole('button', { name: /^Accept · Póliza de seguro/ }).click();
  await page.getByRole('button', { name: /^Accepted/ }).click();
  await page.getByRole('button', { name: /^Ask again · Póliza de seguro/ }).click();
  const again = page.getByRole('dialog', { name: /Request files for “Carla”/ });
  await expect(again.getByRole('textbox', { name: 'For whom' })).toHaveValue('Renewal: Póliza de seguro');
  await expect(again.getByRole('textbox', { name: 'Document 1' })).toHaveValue('Póliza de seguro');

  // Saved as a template of its own, and there to start from next time.
  await again.getByRole('button', { name: 'Save as template' }).click();
  await again.getByRole('textbox', { name: 'Name of the template' }).fill('Renovación de póliza');
  await again.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template “Renovación de póliza” saved')).toBeVisible();
  await expect(again.getByRole('combobox', { name: 'Start from a template' }).locator('option')).toHaveText(['Choose one…', 'Alta de proveedor', 'Expediente de cliente', 'Renovación de póliza']);
  await again.getByRole('button', { name: 'Cancel' }).last().click();

  // And taken out in the settings.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Appearance' }).click();
  await page.getByRole('button', { name: 'Remove · Renovación de póliza' }).click();
  await expect(page.getByRole('button', { name: 'Remove · Renovación de póliza' })).toHaveCount(0);
  await expect(page.getByText('Expediente de cliente')).toBeVisible();
});
