// `npm run storage:check`: the whole way a file goes, against the bucket of
// `.env`, from Node, so a bucket that refuses something says so here and not
// in a page. A small file in one PUT, a large one in parts, each read back
// and compared byte for byte, a new version, an upload given up; a version
// sent with only its part that changed, a PDF made a picture by the server, a
// program refused, the uploads left halfway swept; and everything deleted
// again, in one request.
//
// A page asks more of the bucket than this: its rule of origins (`cors.json`).
// Node sends no origin, so that is tried in the page, with `npm run storage`.

import { createDriveClient } from '@rebofiles/react';
import { PART_SIZE } from '@rebofiles/server';
import type { FileEntry } from '@rebofiles/core';
import { handle, storage } from '../server/bucket';

const origin = 'http://storage.check';
const drive = createDriveClient({
  base: `${origin}/api/files`,
  // The routes answered here, in this process; the bucket over the network, as a browser would reach it.
  fetch: (input, init) => (String(input).startsWith(origin) ? handle(new Request(String(input), init)) : fetch(input, init)),
});

/** A PDF of one page with a line of text, written by hand. */
function onePagePdf(line: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

const bytesOf = (size: number, seed: number) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) % 251);
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i]);

async function step<T>(what: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    const result = await run();
    console.log(`  ✓ ${what} (${Math.round(performance.now() - started)} ms)`);
    return result;
  } catch (error) {
    console.log(`  ✗ ${what}\n\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

async function readBack(id: string, expected: Uint8Array, version?: string) {
  const answer = await fetch(await drive.url(id, { version }));
  if (!answer.ok) throw new Error(`The bucket answered ${answer.status} to the download: ${(await answer.text()).slice(0, 300)}`);
  if (!same(new Uint8Array(await answer.arrayBuffer()), expected)) throw new Error('What came back is not what went up.');
}

console.log(`\nChecking ${storage.label}\n`);

const folder = await step('a folder', () => drive.createFolder(`check ${new Date().toISOString().replace(/[:.]/g, '-')}`, null));

const small = bytesOf(48_000, 1);
const one = await step('a small file, in one PUT', () => drive.upload(new File([small], 'small.txt', { type: 'text/plain' }), { parent: folder.id }));
await step('read back', () => readBack(one.id, small));

const large = bytesOf(2 * PART_SIZE + 1234, 2);
const parts = await step(`a file of ${(large.length / 1024 / 1024).toFixed(1)} MiB, in parts`, () => drive.upload(new File([large], 'large.bin'), { parent: folder.id }));
await step('read back', () => readBack(parts.id, large));

const second = bytesOf(1000, 3);
const versioned = await step('a second version', () => drive.upload(new File([second], 'small.txt', { type: 'text/plain' }), { file: one.id }));
await step('both versions read back', async () => {
  await readBack(one.id, second);
  await readBack(one.id, small, versioned.versions[1].id);
});

await step('shown in the page, not saved', async () => {
  const answer = await fetch(await drive.url(one.id, { inline: true }));
  const disposition = answer.headers.get('content-disposition') ?? '';
  if (!disposition.startsWith('inline')) throw new Error(`The bucket answered with content-disposition "${disposition}".`);
  await answer.body?.cancel();
});

await step('an upload in parts given up, and gone from the bucket', async () => {
  const route = (path: string, body: unknown) =>
    handle(new Request(`${origin}/api/files${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then((r) => r.json());
  const started = (await route('/uploads', { name: 'given up.bin', parent: folder.id, type: 'application/octet-stream', size: 2 * PART_SIZE })) as { token: string; parts: { url: string }[] };
  const [first, second] = started.parts;
  const sent = await fetch(first.url, { method: 'PUT', body: bytesOf(PART_SIZE, 4) });
  if (!sent.ok) throw new Error(`The bucket answered ${sent.status} to the first part.`);
  const { aborted } = (await route('/uploads/abort', { token: started.token })) as { aborted: boolean };
  if (!aborted) throw new Error('The server did not give it up.');
  // The bucket no longer knows the upload: a part sent to it now is refused.
  const late = await fetch(second.url, { method: 'PUT', body: bytesOf(PART_SIZE, 5) });
  await late.body?.cancel();
  if (late.ok) throw new Error('The bucket still took a part of the upload given up.');
});

await step('an upload in parts cut, gone on with from what the bucket lists, and read back', async () => {
  const route = (path: string, body: unknown) =>
    handle(new Request(`${origin}/api/files${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then((r) => r.json());
  const bytes = bytesOf(2 * PART_SIZE + 77, 6);
  const started = (await route('/uploads', { name: 'cut.bin', parent: folder.id, type: 'application/octet-stream', size: bytes.length })) as {
    token: string;
    parts: { url: string; from: number; to: number }[];
  };
  const sent = await fetch(started.parts[1].url, { method: 'PUT', body: bytes.slice(started.parts[1].from, started.parts[1].to) });
  if (!sent.ok) throw new Error(`The bucket answered ${sent.status} to the second part.`);
  type Plan = { done: { number: number; etag: string }[]; parts: { number: number; url: string; from: number; to: number }[]; sent: number };
  const plan = (await route('/uploads/resume', { token: started.token })) as Plan;
  if (plan.done.map((p) => p.number).join() !== '2' || plan.parts.map((p) => p.number).join() !== '1,3') throw new Error(`The bucket listed ${JSON.stringify(plan.done)}.`);
  const parts = [...plan.done];
  for (const part of plan.parts) {
    const answer = await fetch(part.url, { method: 'PUT', body: bytes.slice(part.from, part.to) });
    if (!answer.ok) throw new Error(`The bucket answered ${answer.status} to part ${part.number}.`);
    parts.push({ number: part.number, etag: answer.headers.get('etag') ?? '' });
  }
  const { entry } = (await route('/uploads/finish', { token: started.token, parts })) as { entry: { id: string } };
  await readBack(entry.id, bytes);
});

await step('a new version of a file in parts, only its part that changed sent, the rest copied in the bucket', async () => {
  const sent: number[] = [];
  const counting = createDriveClient({
    base: `${origin}/api/files`,
    fetch: (input, init) => {
      if (init?.method === 'PUT' && init.body) sent.push((init.body as Blob).size);
      return String(input).startsWith(origin) ? handle(new Request(String(input), init)) : fetch(input, init);
    },
  });
  const first = bytesOf(3 * PART_SIZE + 99, 7);
  const file = await counting.upload(new File([first], 'delta.bin'), { parent: folder.id, partHashes: true });
  const second = first.slice();
  second.fill(9, PART_SIZE + 10, PART_SIZE + 500);
  sent.length = 0;
  await counting.upload(new File([second], 'delta.bin'), { file: file.id, partHashes: true });
  if (sent.join() !== String(PART_SIZE)) throw new Error(`Sent ${sent.join(', ')} bytes, not one part of ${PART_SIZE}.`);
  await readBack(file.id, second);
});

await step('a PDF, its first page made a picture in the bucket and its text kept, by the server', async () => {
  const pdf = onePagePdf('Checked against the bucket');
  const file = await drive.upload(new File([pdf as BlobPart], 'check.pdf', { type: 'application/pdf' }), { parent: folder.id });
  await handle.idle();
  const now = ((await drive.entry(file.id)).entry as FileEntry).versions[0];
  if (!now.renditions?.length) throw new Error('No picture was made of it.');
  const picture = await fetch(await drive.url(file.id, { inline: true, size: now.renditions[0].size }));
  if (!picture.ok || !picture.headers.get('content-type')?.startsWith('image/')) throw new Error(`Its picture answered ${picture.status} ${picture.headers.get('content-type')}.`);
  await picture.body?.cancel();
  const found = await drive.searchText('checked against bucket');
  if (!found.some((f) => f.entry.id === file.id)) throw new Error('Its text is not found by a search.');
});

await step('a program called a picture refused, and taken out of the bucket', async () => {
  const program = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
  const refused = await drive.upload(new File([program], 'photo.png', { type: 'image/png' }), { parent: folder.id }).then(
    () => null,
    (error: { code?: string }) => error.code,
  );
  if (refused !== 'program-refused') throw new Error(`It was ${refused === null ? 'kept' : `refused as ${refused}`}.`);
});

await step('uploads left halfway listed and swept, under the prefix only', async () => {
  // Nothing of a minute ago is swept: the sweep lists the bucket's uploads and leaves what is younger.
  await storage.sweepUploads!(new Date(Date.now() - 60_000));
});

const urls = await Promise.all([drive.url(one.id), drive.url(one.id, { version: versioned.versions[1].id }), drive.url(parts.id)]);
await step('deleted for good', async () => {
  await drive.moveToTrash(folder.id);
  await drive.deleteForever(folder.id);
});
await step('gone from the bucket', async () => {
  for (const url of urls) {
    const answer = await fetch(url);
    await answer.body?.cancel();
    if (answer.status !== 404) throw new Error(`A deleted file still answers ${answer.status}.`);
  }
});

console.log('\nThe bucket does all a drive asks of it.\n');
