// The settings: one's own language and theme, and, for whoever may configure
// the drive, its colour and the sizes pictures are made in when uploaded.
// What a test changes for everyone, it puts back.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function axe(page: Page) {
  // Once the screen has come in: halfway, its text is faded.
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} · ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** A picture of `width` × `height`, drawn in the page, as a PNG. */
const picture = (page: Page, width: number, height: number) =>
  page.evaluate(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#0b57d0';
      context.fillRect(0, 0, w, h);
      context.fillStyle = '#f0c55a';
      context.fillRect(w / 4, h / 4, w / 2, h / 2);
      return Array.from(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()));
    },
    [width, height],
  );

test.afterAll(async ({ request }) => {
  await request.put('/api/files/settings', { data: { brand: null, images: { sizes: [160, 480, 1024, 2048], format: 'jpeg', quality: 0.82, enabled: true }, quota: null, trashDays: null } });
  await request.put('/api/files/settings/mine', { data: {} });
});

const settings = (page: Page) => page.getByRole('dialog', { name: /^(Settings|Configuración)$/ });

test('one’s own language and theme, saved as they are chosen and kept by the server', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const screen = settings(page);
  await expect(screen.getByRole('tab', { name: 'Language' })).toBeFocused();
  await expect(screen.getByRole('heading', { name: 'For everyone in the drive' })).toBeVisible();
  expect.soft(await axe(page)).toEqual([]);

  await screen.getByRole('group', { name: 'Language', exact: true }).getByRole('button', { name: 'Español' }).click();
  await expect(screen.getByRole('status')).toHaveText('Guardado');
  await expect(screen.getByRole('tab', { name: 'Idioma' })).toBeVisible();
  // The arrows go through the parts, as in a list of tabs.
  await screen.getByRole('tab', { name: 'Idioma' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(screen.getByRole('tab', { name: 'Apariencia' })).toHaveAttribute('aria-selected', 'true');
  await screen.getByRole('group', { name: 'Tema', exact: true }).getByRole('button', { name: 'Oscuro' }).click();
  await expect(page.locator('.rf-drive')).toHaveAttribute('data-theme', 'dark');
  expect.soft(await axe(page)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Configuración' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mis archivos' }).first()).toBeVisible();
  await expect(page.locator('.rf-drive')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Configuración' }).click();
  await settings(page).getByRole('group', { name: 'Idioma', exact: true }).getByRole('button', { name: 'Como el drive' }).click();
  await settings(page).getByRole('tab', { name: 'Appearance' }).click();
  await settings(page).getByRole('group', { name: 'Theme', exact: true }).getByRole('button', { name: 'As the drive' }).click();
  await expect(page.locator('.rf-drive')).toHaveAttribute('data-theme', 'light');
  await settings(page).getByRole('button', { name: 'Back to the drive' }).click();
  await expect(page.getByRole('button', { name: 'My files' }).first()).toBeVisible();
});

test('the drive’s colour, and pictures made in its sizes as the original’s type, the original kept', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const screen = settings(page);
  await screen.getByRole('tab', { name: 'Appearance' }).click();
  await screen.getByRole('button', { name: '#0b57d0' }).click();
  await expect(screen.getByRole('button', { name: '#0b57d0' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.rf-drive').evaluate((drive) => getComputedStyle(drive).getPropertyValue('--rf-brand').trim())).toBe('#0b57d0');

  await screen.getByRole('tab', { name: 'Pictures' }).click();
  for (const [name, size] of [
    ['Thumbnail', 100],
    ['Small', 300],
    ['Medium', 600],
    ['Large', 1200],
  ] as const) {
    await screen.getByRole('spinbutton', { name: `${name}, pixels` }).fill(String(size));
    await screen.getByRole('spinbutton', { name: `${name}, pixels` }).press('Tab');
  }
  await expect(screen.getByRole('status')).toHaveText('Saved');
  await screen.getByRole('button', { name: /^Original/ }).click();
  await expect(screen.getByRole('button', { name: /^Original/ })).toHaveAttribute('aria-pressed', 'true');
  expect.soft(await axe(page)).toEqual([]);
  // A size the drive does not take is said, and not saved.
  await screen.getByRole('spinbutton', { name: 'Large, pixels' }).fill('5');
  await screen.getByRole('spinbutton', { name: 'Large, pixels' }).press('Tab');
  await expect(screen.getByRole('status')).toContainText('from 16 to 8192');
  await screen.getByRole('spinbutton', { name: 'Large, pixels' }).fill('1200');
  await page.keyboard.press('Escape');

  const bytes = await picture(page, 1500, 1000);
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: Buffer.from(bytes) });
  await expect(page.getByRole('option', { name: /^plan\.png/ })).toBeVisible();
  await expect
    .poll(async () => {
      const [entry] = (await (await page.request.get('/api/files/search?q=plan')).json()).entries;
      return entry.versions[0].renditions?.map((r: { size: number; width: number; height: number; type: string }) => [r.size, r.width, r.height, r.type]);
    })
    .toEqual([
      [100, 100, 67, 'image/png'],
      [300, 300, 200, 'image/png'],
      [600, 600, 400, 'image/png'],
      [1200, 1200, 800, 'image/png'],
    ]);
  const [entry] = (await (await page.request.get('/api/files/search?q=plan')).json()).entries;
  expect(entry.versions[0].size).toBe(bytes.length);
  // The grid shows a smaller one; a download is the original.
  const small = (await (await page.request.get(`/api/files/entries/${entry.id}/download?size=320`)).json()) as { width: number };
  expect(small.width).toBe(600);
});

test('someone else changes only their own', async ({ page }) => {
  await page.goto('/?as=bea-settings');
  await page.getByRole('button', { name: 'Settings' }).click();
  const screen = settings(page);
  await expect(screen.getByRole('heading', { name: 'For you' })).toBeVisible();
  await expect(screen.getByRole('heading', { name: 'For everyone in the drive' })).toHaveCount(0);
  await expect(screen.getByRole('tab', { name: 'Pictures' })).toHaveCount(0);
  expect((await page.request.put('/api/files/settings', { headers: { 'x-user': 'bea-settings' }, data: { brand: '#000000' } })).status()).toBe(403);
});

test('a quota and days of the trash, from Storage, and the space used in the side', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rf-usage')).toContainText(/used$/);
  await page.getByRole('button', { name: 'Settings' }).click();
  const screen = settings(page);
  await screen.getByRole('tab', { name: 'Storage' }).click();
  await screen.getByRole('spinbutton', { name: 'Space for each person' }).fill('0.5');
  await screen.getByRole('spinbutton', { name: 'Space for each person' }).press('Tab');
  await expect(screen.getByRole('status')).toHaveText('Saved');
  await screen.getByRole('spinbutton', { name: 'Empty the trash after' }).fill('30');
  await screen.getByRole('spinbutton', { name: 'Empty the trash after' }).press('Tab');
  await expect(screen.getByRole('status')).toHaveText('Saved');
  expect.soft((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rf-usage')).toContainText(/of 537 MB used/);
  await expect(page.getByRole('progressbar', { name: 'Space used' })).toBeVisible();
  const saved = (await (await page.request.get('/api/files/settings')).json()).drive;
  expect([saved.quota, saved.trashDays]).toEqual([536870912, 30]);
});

