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
  // Into the folder, and its own options beside its name.
  await item(page, 'Tax papers').dblclick();
  await page.getByRole('button', { name: 'Options of “Tax papers”' }).click();
  const menu = page.getByRole('menu', { name: 'Tax papers' });
  await expect(menu.getByRole('menuitem', { name: 'Open' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Request files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request files for “Tax papers”' });
  await expect(dialog.getByRole('radio', { name: /Only send files/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const ready = page.getByRole('dialog', { name: 'The link is ready, and copied' });
  const shown = ready.getByRole('textbox', { name: 'Address of the link' });
  await expect(shown).toHaveValue(/\?link=/);
  const address = await shown.inputValue();
  expect(await copied(page)).toBe(address);
  await expect(ready.getByRole('link', { name: 'View as a guest' })).toHaveAttribute('href', address);
  await expect(ready.getByText('Only send files')).toBeVisible();
  await ready.getByRole('button', { name: 'Done' }).click();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(address);
  await expect(guest.getByRole('heading', { name: 'rosa asks you for files' })).toBeVisible();
  await expect(guest.getByRole('list', { name: 'Name' })).toHaveCount(0);
  await guest.getByRole('textbox', { name: /Your name/ }).fill('Tomás Gil');
  await guest.locator('.rf-send-file').setInputFiles([{ name: 'w2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 w2') }]);
  await expect(guest.getByText('Sent', { exact: true })).toBeVisible();
  await guest.context().close();

  await page.goto('/?as=rosa');
  await expect(page.getByRole('button', { name: 'Notifications · 1 new' })).toBeVisible();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('button', { name: /Tomás Gil sent “w2\.pdf”/ })
    .click();
  await expect(item(page, 'w2.pdf')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('definition').filter({ hasText: 'Tomás Gil' })).toBeVisible();
});
