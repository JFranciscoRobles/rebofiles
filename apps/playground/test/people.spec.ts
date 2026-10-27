// For who looks after the drive: in its settings, what each person keeps and
// the whole of it, and what was done anywhere in it; none of it for anyone else.

import { expect, test } from '@playwright/test';

test('the space of each person and the activity of the whole drive, for who may configure it only', async ({ page, browser }) => {
  const as = (who: string) => ({ headers: { 'x-user': who } });
  await page.request.post('/api/files/folders', { ...as('pia'), data: { name: 'Pia’s folder', parent: null } });
  await page.request.post('/api/files/folders', { ...as('teo'), data: { name: 'Teo’s folder', parent: null } });

  // The one of this computer may configure the playground's drive.
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'People' }).click();
  const usage = page.getByRole('table');
  await expect(usage.getByRole('rowheader', { name: 'pia', exact: true })).toBeVisible();
  await expect(usage.getByRole('rowheader', { name: 'teo', exact: true })).toBeVisible();
  await expect(usage.getByRole('rowheader', { name: 'The whole drive' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Activity in the whole drive' }).getByText('teo created Teo’s folder')).toBeVisible();

  const pia = await (await browser.newContext()).newPage();
  await pia.goto('/?as=pia');
  await pia.getByRole('button', { name: 'Settings' }).click();
  await expect(pia.getByRole('tab', { name: 'People' })).toHaveCount(0);
  expect((await pia.request.get('/api/files/admin/usage', as('pia'))).status()).toBe(403);
  await pia.context().close();
});
