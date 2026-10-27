// A request for files: a link of a folder that only takes them, made in the
// sharing dialog; whoever opens it signed out sees nowhere but where to send
// them, says who they are and sends one; and its owner is told, and finds it.

import { type Page, expect, test } from '@playwright/test';
import { copied, watchClipboard } from './clipboard';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a request for files sent signed out, and its owner told', async ({ page, browser }) => {
  const as = { headers: { 'x-user': 'rosa' } };
  await page.request.post('/api/files/folders', { ...as, data: { name: 'Tax papers', parent: null } });
  await watchClipboard(page);
  await page.goto('/?as=rosa');
  await item(page, 'Tax papers').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: /Tax papers/ });
  await dialog.getByRole('combobox', { name: 'What it lets do' }).selectOption('only');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Request for files')).toBeVisible();
  const address = await copied(page);

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(address);
  await expect(guest.getByRole('heading', { name: 'Send files to “Tax papers”' })).toBeVisible();
  await expect(guest.getByRole('list', { name: 'Name' })).toHaveCount(0);
  await guest.getByRole('textbox', { name: /Your name/ }).fill('Tomás Gil');
  await guest.locator('.rf-send-file').setInputFiles([{ name: 'w2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 w2') }]);
  await expect(guest.getByText('Sent', { exact: true })).toBeVisible();
  await guest.context().close();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Notifications · 1 new' })).toBeVisible();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('button', { name: /Tomás Gil sent “w2\.pdf”/ })
    .click();
  await expect(item(page, 'w2.pdf')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('definition').filter({ hasText: 'Tomás Gil' })).toBeVisible();
});
