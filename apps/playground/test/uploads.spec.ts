// The panel of uploads: files going up together, each with how far it is, how
// fast and how long it has left, and all of them; one stopped and sent again.

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const MiB = 1024 * 1024;

test('files go up together, each saying how long it has left, and one is stopped and sent again', async ({ page }) => {
  await page.goto('/?as=panel');
  // Each part held a while, as a slow connection holds it: long enough to be seen going.
  await page.route('**/api/files/bytes?**', async (route) => {
    if (route.request().method() === 'PUT') await new Promise((done) => setTimeout(done, 1200));
    // A part of the one stopped is gone by then, its request taken back by the page.
    return route.continue().catch(() => undefined);
  });
  // Files on the disk: more than a page may be handed at once otherwise, and of several parts each, for some to be seen gone.
  const files = ['video-a.bin', 'video-b.bin'].map((name, i) => {
    const path = join(tmpdir(), `rebofiles-${name}`);
    writeFileSync(path, Buffer.alloc(60 * MiB, i + 1));
    return path;
  });
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(files);
  const panel = page.getByRole('region', { name: 'Uploads' });
  await expect(panel).toBeVisible();
  // Both at once, not one after the other.
  await expect(panel.getByRole('progressbar', { name: 'rebofiles-video-a.bin' })).toBeVisible();
  await expect(panel.getByRole('progressbar', { name: 'rebofiles-video-b.bin' })).toBeVisible();
  await expect(panel.locator('.rf-up-sending')).toHaveCount(2);
  await expect(panel.locator('.rf-up-sending .rf-up-state').first()).toContainText(/MB of 63 MB · .*\/s · \d+ sec left|min left/, { timeout: 15_000 });
  await expect(panel.locator('.rf-ups-title')).toContainText(/Uploading: \d of 2 up · .* left/);

  const { violations } = await new AxeBuilder({ page }).include('.rf-ups').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect.soft(violations.map((v) => v.id)).toEqual([]);

  await panel.getByRole('button', { name: 'Stop rebofiles-video-b.bin' }).click();
  await expect(panel.locator('.rf-up-stopped')).toContainText('Stopped');
  await page.unroute('**/api/files/bytes?**');
  await expect(page.getByRole('option', { name: /^rebofiles-video-a\.bin/ })).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('option', { name: /^rebofiles-video-b\.bin/ })).toBeVisible({ timeout: 30_000 });
  await expect(panel.locator('.rf-ups-title')).toHaveText('2 uploaded');
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
});

test('a folder of the computer goes up as it was, its folders made and each file in its own', async ({ page }) => {
  const { mkdirSync, mkdtempSync } = await import('node:fs');
  const root = mkdtempSync(join(tmpdir(), 'rebofiles-folder-'));
  mkdirSync(join(root, 'Obra', 'Planos'), { recursive: true });
  writeFileSync(join(root, 'Obra', 'acta.txt'), 'Acta');
  writeFileSync(join(root, 'Obra', 'Planos', 'planta.txt'), 'Planta');
  await page.goto('/?as=folders');
  await page.locator('.rf-folder-file').setInputFiles(join(root, 'Obra'));
  const item = (name: string) => page.getByRole('listbox').getByRole('option', { name: new RegExp(`^${name}( |$)`) });
  await expect(item('Obra')).toBeVisible();
  await item('Obra').dblclick();
  await expect(item('acta.txt')).toBeVisible();
  await expect(item('Planos')).toBeVisible();
  await item('Planos').dblclick();
  await expect(item('planta.txt')).toBeVisible();
});
