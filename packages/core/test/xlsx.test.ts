import { describe, expect, it } from 'vitest';
import { sampleXlsx } from '../../../tools/sample-xlsx';
import { readXlsx, textOfSheets } from '../src';

describe('an Excel workbook', () => {
  it('is read as its sheets, each cell as text, in its place', async () => {
    const sheets = await readXlsx(sampleXlsx());
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Sales', 'Notes & more']);
    expect(sheets[0].rows).toEqual([['Client', 'Total', 'Paid'], ['Northwind', '1250.5', 'TRUE'], [], ['Acme <Ltd>', '', '2501']]);
    expect(sheets[1].rows).toEqual([['', 'Call them on Monday']]);
  });

  it('as far as it is asked, and as text to find it by', async () => {
    const sheets = await readXlsx(sampleXlsx(), { rows: 2, columns: 2, sheets: 1 });
    expect(sheets).toEqual([
      {
        name: 'Sales',
        rows: [
          ['Client', 'Total'],
          ['Northwind', '1250.5'],
        ],
      },
    ]);
    expect(textOfSheets(await readXlsx(sampleXlsx()))).toContain('Call them on Monday');
  });

  it('that is not one is refused', async () => {
    await expect(readXlsx(new TextEncoder().encode('not a zip at all'))).rejects.toThrow(/not a zip/);
  });
});
