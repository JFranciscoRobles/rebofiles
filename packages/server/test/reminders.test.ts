// What a request for files does besides taking them: kept as a template,
// whoever it was sent to reminded of what is missing, what is written in what
// came checked against what was asked, and what stops being good told before.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriveClient, createLinkClient } from '@rebofiles/drive';
import { type Mail, type MetadataStore, type Reminder, byRoles, createDriveHandler, diskStorage, mailReminders, memoryMetadata, reminderMail, resend, postgresMetadata, sqliteMetadata } from '../src';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-reminders-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const DAY = 86_400_000;
// Today at ten: the tokens of links are sealed by the real clock, so the drive's starts at it.
const START = Math.floor(Date.now() / DAY) * DAY + 10 * 3_600_000;
const dayIn = (days: number) => new Date(START + days * DAY).toISOString().slice(0, 10);

function drive(how: { written?: string; check?: false; metadata?: MetadataStore } = {}) {
  let clock = START;
  const sent: Reminder[] = [];
  const expiring: string[] = [];
  const handle = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 'd' }),
    metadata: how.metadata ?? memoryMetadata(),
    identify: (request) => (request.headers.get('x-user') ? { id: request.headers.get('x-user')!, admin: request.headers.get('x-user') === 'ana' } : null),
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    now: () => new Date(clock),
    reminders: { send: (reminder) => void sent.push(reminder) },
    // What a reader of documents would say is written in each that comes.
    derive: async () => ({ text: how.written ?? '' }),
    ...(how.check === false ? { check: false as const } : {}),
    expiring: { days: 15, onExpiring: ({ entry, days }) => void expiring.push(`${entry.name} · ${days}`) },
  });
  const route: typeof fetch = (input, init) => handle(new Request(new URL(String(input), 'http://drive.test').toString(), init));
  const ana = createDriveClient({ base: 'http://drive.test/api/files', headers: () => ({ 'x-user': 'ana' }), fetch: route, remember: null });
  const guest = (token: string, from?: string) => createLinkClient({ base: 'http://drive.test/api/files', token, fetch: route, from: () => from, remember: null });
  return { ana, guest, sent, expiring, handle, later: (days: number) => (clock += days * DAY) };
}

const pdf = (name: string) => new File(['%PDF-1.4 x'], name, { type: 'application/pdf' });

describe('templates of requests', () => {
  it('are kept in the settings of the drive, checked as a request is', async () => {
    const { ana } = drive();
    const saved = await ana.saveSettings({
      requestTemplates: [{ name: 'Supplier sign-up', request: { title: 'Supplier', items: ['Tax certificate', { label: 'ID', words: ['INE'], expires: true }], remind: 3 } }],
    } as never);
    expect(saved.requestTemplates).toEqual([
      {
        id: 't1',
        name: 'Supplier sign-up',
        request: {
          title: 'Supplier',
          items: [
            { id: 'd1', label: 'Tax certificate' },
            { id: 'd2', label: 'ID', words: ['INE'], expires: true },
          ],
          remind: 3,
        },
      },
    ]);
    expect((await ana.settings()).drive.requestTemplates).toHaveLength(1);
    await expect(ana.saveSettings({ requestTemplates: [{ name: '', request: {} }] } as never)).rejects.toMatchObject({ status: 400 });
    await expect(ana.saveSettings({ requestTemplates: [{ name: 'Bad', request: { items: [{ label: 'X', find: { rfc: '(' } }] } }] } as never)).rejects.toMatchObject({ status: 400 });
  });
});

