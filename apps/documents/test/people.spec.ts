// Who is who, as the documents' demo says it: someone found by their name or
// their email where a folder is shared, a group too, and each shown by name.

import { type Page, expect, test } from '@playwright/test';
import { DOCUMENTS } from '../../../playwright.config';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name}( |$)`) });

test('someone found by name or email where a folder is shared, and shown by name', async ({ page }) => {
  await page.request.post(`${DOCUMENTS}/api/files/folders`, { data: { name: 'Contratos', parent: null } });
  await page.goto(`${DOCUMENTS}/`);
  await item(page, 'Contratos').click();
  await page.getByRole('complementary', { name: 'Details' }).getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Share “Contratos”/ });
  const who = dialog.getByRole('combobox', { name: 'Add someone' });
  const found = dialog.getByRole('listbox', { name: 'Add someone' });

  // By their email, chosen by the arrows and Enter.
  await who.fill('beto@');
  await expect(found.getByRole('option', { name: /Beto Díaz/ })).toBeVisible();
  await expect(who).toHaveAttribute('aria-expanded', 'true');
  await who.press('Enter');
  await expect(who).toHaveValue('');
  await expect(dialog.getByRole('list').getByText('Beto Díaz', { exact: true })).toBeVisible();

  // A group, by its name without its accent, with a click.
  await who.fill('juridico');
  await found.getByRole('option', { name: /Jurídico/ }).click();
  await expect(dialog.getByText('Group · Jurídico')).toBeVisible();

  // Someone not in the directory: as typed, with the button.
  await who.fill('nadie');
  await expect(found).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('list').getByText('nadie', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // In the details, by name too.
  await expect(page.getByRole('complementary', { name: 'Details' }).getByText(/Beto Díaz · Editor|Beto Díaz · Viewer/)).toBeVisible();
});
