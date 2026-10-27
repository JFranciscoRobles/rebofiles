// What a person is told in the drive: a folder shared with them and a comment
// that names them, in the bell, how many new; looked at, none is new; and
// each opens where it is, the comment in its tab.

import { expect, test } from '@playwright/test';

test('shared with and named in a comment: told in the bell, and each opens where it is', async ({ page, browser }) => {
  const as = (who: string) => ({ headers: { 'x-user': who } });
  const folder = (await (await page.request.post('/api/files/folders', { ...as('noa'), data: { name: 'Budget', parent: null } })).json()).entry;
  const note = (await (await page.request.post('/api/files/folders', { ...as('noa'), data: { name: 'Plans', parent: null } })).json()).entry;
  await page.request.post(`/api/files/entries/${folder.id}/shares`, { ...as('noa'), data: { with: 'bel', role: 'editor' } });
  await page.request.post(`/api/files/entries/${note.id}/shares`, { ...as('noa'), data: { with: 'bel', role: 'commenter' } });
  await page.request.post(`/api/files/entries/${note.id}/comments`, { ...as('noa'), data: { text: '@bel can you look at this?' } });

  const bel = await (await browser.newContext()).newPage();
  await bel.goto('/?as=bel');
  const bell = bel.getByRole('button', { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName('Notifications · 3 new');
  await bell.click();
  const told = bel.getByRole('region', { name: 'Notifications' });
  await expect(told.getByRole('button', { name: /noa named you in “Plans”/ })).toBeVisible();
  await expect(told.getByRole('button', { name: /noa shared “Budget” with you/ })).toBeVisible();
  await expect(bell).toHaveAccessibleName('Notifications');

  await told.getByRole('button', { name: /noa named you in “Plans”/ }).click();
  await expect(told).toHaveCount(0);
  await expect(bel.getByRole('tab', { name: 'Comments' })).toHaveAttribute('aria-selected', 'true');
  await expect(bel.getByText('@bel can you look at this?')).toBeVisible();

  // Seen: the bell has none new, after the page is opened again too.
  await bel.reload();
  await expect(bel.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');
  await bel.context().close();
});
