// The bytes in Azure Blob Storage, tried against Azurite, Microsoft's own
// emulator of it, run here: a small file and one in parts sent straight to
// it at addresses the server signs and read back whole, a new version sent
// with only its part that changed (Put Block From URL), an upload cut gone on
// with, what the server reads and writes, and the bytes deleted.

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileEntry } from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { PART_SIZE, azureStorage, createDriveHandler, memoryMetadata } from '../src';

// Azurite's account, the same everywhere: it is no secret.
const ACCOUNT = 'devstoreaccount1';
const KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const PORT = 10_400 + Math.floor(Math.random() * 500);
const ENDPOINT = `http://127.0.0.1:${PORT}/${ACCOUNT}`;
const CONTAINER = 'drive';

let azurite: ChildProcess;
beforeAll(async () => {
  const bin = join(import.meta.dirname, '../../../node_modules/.bin/azurite-blob');
  azurite = spawn(bin, ['--blobHost', '127.0.0.1', '--blobPort', String(PORT), '--inMemoryPersistence', '--silent', '--skipApiVersionCheck'], { stdio: 'ignore' });
  for (let tries = 0; ; tries++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`);
      break;
    } catch {
      if (tries > 100) throw new Error('Azurite did not start.');
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  // The container, made with an address of the account signed to make one.
  const version = '2024-11-04';
  const start = new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const expiry = new Date(Date.now() + 600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const toSign = [ACCOUNT, 'c', 'b', 'c', start, expiry, '', '', version, '', ''].join('\n');
  const sig = createHmac('sha256', Buffer.from(KEY, 'base64')).update(toSign).digest('base64');
  const query = new URLSearchParams({ restype: 'container', sv: version, ss: 'b', srt: 'c', sp: 'c', st: start, se: expiry, sig });
  const made = await fetch(`${ENDPOINT}/${CONTAINER}?${query}`, { method: 'PUT', headers: { 'x-ms-version': version } });
  if (!made.ok) throw new Error(`The container was not made: ${made.status} ${await made.text()}`);
}, 30_000);
afterAll(() => {
  azurite?.kill();
});

const bytes = (size: number, seed: number) => Uint8Array.from({ length: size }, (_, i) => (i * 7 + seed) % 253);
/** Bytes told apart by their length and SHA-256: a diff of millions of them is too large to print. */
const sum = (of: Uint8Array) => `${of.length}:${createHash('sha256').update(of).digest('hex')}`;

function drive() {
  const storage = azureStorage({ account: ACCOUNT, key: KEY, container: CONTAINER, endpoint: ENDPOINT, prefix: `t${Math.random().toString(36).slice(2)}/` });
  const handle = createDriveHandler({ storage, metadata: memoryMetadata(), identify: () => ({ id: 'ana' }), authorize: () => true, secret: 'u', base: '/api/files' });
  // What goes to Azure is counted, by the bytes each PUT sends.
  const sent: number[] = [];
  const route: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://drive.test/')) return handle(new Request(url, init));
    if (init?.method === 'PUT' && init.body instanceof Blob) sent.push(init.body.size);
    return fetch(input, init);
  };
  const client = createDriveClient({ base: 'http://drive.test/api/files', fetch: route, remember: null });
  const read = async (file: FileEntry) => new Uint8Array(await (await fetch(await client.url(file.id))).arrayBuffer());
  return { storage, handle, client, sent, read };
}

describe('Azure Blob Storage, against Azurite', () => {
  it('takes a small file and one in parts straight from the client, and gives them back whole', async () => {
    const { client, read } = drive();
    const small = await client.upload(new File([bytes(1000, 1)], 'note.txt', { type: 'text/plain' }));
    expect(sum(await read(small))).toBe(sum(bytes(1000, 1)));
    const large = await client.upload(new File([bytes(PART_SIZE * 2 + 1234, 2)], 'video.bin'));
    expect(large.versions[0].size).toBe(PART_SIZE * 2 + 1234);
    expect(sum(await read(large))).toBe(sum(bytes(PART_SIZE * 2 + 1234, 2)));
    // As an attachment, with its name and type.
    const answer = await fetch(await client.url(small.id));
    expect(answer.headers.get('content-disposition')).toContain('note.txt');
    expect(answer.headers.get('content-type')).toBe('text/plain');
  }, 60_000);

  it('sends a new version with only the part that changed, the rest copied in Azure', async () => {
    const { client, sent, read } = drive();
    const first = bytes(PART_SIZE * 3, 3);
    const file = await client.upload(new File([first], 'big.bin'), { partHashes: true });
    sent.length = 0;
    const second = first.slice();
    second[PART_SIZE + 10] ^= 0xff;
    const changed = await client.upload(new File([second], 'big.bin'), { file: file.id, partHashes: true });
    expect(sent).toEqual([PART_SIZE]);
    expect(sum(await read(changed))).toBe(sum(second));
  }, 60_000);

  it('goes on with an upload cut, sending only what had not arrived', async () => {
    const { handle } = drive();
    const ask = async (path: string, body: unknown) =>
      (await handle(new Request(`http://drive.test/api/files${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))).json();
    const whole = bytes(PART_SIZE * 2, 4);
    const start = await ask('/uploads', { name: 'cut.bin', parent: null, type: 'application/octet-stream', size: whole.length });
    const [one] = start.parts;
    expect((await fetch(one.url, { method: 'PUT', body: whole.slice(one.from, one.to) })).ok).toBe(true);
    const resumed = await ask('/uploads/resume', { token: start.token });
    expect(resumed.done.map((part: { number: number }) => part.number)).toEqual([1]);
    expect(resumed.parts.map((part: { number: number }) => part.number)).toEqual([2]);
    const [two] = resumed.parts;
    await fetch(two.url, { method: 'PUT', body: whole.slice(two.from, two.to) });
    const finished = await ask('/uploads/finish', { token: start.token, parts: [...resumed.done, { number: 2, etag: '' }] });
    expect(finished.entry.versions[0].size).toBe(whole.length);
  }, 60_000);

  it('copies a file in Azure itself, a block at a time, its type kept', async () => {
    const { client, read } = drive();
    const whole = bytes(PART_SIZE + 777, 5);
    const file = await client.upload(new File([whole], 'report.bin', { type: 'application/x-report' }));
    const copy = await client.copy(file.id);
    expect(copy.name).toBe('report (2).bin');
    expect(sum(await read(copy))).toBe(sum(whole));
    expect((await fetch(await client.url(copy.id))).headers.get('content-type')).toBe('application/x-report');
  }, 60_000);

  it('reads and writes as the server asks, and deletes what it is told to', async () => {
    const { storage } = drive();
    await storage.write!('made/page.txt', new TextEncoder().encode('hello azure'), 'text/plain');
    expect(new TextDecoder().decode(await storage.read!('made/page.txt', { from: 6, to: 11 }))).toBe('azure');
    await storage.remove(['made/page.txt', 'never/there']);
    await expect(storage.read!('made/page.txt')).rejects.toThrow(/nothing at/);
  });
});
