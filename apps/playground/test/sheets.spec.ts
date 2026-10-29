// An Excel workbook in the drive: its first cells on its card, drawn by
// Rebosheets, its grid with a tab for each sheet in the viewer, and the
// workbook found by what a cell says.

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
  await expect(item(page, 'sales.xlsx').locator('img.rf-doc-pic')).toBeVisible();

  // The grid, read only, is drawn on a canvas: what the cells say is found below, by the search.
  await item(page, 'sales.xlsx').dblclick();
  const viewer = page.getByRole('dialog', { name: /sales\.xlsx/ });
  await expect(viewer.getByRole('grid')).toBeVisible();
  await expect(viewer.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
  await viewer.getByRole('tab', { name: 'Notes & more' }).click();
  await expect(viewer.getByRole('tab', { name: 'Notes & more' })).toHaveAttribute('aria-selected', 'true');
  await expect(viewer.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('Escape');

  await page.getByRole('searchbox', { name: 'Search in the drive' }).fill('monday');
  await expect(item(page, 'sales.xlsx')).toBeVisible();
});
