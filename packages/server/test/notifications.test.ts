// What a person is told: shared with them, or with a group they are in, and
// named in a comment; not what they did themselves; how many are new, and
// none once they looked.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-notices-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const GROUPS: Record<string, string[]> = { bea: ['team'], carl: ['team'] };

describe('notifications', () => {
  it('tell who was shared with, a group too, and who was named; how many are new, and none once seen', async () => {
    const handle = createDriveHandler({
      storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
      metadata: memoryMetadata(),
      identify: (request) => {
        const id = request.headers.get('x-user');
        return id ? { id, groups: GROUPS[id] ?? [] } : null;
      },
      authorize: byRoles,
      secret: 's',
      base: '/api/files',
    });
    const ask = async (who: string, method: string, path: string, body?: unknown) =>
      (
        await handle(
          new Request(`http://drive.test/api/files${path}`, { method, headers: { 'x-user': who, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
        )
      ).json();
    const made = (await ask('ana', 'POST', '/folders', { name: 'Plans', parent: null })).entry;
    await ask('ana', 'POST', `/entries/${made.id}/shares`, { with: 'group:team', role: 'commenter' });
    await ask('ana', 'POST', `/entries/${made.id}/comments`, { text: 'For @bea, and @ana herself.' });

    const bea = await ask('bea', 'GET', '/notifications');
    expect(bea.notifications.map((n: { kind: string }) => n.kind)).toEqual(['mentioned', 'shared']);
    expect(bea.unseen).toBe(2);
    expect((await ask('carl', 'GET', '/notifications')).notifications.map((n: { kind: string }) => n.kind)).toEqual(['shared']);
    expect((await ask('ana', 'GET', '/notifications')).notifications).toEqual([]);
    // Shared again with another role: not told again.
    await ask('ana', 'POST', `/entries/${made.id}/shares`, { with: 'group:team', role: 'editor' });
    expect((await ask('carl', 'GET', '/notifications')).notifications).toHaveLength(1);

    await ask('bea', 'POST', '/notifications/seen');
    expect((await ask('bea', 'GET', '/notifications')).unseen).toBe(0);
    expect((await ask('carl', 'GET', '/notifications')).unseen).toBe(1);
  });
});
