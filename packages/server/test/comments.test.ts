// Comments through the routes, as two people would make them; a legal hold
// and the days things are kept; and everything of a person, exported.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Comment, Entry } from '@rebofiles/core';
import { type DriveServerOptions, byRoles, createDriveHandler, diskStorage, memoryMetadata, sqliteMetadata } from '../src';
import { bytesOf, client } from './helpers';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-comments-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const identify = (request: Request) => {
  const id = request.headers.get('x-user');
  return id ? { id, admin: id === 'ana' } : null;
};
let clock = Date.parse('2026-10-26T10:00:00Z');
const drive = (extra: Partial<DriveServerOptions> = {}) =>
  createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    identify,
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    now: () => new Date((clock += 1000)),
    ...extra,
  });

describe.each([
  ['in memory', () => memoryMetadata()],
  ['on SQLite', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
])('comments, %s', (_, store) => {
  it('are made by who may comment, replied to under their thread, resolved, changed by their author and taken back', async () => {
    const mentioned: string[][] = [];
    const handle = drive({ metadata: await store(), onComment: ({ mentions }) => void mentioned.push(mentions) });
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const carl = client(handle, 'carl');
    const plan = (await ana.ask('POST', '/api/files/folders', { name: 'Plan', parent: null })).body.entry;
    await ana.ask('POST', `/api/files/entries/${plan.id}/shares`, { with: 'bea', role: 'commenter' });
    await ana.ask('POST', `/api/files/entries/${plan.id}/shares`, { with: 'carl', role: 'viewer' });

    const first = (await bea.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: '  Can @ana look at this, with @carl?  ' })).body.comment as unknown as Comment;
    expect(first).toMatchObject({ entry: plan.id, by: 'bea', text: 'Can @ana look at this, with @carl?' });
    expect((await carl.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: 'Me too' })).status).toBe(403);
    expect((await bea.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: '   ' })).body).toMatchObject({ error: 'invalid-comment' });
    const reply = (await ana.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: 'Done.', replyTo: first.id })).body.comment as unknown as Comment;
    // A reply to a reply goes under the first of the thread.
    const again = (await bea.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: 'Thanks', replyTo: reply.id })).body.comment as unknown as Comment;
    expect(again.replyTo).toBe(first.id);
    const other = (await ana.ask('POST', `/api/files/entries/${plan.id}/comments`, { text: 'Another thing' })).body.comment as unknown as Comment;

    const read = async () => ((await carl.ask('GET', `/api/files/entries/${plan.id}/comments`)).body.comments as unknown as Comment[]).map((c) => `${c.by}: ${c.text}`);
    expect(await read()).toEqual(['bea: Can @ana look at this, with @carl?', 'ana: Done.', 'bea: Thanks', 'ana: Another thing']);
    expect(mentioned[0]).toEqual(['ana', 'carl']);

    expect((await ana.ask('PATCH', `/api/files/entries/${plan.id}/comments/${first.id}`, { text: 'Not mine' })).status).toBe(403);
    expect((await bea.ask('PATCH', `/api/files/entries/${plan.id}/comments/${first.id}`, { text: 'Can @ana look?' })).body.comment).toMatchObject({
      text: 'Can @ana look?',
      edited: expect.any(String),
    });
    expect((await bea.ask('PATCH', `/api/files/entries/${plan.id}/comments/${first.id}`, { resolved: true })).body.comment).toMatchObject({ resolved: { by: 'bea' } });
    expect((await carl.ask('PATCH', `/api/files/entries/${plan.id}/comments/${first.id}`, { resolved: false })).status).toBe(403);

    // Taken back by its author, its replies with it; another's by who may share, the owner.
    expect((await carl.ask('DELETE', `/api/files/entries/${plan.id}/comments/${other.id}`)).status).toBe(403);
    expect((await bea.ask('DELETE', `/api/files/entries/${plan.id}/comments/${first.id}`)).status).toBe(200);
    expect(await read()).toEqual(['ana: Another thing']);
    expect((await ana.ask('DELETE', `/api/files/entries/${plan.id}/comments/${other.id}`)).status).toBe(200);
    expect(await read()).toEqual([]);

    // In the activity of what it is on.
    const activity = (await ana.ask('GET', `/api/files/entries/${plan.id}/activity`)).body.activity as unknown as { action: string }[];
    expect(activity.filter((a) => a.action === 'commented')).toHaveLength(4);
  });

  it('go with what they are on when it is deleted for good', async () => {
    const metadata = await store();
    const handle = drive({ metadata });
    const ana = client(handle, 'ana');
    const old = (await ana.ask('POST', '/api/files/folders', { name: 'Old', parent: null })).body.entry;
    await ana.ask('POST', `/api/files/entries/${old.id}/comments`, { text: 'Bye' });
    await ana.ask('POST', `/api/files/entries/${old.id}/trash`);
    await ana.ask('DELETE', `/api/files/entries/${old.id}`);
    if (metadata.comments) expect(await metadata.comments(old.id)).toEqual([]);
  });
});

