// An upload cut on the way: its parts tried again by themselves, and, when it
// cannot go on, "Try again", which sends only what had not arrived.

import { type Page, expect, test } from '@playwright/test';

const MiB = 1024 * 1024;
const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

/** The parts sent to the server's addresses, and which of them are cut, as a connection that drops. */
async function cutParts(page: Page, cut: (n: number) => boolean) {
  const sent: number[] = [];
  let n = 0;
  await page.route('**/api/files/bytes?**', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const at = ++n;
    if (cut(at)) return route.abort('connectionreset');
    sent.push(at);
    return route.continue();
  });
  return sent;
}

test('a part cut on the way is sent again by itself, and the file arrives whole', async ({ page }) => {
  await page.goto('/?as=resume1');
  const sent = await cutParts(page, (n) => n === 2);
  await page.locator('input[type=file]').setInputFiles({ name: 'video.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(9 * MiB, 7) });
  await expect(item(page, 'video.bin')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  // The first part, the second cut, then tried again.
  expect(sent).toEqual([1, 3]);
});

test('an upload that cannot go on says so, and "Try again" sends only what had not arrived', async ({ page }) => {
  await page.goto('/?as=resume2&retries=0');
  let down = true;
  const sent = await cutParts(page, (n) => n > 1 && down);
  await page.locator('input[type=file]').setInputFiles({ name: 'film.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(17 * MiB, 3) });
  await expect(page.getByRole('alert')).toContainText('film.bin was cut at');
  await expect(page.getByRole('alert')).toContainText('What arrived is kept.');
  await expect(item(page, 'film.bin')).toHaveCount(0);

  down = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(item(page, 'film.bin')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // Of three parts: the first before the cut, and after it only the two that had not arrived.
  expect(sent.length).toBe(3);
  await item(page, 'film.bin').click();
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText('18 MB');
});
