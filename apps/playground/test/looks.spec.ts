// A folder in a colour of one's choosing, from its details and its menu, and
// undone; and a picture shown blurred, from a few pixels of it, while it comes.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });
const details = (page: Page) => page.getByRole('complementary', { name: 'Details' });
const tileOf = (page: Page, name: string) => item(page, name).locator('.rf-tile');

test('a folder takes a colour from its details or its menu, and the toast takes it back', async ({ page }) => {
  await page.goto(`/?as=paint-${Date.now()}`);
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('Painted');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await item(page, 'Painted').click();
  const colours = details(page).getByRole('radiogroup', { name: 'Colour' });
  await expect(colours.getByRole('radio', { name: 'The drive’s own' })).toBeChecked();
  await colours.getByRole('radio', { name: 'Blue' }).click();
  await expect(page.getByRole('status')).toContainText('Colour changed');
  await expect(tileOf(page, 'Painted')).toHaveClass(/rf-fc-blue/);
  await expect(colours.getByRole('radio', { name: 'Blue' })).toBeChecked();
  expect((await new AxeBuilder({ page }).include('.rf-swatches').analyze()).violations).toEqual([]);

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(tileOf(page, 'Painted')).not.toHaveClass(/rf-fc-/);

  await item(page, 'Painted').click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitemradio', { name: 'Green' }).click();
  await expect(tileOf(page, 'Painted')).toHaveClass(/rf-fc-green/);
  await page.reload();
  await expect(tileOf(page, 'Painted')).toHaveClass(/rf-fc-green/);
});

test('a picture is shown blurred from a few pixels of it, under where it comes', async ({ page }) => {
  await page.goto(`/?as=blur-${Date.now()}`);
  // A real picture, drawn in the page, as the page reads what it uploads.
  const png = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 900, height: 600 });
    const draw = canvas.getContext('2d')!;
    const sky = draw.createLinearGradient(0, 0, 0, 600);
    sky.addColorStop(0, '#2b6cb0');
    sky.addColorStop(1, '#f6ad55');
    draw.fillStyle = sky;
    draw.fillRect(0, 0, 900, 600);
    const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(png) }]);
  await expect(page.getByRole('region', { name: 'Uploads' }).getByText('Uploaded', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Grid' }).click();
  const placeholder = item(page, 'sunset.png').locator('img.rf-ph');
  await expect(placeholder).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  expect((await placeholder.getAttribute('src'))!.length).toBeLessThan(2000);
  await expect(item(page, 'sunset.png').locator('img:not(.rf-ph)')).toHaveCount(1);
  await item(page, 'sunset.png').click();
  await expect(details(page).locator('.rf-preview img.rf-ph')).toHaveCount(1);
  await expect(details(page).getByRole('img', { name: 'sunset.png' })).toBeVisible();
});
