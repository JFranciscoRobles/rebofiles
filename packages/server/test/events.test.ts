// What changes, told as it happens at /events: to whom, of what, from this
// process and from another on the same store; and the client that watches,
// coming back after a cut.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveClient, type DriveEvent } from '@rebofiles/drive';
import { type DriveServerOptions, byRoles, createDriveHandler, diskStorage, memoryMetadata, sqliteMetadata } from '../src';
import { client } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-events-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const options = (extra: Partial<DriveServerOptions> = {}): DriveServerOptions => ({
  storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
  metadata: memoryMetadata(),
  identify,
  authorize: byRoles,
  secret: 'u',
  base: '/api/files',
  ...extra,
});

/** Watching as `who`: every event that comes, and a stop. */
function watching(handle: (request: Request) => Promise<Response>, who: string) {
  const events: DriveEvent[] = [];
  const stop = new AbortController();
  const opened = handle(new Request('http://drive.test/api/files/events', { headers: { 'x-user': who }, signal: stop.signal })).then(async (answer) => {
    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    const reader = answer.body!.pipeThrough(new TextDecoderStream()).getReader();
    let held = '';
    void (async () => {
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done) return;
        held += value;
        for (let end = held.indexOf('\n\n'); end >= 0; end = held.indexOf('\n\n')) {
          const block = held.slice(0, end);
          held = held.slice(end + 2);
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (/^event: change$/m.test(block) && data) events.push(JSON.parse(data));
        }
      }
    })();
  });
  return { events, opened, stop: () => stop.abort() };
}

const until = async (ok: () => boolean, ms = 3000) => {
  for (const start = Date.now(); !ok(); ) {
    if (Date.now() - start > ms) throw new Error('It did not come.');
    await new Promise((done) => setTimeout(done, 20));
  }
};

describe('the events', () => {
  it('tells each one what changed of what they may see, and nothing of the rest', async () => {
    const handle = createDriveHandler(options());
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const shared = (await ana.ask('POST', '/api/files/folders', { name: 'Shared', parent: null })).body.entry;
    await ana.ask('POST', `/api/files/entries/${shared.id}/shares`, { with: 'bea', role: 'editor' });
    const anas = watching(handle, 'ana');
    const beas = watching(handle, 'bea');
    await Promise.all([anas.opened, beas.opened]);

    const plan = (await bea.ask('POST', '/api/files/folders', { name: 'Plan', parent: shared.id })).body.entry;
    await until(() => anas.events.length === 1 && beas.events.length === 1);
    expect(anas.events[0]).toMatchObject({ by: 'bea', folders: [shared.id], entries: [plan.id] });

    // Ana's own, at the top: not Bea's to see.
    await ana.ask('POST', '/api/files/folders', { name: 'Private', parent: null });
    await until(() => anas.events.length === 2);
    await new Promise((done) => setTimeout(done, 100));
    expect(beas.events).toHaveLength(1);
    expect(anas.events[1]).toMatchObject({ by: 'ana', folders: [null] });

    // Ana's moved out of what is shared: Bea is told where it went from, not where to, nor what it is.
    const note = (await ana.ask('POST', '/api/files/folders', { name: 'Note', parent: shared.id })).body.entry;
    await until(() => beas.events.length === 2);
    await ana.ask('PATCH', `/api/files/entries/${note.id}`, { parent: null });
    await until(() => beas.events.length === 3);
    expect(beas.events[2]).toMatchObject({ folders: [shared.id], entries: [] });
    // Bea's own, moved to the top by Ana: there in Bea's My files.
    await ana.ask('PATCH', `/api/files/entries/${plan.id}`, { parent: null });
    await until(() => beas.events.length === 4);
    expect(beas.events[3]).toMatchObject({ folders: [null, shared.id], entries: [plan.id] });
    anas.stop();
    beas.stop();
  });

  it('tells what another process changed on the same store', async () => {
    const path = join(folder, `${Math.random()}.sqlite`);
    const shared = { storage: diskStorage({ folder: join(folder, 'two'), secret: 's' }), authorize: () => true, live: { poll: 50 } };
    const one = createDriveHandler(options({ ...shared, metadata: await sqliteMetadata(path) }));
    const two = createDriveHandler(options({ ...shared, metadata: await sqliteMetadata(path) }));
    const watched = watching(one, 'bea');
    await watched.opened;
    await new Promise((done) => setTimeout(done, 100));
    const made = (await client(two, 'bea').ask('POST', '/api/files/folders', { name: 'From the other', parent: null })).body.entry;
    await until(() => watched.events.length === 1);
    expect(watched.events[0]).toMatchObject({ by: null, folders: [null], entries: [made.id] });
    watched.stop();
  });

  it('is not there when the server says none', async () => {
    const handle = createDriveHandler(options({ live: false }));
    expect((await handle(new Request('http://drive.test/api/files/events', { headers: { 'x-user': 'ana' } }))).status).toBe(404);
  });

  it('is watched by the client, which comes back after a cut', async () => {
    const handle = createDriveHandler(options({ authorize: () => true }));
    let cut: AbortController | undefined;
    let opened = 0;
    const drive = createDriveClient({
      base: 'http://drive.test/api/files',
      headers: () => ({ 'x-user': 'ana' }),
      retry: { delay: 10 },
      fetch: async (url, init = {}) => {
        if (String(url).endsWith('/events')) {
          opened++;
          // Each watch cut from here, as a network would cut it.
          cut = new AbortController();
          const both = AbortSignal.any([cut.signal, ...(init.signal ? [init.signal] : [])]);
          return handle(new Request(String(url), { ...init, signal: both }));
        }
        return handle(new Request(String(url), init));
      },
    });
    const seen: DriveEvent[] = [];
    const states: boolean[] = [];
    const stop = drive.watch((event) => seen.push(event), { onState: (watching) => states.push(watching) });
    await until(() => states[0] === true);
    await drive.createFolder('One', null);
    await until(() => seen.length === 1);
    cut!.abort();
    await until(() => states.length === 3 && opened === 2, 5000);
    expect(states).toEqual([true, false, true]);
    await drive.createFolder('Two', null);
    await until(() => seen.length === 2);
    stop();
  });
});