describe('a legal hold', () => {
  it('is put by who may configure, and keeps what is under it from the trash and from being deleted, until released', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const caseFolder = (await ana.ask('POST', '/api/files/folders', { name: 'Case 42', parent: null })).body.entry;
    const file = (await ana.upload(bytesOf(4), { name: 'mail.eml', parent: caseFolder.id }, (url, init) => handle(new Request(url, init)))).body.entry;
    await ana.ask('POST', `/api/files/entries/${caseFolder.id}/shares`, { with: 'bea', role: 'editor' });
    expect((await bea.ask('PUT', `/api/files/entries/${caseFolder.id}/hold`, { reason: 'Case 42' })).status).toBe(403);
    expect((await ana.ask('PUT', `/api/files/entries/${caseFolder.id}/hold`, { reason: 'Case 42' })).body.entry).toMatchObject({ hold: { by: 'ana', reason: 'Case 42' } });
    expect((await bea.ask('POST', `/api/files/entries/${file.id}/trash`)).body).toMatchObject({ error: 'on-hold' });
    expect((await ana.ask('POST', `/api/files/entries/${caseFolder.id}/trash`)).status).toBe(409);
    // A new version may still come; the old one stays.
    expect((await bea.upload(bytesOf(6), { file: file.id }, (url, init) => handle(new Request(url, init)))).status).toBe(200);
    await ana.ask('DELETE', `/api/files/entries/${caseFolder.id}/hold`);
    expect((await bea.ask('POST', `/api/files/entries/${file.id}/trash`)).status).toBe(200);
    const actions = ((await ana.ask('GET', `/api/files/entries/${caseFolder.id}/activity`)).body.activity as unknown as { action: string }[]).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['held', 'released']));
  });

  it('and a minimum of days keep what is younger from being deleted for good, by anyone or by the trash', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    await ana.ask('PUT', '/api/files/settings', { retentionDays: 30 });
    const young = (await ana.ask('POST', '/api/files/folders', { name: 'Young', parent: null })).body.entry;
    await ana.ask('POST', `/api/files/entries/${young.id}/trash`);
    expect((await ana.ask('DELETE', `/api/files/entries/${young.id}`)).body).toMatchObject({ error: 'retained' });
    expect((await ana.ask('POST', '/api/files/trash/empty')).body).toEqual({ removed: [] });
    clock += 31 * 86_400_000;
    expect((await ana.ask('POST', '/api/files/trash/empty')).body).toEqual({ removed: [young.id] });
  });
});

describe('what is exported of a person', () => {
  it('is what they own, as an archive holds it, what they said and did, and their settings; another’s only for who may configure', async () => {
    const handle = drive();
    const ana = client(handle, 'ana');
    const bea = client(handle, 'bea');
    const docs = (await bea.ask('POST', '/api/files/folders', { name: 'Docs', parent: null })).body.entry;
    await bea.upload(bytesOf(9), { name: 'cv.pdf', parent: docs.id }, (url, init) => handle(new Request(url, init)));
    await bea.ask('POST', `/api/files/entries/${docs.id}/comments`, { text: 'Mine' });
    await bea.ask('PUT', '/api/files/settings/mine', { language: 'es' });
    await ana.ask('POST', '/api/files/folders', { name: 'Not Bea’s', parent: null });

    const mine = (await bea.ask('GET', '/api/files/export')).body as unknown as {
      person: string;
      pack: { files: { path: string }[]; folders: string[] };
      entries: Entry[];
      comments: Comment[];
      activity: { action: string }[];
      settings: unknown;
    };
    expect(mine.person).toBe('bea');
    expect(mine.pack.files.map((f) => f.path)).toEqual(['Docs/cv.pdf']);
    expect(mine.entries.map((e) => e.name).sort()).toEqual(['Docs', 'cv.pdf']);
    expect(mine.comments.map((c) => c.text)).toEqual(['Mine']);
    expect(mine.activity.map((a) => a.action)).toEqual(['commented', 'uploaded', 'created']);
    expect(mine.settings).toEqual({ language: 'es' });
    expect((await bea.ask('GET', '/api/files/export?user=ana')).status).toBe(403);
    expect((await ana.ask('GET', '/api/files/export?user=bea')).body.person).toBe('bea');
  });
});
