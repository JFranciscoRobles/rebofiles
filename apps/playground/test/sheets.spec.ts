// An Excel workbook in the drive: its first rows on its card, each sheet as a
// table in the viewer, and the workbook found by what a cell says.

import { type Page, expect, test } from '@playwright/test';
import { sampleXlsx } from '../../../tools/sample-xlsx';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

test('a workbook on its card, its sheets in the viewer, and found by a cell', async ({ page }) => {
  await page.goto('/?as=sheets');
  await page
    .locator('input[type=file]:not([webkitdirectory])')
    .setInputFiles([{ name: 'sales.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(sampleXlsx()) }]);
  await expect(item(page, 'sales.xlsx')).toBeVisible();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(item(page, 'sales.xlsx').locator('.rf-paper td').first()).toHaveText('Client');

  await item(page, 'sales.xlsx').dblclick();
  const viewer = page.getByRole('dialog', { name: /sales\.xlsx/ });
  await expect(viewer.getByRole('columnheader', { name: 'Client' })).toBeVisible();
  await expect(viewer.getByRole('cell', { name: 'Northwind' })).toBeVisible();
  await expect(viewer.getByRole('cell', { name: 'Acme <Ltd>' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Notes & more' }).click();
  await expect(viewer.getByRole('button', { name: 'Notes & more' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByRole('columnheader', { name: 'Call them on Monday' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('searchbox', { name: 'Search in the drive' }).fill('monday');
  await expect(item(page, 'sales.xlsx')).toBeVisible();
});
