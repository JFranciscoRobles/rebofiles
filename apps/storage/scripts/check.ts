// `npm run storage:check`: the whole way a file goes, against the bucket of
// `.env`, from Node, so a bucket that refuses something says so here and not
// in a page. A small file in one PUT, a large one in parts, each read back
// and compared byte for byte, a new version, an upload given up, and
// everything deleted again, in one request.
//
// A page asks more of the bucket than this: its rule of origins (`cors.json`).
// Node sends no origin, so that is tried in the page, with `npm run storage`.

import { createDriveClient } from '@rebofiles/react';
import { PART_SIZE } from '@rebofiles/server';
import { handle, storage } from '../server/bucket';

const origin = 'http://storage.check';
const drive = createDriveClient({
  base: `${origin}/api/files`,
  // The routes answered here, in this process; the bucket over the network, as a browser would reach it.
  fetch: (input, init) => (String(input).startsWith(origin) ? handle(new Request(String(input), init)) : fetch(input, init)),
});

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
