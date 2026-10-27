// What a request for files asks and does: its name asked first, only what it
// takes, documents one by one, a folder for each who sends, names of a
// pattern and fields of the application's; what came counted on it, taken
// back by who sent it, closed when all came; and looked at by its owner.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveClient, createLinkClient } from '@rebofiles/drive';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-asks-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const pdf = (text: string, name: string) => new File([`%PDF-1.4 ${text}`], name, { type: 'application/pdf' });

function drive() {
  const seen: { received: string[]; reviews: string[] } = { received: [], reviews: [] };
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' }),
    metadata: memoryMetadata(),
    identify: (request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')!, admin: request.headers.get('x-user') === 'ana' } : null),
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    onReceived: ({ entry, from, item }) => void seen.received.push(`${entry.name} · ${from} · ${item}`),
    onReview: ({ entry, status, reason }) => void seen.reviews.push(`${entry.name} · ${status} · ${reason ?? ''}`),
  });
  const route: typeof fetch = (input, init) => handle(new Request(new URL(String(input), 'http://drive.test').toString(), init));
  const ana = createDriveClient({ base: 'http://drive.test/api/files', headers: () => ({ 'x-user': 'ana' }), fetch: route, remember: null });
  const guest = (token: string, from?: string) => createLinkClient({ base: 'http://drive.test/api/files', token, fetch: route, from: () => from, remember: null });
  return { ana, guest, seen };
}

describe('a request for files', () => {
  it('asks its name first, takes only what it says, and puts each document in its place', async () => {
    const { ana, guest, seen } = drive();
    const box = await ana.createFolder('Contracts', null);
    const { token } = await ana.createLink(box.id, 7, {
      uploads: 'only',
      request: {
        title: 'Northwind',
        message: 'Send what is missing, please.',
        askName: true,
        email: 'carla@northwind.test',
        items: [
          { id: 'contract', label: 'Signed contract' },
          { id: 'id', label: 'ID' },
        ],
        perSender: true,
        rename: '{item} - {name}',
        fields: { client: 'northwind' },
        accept: ['application/pdf', 'image/*'],
        maxSize: 1000,
        closeWhenDone: true,
      },
    });
    const listed = await guest(token).list();
    expect(listed.link?.request).toMatchObject({
      title: 'Northwind',
      message: 'Send what is missing, please.',
      askName: true,
      maxSize: 1000,
      items: [
        { id: 'contract', label: 'Signed contract', received: 0 },
        { id: 'id', received: 0 },
      ],
    });
    await expect(guest(token).upload(pdf('x', 'a.pdf'), { item: 'contract' })).rejects.toMatchObject({ code: 'name-needed' });
    await expect(guest(token, 'Carla').upload(new File(['x'], 'notes.txt', { type: 'text/plain' }))).rejects.toMatchObject({ code: 'not-accepted' });
    await expect(guest(token, 'Carla').upload(new File([new Uint8Array(2000)], 'big.pdf', { type: 'application/pdf' }))).rejects.toMatchObject({ code: 'too-large' });
    await expect(guest(token, 'Carla').upload(pdf('x', 'a.pdf'), { item: 'nothing' })).rejects.toMatchObject({ code: 'no-item' });

    let receipt = '';
    const sent = await guest(token, 'Carla').upload(pdf('signed', 'scan.pdf'), { item: 'contract', onReceipt: (given) => (receipt = given) });
    expect(sent.name).toBe('Signed contract - Carla.pdf');
    expect(sent.fields).toEqual({ client: 'northwind', via: 'request', request: expect.any(String), from: 'Carla', item: 'Signed contract' });
    expect(receipt).not.toBe('');
    // In a folder of her own, inside the link's.
    const theirs = (await ana.list(box.id)).entries;
    expect(theirs.map((entry) => `${entry.kind} ${entry.name}`)).toEqual(['folder Carla']);
    expect(sent.parent).toBe(theirs[0].id);
    expect((await guest(token, 'Carla').list()).link?.request?.items?.[0].received).toBe(1);
    expect(seen.received).toEqual(['Signed contract - Carla.pdf · Carla · Signed contract']);

    // Taken back a moment after: gone, and wanted again.
    await guest(token, 'Carla').takeBack(receipt);
    expect((await ana.list(theirs[0].id)).entries).toEqual([]);
    expect((await guest(token, 'Carla').list()).link?.request?.items?.[0].received).toBe(0);

    // Both documents: the request has all it asked for, and closes.
    await guest(token, 'Carla').upload(pdf('signed', 'scan.pdf'), { item: 'contract' });
    await guest(token, 'Carla').upload(new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' }), { item: 'id' });
    await expect(guest(token, 'Carla').list()).rejects.toMatchObject({ status: 410, code: 'request-closed' });
    const [request] = await ana.requests();
    expect(request.link).toMatchObject({ closed: expect.any(String), got: { files: 2, items: { contract: 1, id: 1 }, from: ['Carla'] } });
    // Opened again by its owner.
    await ana.updateLink(box.id, request.link.id, { closed: false });
    expect((await guest(token, 'Carla').list()).link?.request?.items?.map((one) => one.received)).toEqual([1, 1]);
  });

  it('lets its owner look at what came: accepted, or turned back with a reason; and lists what is missing for reminders', async () => {
    const { ana, guest, seen } = drive();
    const box = await ana.createFolder('Suppliers', null);
    const { token } = await ana.createLink(box.id, 7, {
      uploads: 'only',
      request: {
        email: 'tomas@acme.test',
        items: [
          { id: 'd1', label: 'Bank details' },
          { id: 'd2', label: 'Tax id' },
        ],
        maxFiles: 5,
      },
    });
    const came = await guest(token, 'Tomás').upload(pdf('bank', 'bank.pdf'), { item: 'd1' });
    expect((await ana.received()).map((entry) => entry.name)).toEqual(['bank.pdf']);
    const turned = await ana.review(came.id, 'rejected', 'It is blurry.');
    expect(turned.fields).toMatchObject({ review: 'rejected', reviewReason: 'It is blurry.' });
    expect((await ana.review(came.id, 'accepted')).fields).toMatchObject({ review: 'accepted' });
    expect((await ana.review(came.id, 'accepted')).fields?.reviewReason).toBeUndefined();
    await expect.poll(() => seen.reviews).toEqual(['bank.pdf · rejected · It is blurry.', 'bank.pdf · accepted · ', 'bank.pdf · accepted · ']);
    // For reminders: whom each request was sent to, and what is still missing.
    const due = await ana.adminRequests();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ folder: { name: 'Suppliers', owner: 'ana' }, link: { request: { email: 'tomas@acme.test' } }, missing: [{ id: 'd2', label: 'Tax id' }] });
  });
});