describe.each([
  ['in memory', async () => memoryMetadata()],
  ['on SQLite, a piece at a time', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
  ['on Postgres, a piece at a time', () => postgresMetadata(new PGlite())],
])('reminders, %s', (_, store) => {
  it('remind whom a request was sent to every so many days, of what is still missing, until it has it all', async () => {
    const { ana, guest, sent, later, handle } = drive({ metadata: await store() });
    expect((await ana.settings()).can).toEqual({ remind: true, expiring: true });
    const box = await ana.createFolder('Northwind', null);
    const { token } = await ana.createLink(box.id, 30, {
      uploads: 'only',
      request: {
        title: 'Northwind',
        email: 'carla@northwind.test',
        items: [
          { id: 'd1', label: 'Contract' },
          { id: 'd2', label: 'ID' },
        ],
        remind: 3,
        closeWhenDone: true,
      },
    });
    later(2);
    await ana.list(null);
    expect(sent).toHaveLength(0);
    later(1.1);
    await ana.list(null);
    await handle.idle();
    await new Promise((done) => setTimeout(done, 20));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ email: 'carla@northwind.test', folder: { name: 'Northwind' }, missing: [{ label: 'Contract' }, { label: 'ID' }], token, language: 'en' });
    // Not again before the next three days, though the drive is looked at again.
    later(0.5);
    await ana.list(null);
    await new Promise((done) => setTimeout(done, 20));
    expect(sent).toHaveLength(1);

    await guest(token).upload(pdf('contract.pdf'), { item: 'd1' });
    later(3);
    await ana.list(null);
    await new Promise((done) => setTimeout(done, 20));
    expect(sent).toHaveLength(2);
    expect(sent[1].missing.map((item) => item.label)).toEqual(['ID']);

    // And at once, from the drive.
    const link = (await ana.requests())[0].link;
    const reminded = await ana.remind(box.id, link.id);
    expect(reminded.links?.[0].reminded).toBeDefined();
    expect(sent).toHaveLength(3);

    await guest(token).upload(pdf('id.pdf'), { item: 'd2' });
    later(10);
    await ana.list(null);
    await new Promise((done) => setTimeout(done, 20));
    expect(sent).toHaveLength(3);
    await expect(ana.remind(box.id, link.id)).rejects.toMatchObject({ code: 'closed' });
  });

  it('are refused at once for a request sent to nobody', async () => {
    const { ana } = drive();
    const box = await ana.createFolder('Box', null);
    await ana.createLink(box.id, 7, { uploads: 'only', request: { items: [{ id: 'a', label: 'A' }] } });
    const link = (await ana.requests())[0].link;
    await expect(ana.remind(box.id, link.id)).rejects.toMatchObject({ code: 'no-email' });
  });

  it('are written in the language of the drive, and sent by Resend', async () => {
    const reminder: Reminder = {
      email: 'carla@northwind.test',
      folder: { id: 'f', name: 'Northwind', owner: 'ana' },
      link: { id: 'l', role: 'viewer', expires: '2026-04-01T00:00:00.000Z', by: 'ana', at: '2026-03-01T00:00:00.000Z' },
      request: { title: 'Contracts' },
      missing: [{ id: 'd1', label: 'Contrato firmado' }],
      token: 'tok',
      company: 'Acme',
      language: 'es',
    };
    const mail = reminderMail(reminder, 'https://files.acme.test/s/tok');
    expect(mail).toMatchObject({ to: 'carla@northwind.test', subject: 'Recordatorio: Contracts' });
    expect(mail.text).toContain('Acme sigue esperando estos documentos:\n- Contrato firmado');
    expect(mail.html).toContain('href="https://files.acme.test/s/tok"');
    expect(reminderMail({ ...reminder, company: null, language: 'en', missing: [] }, 'u').text).toContain('We are still waiting for your files.');

    const asked: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      asked.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const sent: Mail[] = [];
    const send = resend({ apiKey: 're_1', from: 'Acme <files@acme.test>', fetch: fake });
    await mailReminders({ mail: async (one) => (sent.push(one), send(one)), url: (token) => `https://files.acme.test/s/${token}` }).send(reminder);
    expect(asked[0]).toMatchObject({ url: 'https://api.resend.com/emails', auth: 'Bearer re_1', body: { from: 'Acme <files@acme.test>', to: ['carla@northwind.test'] } });
    expect(sent[0].text).toContain('https://files.acme.test/s/tok');
  });
});

