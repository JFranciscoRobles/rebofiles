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
  await host.getByRole('button', { name: 'Files', exact: true }).click();
  await host.getByRole('searchbox', { name: 'Search the files' }).fill(name);
  await expect(page.getByRole('option', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(host.locator('output')).toHaveText('1 shown');
});

test('kept in a folder: it starts there, its path starts there, and nothing above it is gone to', async ({ page }) => {
  const asked = async (method: string, path: string, data?: unknown) => (await page.request.fetch(`/api/files${path}`, { method, headers: { 'x-user': 'rooted' }, data })).json();
  const top = (await asked('POST', '/folders', { name: `Property ${Date.now()}`, parent: null })).entry;
  await asked('POST', '/folders', { name: 'Deeds', parent: top.id });
  await page.goto(`/?chrome=0&as=rooted&root=${top.id}`);
  const host = page.getByRole('region', { name: 'The application' });
  await expect(host.getByRole('heading', { level: 1 })).toHaveText(top.name);
  await expect(page.getByRole('option', { name: /^Deeds/ })).toBeVisible();

  // Inside it, its path starts at it: no My files above.
  await page.getByRole('option', { name: /^Deeds/ }).dblclick();
  const crumbs = page.locator('.rf-crumbs');
  await expect(crumbs.getByRole('button')).toHaveText([top.name, 'Deeds']);
  await expect(crumbs.getByRole('button', { name: 'My files' })).toHaveCount(0);
  // A request for files of the folder shown, from the application's button.
  await host.getByRole('button', { name: 'Request files here' }).click();
  await expect(page.getByRole('dialog', { name: 'Request files for “Deeds”' })).toBeVisible();
  await page.keyboard.press('Escape');
  // And sharing it, from the application's other button.
  await host.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Share “Deeds”' })).toBeVisible();
  await page.keyboard.press('Escape');
  // Its own section of files goes back to it, not to the top of the drive.
  await host.getByRole('button', { name: 'Files', exact: true }).click();
  await expect(host.getByRole('heading', { level: 1 })).toHaveText(top.name);
});
