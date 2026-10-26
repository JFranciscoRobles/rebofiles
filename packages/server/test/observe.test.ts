// What the server says of itself and how much it lets each one ask: onChange
// for each thing done, a logger of its own, a word after every request, and
// limits by person, by link and by address.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Activity, Entry } from '@rebofiles/core';
import { type DriveServerOptions, type MeterLike, type RequestDone, createDriveHandler, diskStorage, memoryLimiter, memoryMetadata, openTelemetry } from '../src';
import { bytesOf, client } from './helpers';

const identify = (request: Request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')! } : null);

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-observe-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const drive = (extra: Partial<DriveServerOptions> = {}) =>
  createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    identify,
    authorize: () => true,
    secret: 'u',
    base: '/api/files',
    ...extra,
  });
const settle = () => new Promise((done) => setTimeout(done, 20));

describe('onChange', () => {
  it('is told each thing done, with the entry as it is after, and its failure is not the request’s', async () => {
    const told: { activity: Activity; entry: Entry | null }[] = [];
    const errors: string[] = [];
    const handle = drive({
      onChange: (event) => {
        told.push(event);
        if (event.activity.action === 'renamed') throw new Error('the webhook is down');
      },
      logger: { error: (message) => errors.push(message), warn: () => undefined },
    });
    const { ask, upload } = client(handle);
    const folderMade = (await ask('POST', '/api/files/folders', { name: 'Clients', parent: null })).body.entry;
    const file = (await upload(bytesOf(10), { name: 'a.txt', parent: folderMade.id }, (url, init) => handle(new Request(url, init)))).body.entry;
    expect((await ask('PATCH', `/api/files/entries/${file.id}`, { name: 'b.txt' })).status).toBe(200);
    await ask('POST', `/api/files/entries/${folderMade.id}/trash`);
    await ask('DELETE', `/api/files/entries/${folderMade.id}`);
    await settle();
    expect(told.map((e) => `${e.activity.action} ${e.activity.name}`)).toEqual(['created Clients', 'uploaded a.txt', 'renamed b.txt', 'trashed Clients', 'deleted Clients']);
    expect(told[2].entry?.name).toBe('b.txt');
    expect(told[4].entry).toBeNull();
    expect(errors).toEqual(['onChange failed:']);
  });
});

describe('the logger and the metrics', () => {
  it('writes what failed to the logger given, and tells onRequest each route, as the list says it', async () => {
    const done: RequestDone[] = [];
    const errors: [string, unknown][] = [];
    const handle = drive({
      onRequest: (d) => done.push(d),
      logger: { error: (message, detail) => errors.push([message, detail]), warn: () => undefined },
      inspect: () => {
        throw new Error('the scanner is down');
      },
    });
    const { ask, upload } = client(handle);
    const made = (await ask('POST', '/api/files/folders', { name: 'Docs', parent: null })).body.entry;
    await ask('GET', `/api/files/entries/${made.id}`);
    await upload(bytesOf(5), { name: 'x.bin' }, (url, init) => handle(new Request(url, init)));
    await handle(new Request('http://drive.test/api/files/entries'));
    expect(done.map((d) => `${d.route} ${d.status} ${d.user}`)).toEqual([
      'POST /folders 200 ana',
      'GET /entries/:id 200 ana',
      'POST /uploads 200 ana',
      'PUT /bytes 200 null',
      'POST /uploads/finish 503 ana',
      'GET /entries 401 null',
    ]);
    expect(done.every((d) => d.ms >= 0)).toBe(true);
    expect(errors.map(([message]) => message)).toEqual(['not-inspected: The file could not be looked at before it is kept. Try again in a moment.']);
    expect(String(errors[0][1])).toContain('the scanner is down');
  });

  it('counts with OpenTelemetry: each route’s time, and the errors of the server', () => {
    const recorded: [number, Record<string, string | number>][] = [];
    const added: Record<string, string | number>[] = [];
    const meter: MeterLike = {
      createHistogram: () => ({ record: (value, attributes) => recorded.push([value, attributes!]) }),
      createCounter: () => ({ add: (_, attributes) => added.push(attributes!) }),
    };
    const onRequest = openTelemetry(meter);
    onRequest({ method: 'GET', route: 'GET /entries', status: 200, ms: 12, user: 'ana' });
    onRequest({ method: 'POST', route: 'POST /zip', status: 500, ms: 3, user: 'ana' });
    expect(recorded[0]).toEqual([0.012, { 'http.request.method': 'GET', 'http.route': 'GET /entries', 'http.response.status_code': 200 }]);
    expect(added).toEqual([{ 'http.request.method': 'POST', 'http.route': 'POST /zip', 'http.response.status_code': 500 }]);
  });
});

describe('the limits', () => {
  it('refuses past the limit of a person with a 429 and when to try again; another person is not counted', async () => {
    const handle = drive({ limits: { searchText: { max: 2, every: 60_000 } } });
    const ana = client(handle, 'ana');
    expect((await ana.ask('GET', '/api/files/search/text?q=a')).status).toBe(200);
    expect((await ana.ask('GET', '/api/files/search/text?q=a')).status).toBe(200);
    const refused = await handle(new Request('http://drive.test/api/files/search/text?q=a', { headers: { 'x-user': 'ana' } }));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(50);
    expect(((await refused.json()) as { error: string }).error).toBe('rate-limited');
    expect((await client(handle, 'bea').ask('GET', '/api/files/search/text?q=a')).status).toBe(200);
  });

  it('counts the wrong passwords of a link by link and address, and then refuses even the right one, for a while', async () => {
    let clock = 0;
    const handle = drive({ limits: { linkPassword: { max: 3, every: 60_000 } }, limiter: memoryLimiter(() => clock), clientIp: (r) => r.headers.get('x-test-ip') });
    const { ask } = client(handle);
    const made = (await ask('POST', '/api/files/folders', { name: 'Shared', parent: null })).body.entry;
    const { token } = (await ask('POST', `/api/files/entries/${made.id}/links`, { password: 'right one' })).body as unknown as { token: string };
    const open = (password: string, ip = '1.1.1.1') => handle(new Request(`http://drive.test/api/files/links/${token}`, { headers: { 'x-link-password': password, 'x-test-ip': ip } }));
    expect((await open('right one')).status).toBe(200);
    for (const _ of [1, 2, 3]) expect((await open('wrong')).status).toBe(401);
    expect((await open('right one')).status).toBe(429);
    // From another address, the right one still opens it; and after the window, from the first.
    expect((await open('right one', '2.2.2.2')).status).toBe(200);
    clock += 61_000;
    expect((await open('right one')).status).toBe(200);
  }, 10_000);

  it('are none when told so', async () => {
    const handle = drive({ limits: false });
    const ana = client(handle);
    for (let i = 0; i < 5; i++) expect((await ana.ask('POST', '/api/files/zip', { ids: [] })).status).toBe(200);
  });
});
