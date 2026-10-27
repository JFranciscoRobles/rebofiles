// The drive without its own bar and sections, inside an application's: driven
// by its buttons and its search, and telling it where it is and how many.

import { expect, test } from '@playwright/test';

test('without its own bar and sections, driven by the application’s and telling it where it is', async ({ page }) => {
  const name = `Bare ${Date.now()}`;
  // As someone of their own: the folder it makes is not in the drive the other tests go through.
  await page.goto('/?chrome=0&as=bare');
  const host = page.getByRole('region', { name: 'The application' });
  await expect(host.locator('output')).toContainText(/\d+ shown/);

  // None of its own: no title, no search, no sections, no button to add.
  await expect(page.locator('.rf-top')).toBeHidden();
  await expect(page.locator('.rf-side')).toBeHidden();
  await expect(page.locator('.rf-new')).toBeHidden();
  // What its sections said of the space used, at the foot.
  await expect(page.locator('.rf-status')).toContainText(/\d+ items? · .* used/);

  // A folder made from the application's button, and gone into: its name told as where the drive is.
  // Centred, even under the reset of a page that takes every margin off, as Tailwind's does.
  await page.addStyleTag({ content: '*, ::before, ::after { margin: 0; padding: 0; }' });
  await host.getByRole('button', { name: 'New folder' }).click();
  const dialog = page.getByRole('dialog', { name: 'New folder' });
  const box = (await dialog.boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(4);
  expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(4);
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).dblclick();
  await expect(host.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(host.locator('output')).toHaveText('0 shown');

  // A section of the application's, the drive's.
  await host.getByRole('button', { name: 'Trash' }).click();
  await expect(host.getByRole('button', { name: 'Trash' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Trash', level: 2 })).toBeVisible();

  // Its search, the drive's: from the trash, back to the files, the one asked for.
  await host.getByRole('button', { name: 'Files' }).click();
  await host.getByRole('searchbox', { name: 'Search the files' }).fill(name);
  await expect(page.getByRole('option', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(host.locator('output')).toHaveText('1 shown');
});
