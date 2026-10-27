// A request for files from start to end: made in its dialog with the
// documents it asks for; sent from the page of the link signed out, a file
// for one, photos made one PDF for the other, one taken back and sent again,
// and a receipt; then what came, in Received, accepted and turned back.

import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { type Page, expect, test } from '@playwright/test';
import { copied, watchClipboard } from './clipboard';

const item = (page: Page, name: string) => page.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`) });

/** A PNG of one colour, made by hand: a photo for the camera. */
function png(width: number, height: number) {
  const row = Buffer.alloc(width * 3 + 1);
  for (let x = 0; x < width; x++) row.set([200, 80, 40], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('a request with documents, sent signed out with a file and photos, looked at in Received', async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.request.post('/api/files/folders', { headers: { 'x-user': 'lia' }, data: { name: 'Northwind papers', parent: null } });
  // The organisation over the pages of its requests: set by who may configure the drive, the one of this computer.
  await page.request.put('/api/files/settings', { data: { company: 'Notaría Benítez' } });
  await watchClipboard(page);
  await page.goto('/?as=lia');
  await item(page, 'Northwind papers').dblclick();
  await page.getByRole('button', { name: 'Request files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request files for “Northwind papers”' });
  await dialog.getByRole('textbox', { name: 'For whom' }).fill('Northwind');
  await dialog.getByRole('button', { name: '+ Add a document' }).click();
  await page.keyboard.type('Signed contract');
  await dialog.getByRole('button', { name: '+ Add a document' }).click();
  await page.keyboard.type('ID');
  // Put first by the keyboard, and back again.
  await page.keyboard.press('Alt+ArrowUp');
  await expect(dialog.getByRole('textbox', { name: 'Document 1' })).toHaveValue('ID');
  await expect(dialog.getByRole('textbox', { name: 'Document 1' })).toBeFocused();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(dialog.getByRole('textbox', { name: 'Document 2' })).toHaveValue('ID');
  await dialog.getByRole('textbox', { name: /Message for whoever sends/ }).fill('Send what is missing, please.');
  await dialog.getByRole('button', { name: 'PDF' }).click();
  await dialog.getByRole('button', { name: 'Photos' }).click();
  await dialog.getByRole('switch', { name: /A folder for each person/ }).check();
  await dialog.getByRole('textbox', { name: 'Name of each file' }).fill('{item} - {name}');
  // As whoever sends will see it, as it is written.
  await expect(dialog.getByRole('complementary', { name: 'As they will see it' })).toContainText('lia asks you for 2 documents');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const ready = page.getByRole('dialog', { name: 'The link is ready, and copied' });
  await expect(ready.getByText('0 of 2 documents')).toBeVisible();
  const address = await copied(page);
  await ready.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Northwind: 0 of 2 documents.' })).toBeVisible();
  // Nothing picked in the folder: its requests in the details.
  const side = page.getByRole('complementary', { name: 'Details' });
  await expect(side.getByRole('heading', { name: 'Links taking files' })).toBeVisible();
  await expect(side.getByText('0 of 2 documents')).toBeVisible();
  await expect(side.getByRole('button', { name: '+ New request' })).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(address);
  await expect(guest.getByRole('heading', { name: 'lia asks you for 2 documents' })).toBeVisible();
  await expect(guest.getByText('Notaría Benítez')).toBeVisible();
  await expect(guest.getByText('Send what is missing, please.')).toBeVisible();
  const docs = guest.getByRole('list', { name: 'Documents asked of you' }).locator(':scope > li');
  // Its name first.
  await docs.nth(0).getByRole('button', { name: 'Choose a file' }).click();
  await expect(guest.getByRole('alert')).toHaveText('Say your name first.');
  await guest.getByRole('textbox', { name: 'Your name (needed)' }).fill('Carla');
  await guest.locator('.rf-pick-d1').setInputFiles([{ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 signed') }]);
  await expect(docs.nth(0).getByText('Sent', { exact: true }).first()).toBeVisible();
  // Taken back, and sent again.
  await docs.nth(0).getByRole('button', { name: /^Undo/ }).click();
  await expect(docs.nth(0).getByRole('button', { name: 'Choose a file' })).toBeVisible();
  await guest.locator('.rf-pick-d1').setInputFiles([{ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 signed again') }]);
  await expect(docs.nth(0).locator('.rf-sent-ok')).toBeVisible();
  // Three photos, one taken out, two pages of one PDF.
  for (const name of ['front.png', 'blurry.png', 'back.png']) await guest.locator('.rf-camera-d2').setInputFiles([{ name, mimeType: 'image/png', buffer: png(60, 40) }]);
  const pages = docs.nth(1).getByRole('list', { name: 'Photos taken' });
  await expect(pages.getByRole('img')).toHaveCount(3);
  await pages.getByRole('button', { name: 'Take out page 2' }).click();
  await expect(pages.getByRole('img')).toHaveCount(2);
  await expect(docs.nth(1).getByText('2 photos ready')).toBeVisible();
  await docs.nth(1).getByRole('button', { name: 'Send 2 pages as one PDF' }).click();
  await expect(docs.nth(1).locator('.rf-sent-ok')).toBeVisible();
  await expect(guest.getByText('2 of 2')).toBeVisible();
  const kept = guest.waitForEvent('download');
  await guest.getByRole('button', { name: 'Download a receipt' }).click();
  const receipt = readFileSync((await (await kept).path())!, 'utf8');
  expect(receipt).toContain('Signed contract · scan.pdf');
  expect(receipt).toContain('ID · ID.pdf');
  await guest.context().close();

  // What came: in a folder of hers, named by the pattern; the photos, two pages of one PDF.
  const lia = { headers: { 'x-user': 'lia' } };
  const received = (await (await page.request.get('/api/files/received', lia)).json()).entries as { id: string; name: string; parent: string }[];
  expect(received.map((entry) => entry.name).sort()).toEqual(['ID - Carla.pdf', 'Signed contract - Carla.pdf']);
  const id = received.find((entry) => entry.name === 'ID - Carla.pdf')!;
  const url = (await (await page.request.get(`/api/files/entries/${id.id}/download`, lia)).json()).url as string;
  const bytes = Buffer.from(await (await page.request.get(url)).body());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/Count 2');

  // Received, by request: what it asked, each file to accept or turn back there and then.
  await page.reload();
  await page.getByRole('button', { name: /^Received/ }).click();
  const group = page.getByRole('region', { name: /Northwind/ });
  await expect(group).toContainText('Carla · 2 of 2 documents');
  await expect(group.getByText('Complete · closed')).toBeVisible();
  await group.getByRole('button', { name: 'Accept · Signed contract - Carla.pdf' }).click();
  await expect(group.getByRole('button', { name: 'Signed contract - Carla.pdf', exact: true })).toHaveCount(0);
  await group.getByRole('button', { name: 'Return · ID - Carla.pdf' }).click();
  await page.getByRole('textbox', { name: 'Why it is returned' }).fill('It is blurry.');
  await page.getByRole('button', { name: 'Return and tell Carla' }).click();
  await expect(page.getByText('Nothing here.')).toBeVisible();
  await page.getByRole('button', { name: /^Returned · 1/ }).click();
  await expect(page.getByText('It is blurry.')).toBeVisible();
  await page.getByRole('button', { name: /^Accepted · 1/ }).click();
  await expect(page.getByRole('button', { name: 'Signed contract - Carla.pdf', exact: true })).toBeVisible();
  // In its folder, who sent each, in the column of its owner.
  await page.getByRole('button', { name: 'My files' }).first().click();
  await item(page, 'Northwind papers').dblclick();
  await item(page, 'Carla').dblclick();
  await expect(page.locator('.rf-cols')).toContainText('Owner / sent by');
  await expect(item(page, 'ID - Carla.pdf')).toContainText('Returned');
});