describe('what came, checked', () => {
  const ask = { uploads: 'only' as const, request: { items: [{ id: 'id', label: 'ID', words: ['INE', 'credencial'], find: { rfc: '\\b([A-Z]{4}\\d{6}[A-Z0-9]{3})\\b' } }] } };

  it('is marked when it does not say what it should, and the fields its patterns find are kept on it', async () => {
    const { ana, guest, handle } = drive({ written: 'A photo of a cat' });
    const box = await ana.createFolder('Box', null);
    const { token } = await ana.createLink(box.id, 7, ask);
    const sent = await guest(token).upload(pdf('id.pdf'), { item: 'id' });
    await handle.idle();
    expect((await ana.list(box.id)).entries.find((e) => e.id === sent.id)?.fields).toMatchObject({ item: 'ID', check: 'INE | credencial' });
  });

  it('says nothing of what does, and finds its fields', async () => {
    const { ana, guest, handle } = drive({ written: 'INSTITUTO NACIONAL ELECTORAL · CREDENCIAL PARA VOTAR · RFC GOMC800101AB1' });
    const box = await ana.createFolder('Box', null);
    const { token } = await ana.createLink(box.id, 7, ask);
    const sent = await guest(token).upload(pdf('id.pdf'), { item: 'id' });
    await handle.idle();
    const fields = (await ana.list(box.id)).entries.find((e) => e.id === sent.id)?.fields;
    expect(fields).toMatchObject({ rfc: 'GOMC800101AB1' });
    expect(fields?.check).toBeUndefined();
  });

  it('is not, with `check: false`', async () => {
    const { ana, guest, handle } = drive({ written: 'A cat', check: false });
    const box = await ana.createFolder('Box', null);
    const { token } = await ana.createLink(box.id, 7, ask);
    const sent = await guest(token).upload(pdf('id.pdf'), { item: 'id' });
    await handle.idle();
    expect((await ana.list(box.id)).entries.find((e) => e.id === sent.id)?.fields?.check).toBeUndefined();
  });

  it('is not shown to its sender: the page of the link has only what the document is called', async () => {
    const { ana, guest } = drive();
    const box = await ana.createFolder('Box', null);
    const { token } = await ana.createLink(box.id, 7, ask);
    expect((await guest(token).list()).link?.request?.items).toEqual([{ id: 'id', label: 'ID', received: 0 }]);
  });
});

describe.each([
  ['in memory', async () => memoryMetadata()],
  ['on SQLite, a piece at a time', () => sqliteMetadata(join(folder, `${Math.random()}.sqlite`))],
  ['on Postgres, a piece at a time', () => postgresMetadata(new PGlite())],
])('what stops being good, %s', (_, store) => {
  it('is asked of its sender, kept on the file, and told to its owner before it does, once', async () => {
    const { ana, guest, later, expiring } = drive({ metadata: await store() });
    const box = await ana.createFolder('Box', null);
    const { token } = await ana.createLink(box.id, 30, {
      uploads: 'only',
      request: {
        items: [
          { id: 'policy', label: 'Insurance policy', expires: true },
          { id: 'other', label: 'Other' },
        ],
      },
    });
    expect((await guest(token).list()).link?.request?.items?.[0]).toMatchObject({ expires: true });
    await expect(guest(token).upload(pdf('x.pdf'), { item: 'other', expires: dayIn(20) })).rejects.toMatchObject({ code: 'bad-expires' });
    await expect(guest(token).upload(pdf('x.pdf'), { item: 'policy', expires: 'soon' })).rejects.toMatchObject({ code: 'bad-expires' });
    const sent = await guest(token).upload(pdf('policy.pdf'), { item: 'policy', expires: dayIn(30) });
    expect((await ana.list(box.id)).entries.find((e) => e.id === sent.id)?.fields?.expires).toBe(dayIn(30));

    expect(await ana.expiring()).toEqual([]);
    expect((await ana.expiring(60)).map((one) => [one.entry.name, one.days])).toEqual([['policy.pdf', 30]]);

    later(16);
    await ana.list(null);
    await new Promise((done) => setTimeout(done, 20));
    const told = (await ana.notifications()).notifications.filter((n) => n.kind === 'expiring');
    expect(told).toMatchObject([{ entry: sent.id, name: 'policy.pdf', expires: dayIn(30) }]);
    expect(expiring).toEqual(['policy.pdf · 14']);
    later(1);
    await ana.list(null);
    await new Promise((done) => setTimeout(done, 20));
    expect((await ana.notifications()).notifications.filter((n) => n.kind === 'expiring')).toHaveLength(1);
  });
});
