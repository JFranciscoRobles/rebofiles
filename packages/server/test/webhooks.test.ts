// Changes told over HTTP: each POSTed as JSON, signed so the service can tell
// it is the drive's, tried again when it does not arrive, not when refused,
// only the actions asked for; and a delivery checked by the one told.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveHandler, diskStorage, everyChange, memoryMetadata, verifyWebhook, webhook } from '../src';
import { client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-hooks-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('a webhook', () => {
  it('tells each change, signed, and the service checks it', async () => {
    const told: { body: string; headers: Headers }[] = [];
    const service: typeof fetch = async (_url, init) => {
      told.push({ body: String(init?.body), headers: new Headers(init?.headers) });
      return new Response('ok');
    };
    const seen: string[] = [];
    const handle = createDriveHandler({
      storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
      metadata: memoryMetadata(),
      identify: () => ({ id: 'ana' }),
      authorize: () => true,
      secret: 'u',
      base: '/api/files',
      onChange: everyChange(webhook({ url: 'https://crm.test/hooks', secret: 'shh', actions: ['created', 'renamed'], fetch: service }), ({ activity }) => void seen.push(activity.action)),
    });
    const ana = client(handle, 'ana');
    const made = (await ana.ask('POST', '/api/files/folders', { name: 'Acme', parent: null })).body.entry;
    await ana.ask('PATCH', `/api/files/entries/${made.id}`, { color: 'blue' });
    await ana.ask('PATCH', `/api/files/entries/${made.id}`, { name: 'Acme Ltd' });
    await expect.poll(() => told.length).toBe(2);
    expect(seen).toEqual(['created', 'colored', 'renamed']);
    const [first, second] = told.map((one) => ({ ...one, json: JSON.parse(one.body) }));
    expect(first.json).toMatchObject({ action: 'created', by: 'ana', entry: { id: made.id, name: 'Acme', kind: 'folder', parent: null } });
    expect(second.json).toMatchObject({ action: 'renamed', entry: { name: 'Acme Ltd' } });
    expect(first.headers.get('x-rebofiles-event')).toBe('created');
    expect(verifyWebhook('shh', first.body, first.headers)).toBe(true);
    expect(verifyWebhook('other', first.body, first.headers)).toBe(false);
    expect(verifyWebhook('shh', first.body.replace('Acme', 'Evil'), first.headers)).toBe(false);
  });

  it('is tried again when it does not arrive, the same delivery, and not when refused', async () => {
    const tries: string[] = [];
    let answers = [503, 200];
    const service: typeof fetch = async (_url, init) => {
      tries.push(new Headers(init?.headers).get('x-rebofiles-delivery')!);
      return new Response(null, { status: answers.shift() ?? 200 });
    };
    const activity = { action: 'uploaded' as const, kind: 'file' as const, name: 'a.txt', by: 'ana', at: new Date().toISOString(), entry: 'a', parent: null };
    await webhook({ url: 'https://crm.test', secret: 's', fetch: service })({ activity, entry: null });
    expect(tries).toHaveLength(2);
    expect(tries[0]).toBe(tries[1]);

    tries.length = 0;
    answers = [400, 200];
    const failed: string[] = [];
    await expect(webhook({ url: 'https://crm.test', secret: 's', fetch: service, onFailure: (error) => failed.push(error.message) })({ activity, entry: null })).rejects.toThrow('400');
    expect(tries).toHaveLength(1);
    expect(failed).toEqual(['https://crm.test answered 400.']);
  }, 10_000);

  it('older than the tolerance is not taken', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyWebhook('s', '{}', { 'x-rebofiles-timestamp': old, 'x-rebofiles-signature': 'sha256=00' })).toBe(false);
  });
});
