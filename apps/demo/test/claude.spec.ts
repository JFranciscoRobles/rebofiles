// Claude in the demo: what it asks the MCP tools, answered over the drive in
// the page, and the rename it makes seen in the drive as it happens.

import { expect, test } from '@playwright/test';
import { DEMO } from '../../../playwright.config';

test('Claude finds the contract, reads its client in Rebodocs, and renames it, seen in the drive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(DEMO);
  await page.getByRole('option', { name: /^Contracts/ }).dblclick();
  await expect(page.getByRole('option', { name: /^contract-final\(2\)\.docx/ })).toBeVisible();

  const card = page.getByRole('status').filter({ hasText: 'Claude · via MCP' });
  const tools = card.getByRole('list', { name: 'Tools used' });
  await expect(tools.getByRole('listitem')).toHaveText(['searchcontract-final(2).docx', 'read_documentNorthwind S.A.', 'renamecontract-northwind.docx'], { timeout: 10_000 });
  await expect(card).toContainText('Renamed to contract-northwind.docx, after the client on page 1.');
  await expect(page.getByRole('option', { name: /^contract-northwind\.docx/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /^contract-final\(2\)\.docx/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Claude leaves the contract as it is when the person renamed it first', async ({ page }) => {
  await page.goto(DEMO);
  await page.getByRole('option', { name: /^Contracts/ }).dblclick();
  await page.getByRole('option', { name: /^contract-final\(2\)\.docx/ }).click();
  await page.keyboard.press('F2');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('mine.docx');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: /^mine\.docx/ })).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(page.getByRole('status').filter({ hasText: 'Claude · via MCP' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /^mine\.docx/ })).toBeVisible();
});
