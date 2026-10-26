// Files going up a few at once: no more than so many at a time, the next when
// one is done; how fast each goes and how long it has left, and all together;
// one stopped, one tried again; and how long that is, said as a person says it.

import { describe, expect, it } from 'vitest';
import type { DriveClient, UploadOptions } from '../src/client';
import { createUploads, formatDuration } from '../src/uploads';

/** A client whose uploads go as the test says: each waits until it is told how far it is, or that it is done. */
function slowClient() {
  const going = new Map<string, { options: UploadOptions; done: () => void; fail: (error: Error) => void }>();
  const client = {
    upload: (file: File, options: UploadOptions) =>
      new Promise((done, fail) => {
        going.set(file.name, { options, done: () => done({ id: file.name, name: file.name }), fail });
        options.signal?.addEventListener('abort', () => fail(new DOMException('stopped', 'AbortError')));
      }),
  } as unknown as DriveClient;
  return { client, going };
}
const file = (name: string, size: number) => new File([new Uint8Array(size)], name);
const tick = () => new Promise((done) => setTimeout(done, 0));

describe('files going up', () => {
  it('go no more than so many at a time, the next when one is done', async () => {
    const { client, going } = slowClient();
    const done: string[] = [];
    const uploads = createUploads(client, { parallel: 2, onChange: () => undefined, onDone: (entry) => done.push(entry.name) });
    uploads.add([file('a', 10), file('b', 10), file('c', 10)], null);
    expect([...going.keys()]).toEqual(['a', 'b']);
    expect(uploads.summary()).toMatchObject({ sending: 2, waiting: 1 });
    going.get('a')!.done();
    await tick();
    expect([...going.keys()]).toEqual(['a', 'b', 'c']);
    expect(done).toEqual(['a']);
    expect(uploads.items.map((item) => item.state)).toEqual(['done', 'sending', 'sending']);
  });

  it('say how fast each goes and how long it has left, and all of them together', async () => {
    let now = 0;
    const { client, going } = slowClient();
    const uploads = createUploads(client, { parallel: 2, onChange: () => undefined, now: () => now });
    uploads.add([file('a', 10_000_000), file('b', 4_000_000)], null);
    now = 1000;
    going.get('a')!.options.onProgress!({ sent: 1_000_000, size: 10_000_000 });
    going.get('b')!.options.onProgress!({ sent: 1_000_000, size: 4_000_000 });
    const [a, b] = uploads.items;
    expect(a.speed).toBe(1_000_000);
    expect(a.remaining).toBe(9);
    expect(b.remaining).toBe(3);
    // 12 MB to go, at 2 MB a second together.
    expect(uploads.summary().remaining).toBe(6);
    // Faster: followed, not jumped to.
    now = 2000;
    going.get('a')!.options.onProgress!({ sent: 4_000_000, size: 10_000_000 });
    expect(uploads.items[0].speed).toBeCloseTo(1_000_000 * 0.7 + 3_000_000 * 0.3);
  });

  it('stop one going or waiting, and send again one stopped or failed', async () => {
    const { client, going } = slowClient();
    const uploads = createUploads(client, { parallel: 1, onChange: () => undefined });
    uploads.add([file('a', 10), file('b', 10)], null);
    uploads.stop(2);
    expect(uploads.items[1].state).toBe('stopped');
    uploads.stop(1);
    await tick();
    expect(uploads.items.map((item) => item.state)).toEqual(['stopped', 'stopped']);
    uploads.retry(1);
    expect(uploads.items[0].state).toBe('sending');
    going.get('a')!.fail(new Error('The part could not be sent.'));
    await tick();
    expect(uploads.items[0]).toMatchObject({ state: 'failed', error: 'The part could not be sent.' });
    uploads.clear();
    expect(uploads.items).toEqual([]);
  });

  it('say how long, as a person says it', () => {
    expect(formatDuration(4.2, 'en')).toBe('5 sec');
    expect(formatDuration(150, 'en')).toBe('3 min');
    expect(formatDuration(4980, 'en')).toBe('1 hr 23 min');
    expect(formatDuration(7200, 'es')).toBe('2 h');
  });
});
