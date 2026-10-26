// Each example served on a port, asked over HTTP as a page asks: a folder, a
// file uploaded in two parts and read back, and the events of a change, which
// go on through each framework as long as the page watches.

import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DriveEvent, createDriveClient } from '@rebofiles/drive';
import { SignJWT } from 'jose';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-examples-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** Each example's server, listening on a port of its own, and how to stop it. */
const SERVERS: Record<string, () => Promise<{ port: number; close: () => Promise<void> }>> = {
  async express() {
    const { createApp } = await import('../express/server');
    const server = (await createApp()).listen(0);
    await new Promise((done) => server.once('listening', done));
    return { port: (server.address() as AddressInfo).port, close: () => new Promise((done) => (server.closeAllConnections(), server.close(() => done()))) };
  },
  async hono() {
    const { serve } = await import('@hono/node-server');
    const { createApp } = await import('../hono/server');
    const app = await createApp();
    const server = await new Promise<ReturnType<typeof serve>>((done) => {
      const made = serve({ fetch: app.fetch, port: 0 }, () => done(made));
    });
    return {
      port: (server.address() as AddressInfo).port,
      close: () => new Promise((done) => ((server as unknown as { closeAllConnections(): void }).closeAllConnections(), server.close(() => done()))),
    };
  },
  async fastify() {
    const { createApp } = await import('../fastify/server');
    const app = await createApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    return { port: (app.server.address() as AddressInfo).port, close: () => (app.server.closeAllConnections(), app.close()) };
  },
  async nextjs() {
    // The route handler as Next.js calls it: with the Request, for every method.
    const { createServer } = await import('node:http');
    const { nodeHandler } = await import('@rebofiles/server');
    const route = await import('../nextjs/app/api/files/[...path]/route');
    const server = createServer((incoming, outgoing) => nodeHandler((request) => route[request.method as 'GET'](request))(incoming, outgoing)).listen(0);
    await new Promise((done) => server.once('listening', done));
    return { port: (server.address() as AddressInfo).port, close: () => new Promise((done) => (server.closeAllConnections(), server.close(() => done()))) };
  },
};

describe.each(Object.keys(SERVERS))('the example of %s', (name) => {
  it('makes a folder, takes a file in parts and gives it back, and tells a change as it happens', async () => {
    process.env.REBOFILES_FOLDER = join(folder, name);
    const { port, close } = await SERVERS[name]();
    try {
      const drive = createDriveClient({ base: `http://127.0.0.1:${port}/api/files`, headers: () => ({ 'x-user': 'ana' }), remember: null });
      const events: DriveEvent[] = [];
      let watching = false;
      const stop = drive.watch((event) => events.push(event), { onState: (on) => (watching = on) });
      for (let i = 0; i < 100 && !watching; i++) await new Promise((done) => setTimeout(done, 20));
      expect(watching).toBe(true);

      const clients = await drive.createFolder('Clients', null);
      const bytes = Uint8Array.from({ length: 9 * 1024 * 1024 }, (_, i) => i % 251);
      const file = await drive.upload(new File([bytes], 'big.bin', { type: 'application/octet-stream' }), { parent: clients.id });
      expect((await drive.list(clients.id)).entries.map((e) => e.name)).toEqual(['big.bin']);
      const back = new Uint8Array(await (await fetch(await drive.url(file.id))).arrayBuffer());
      expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);

      for (let i = 0; i < 100 && events.length < 2; i++) await new Promise((done) => setTimeout(done, 20));
      expect(events.map((e) => e.entries)).toEqual([[clients.id], [file.id]]);
      stop();
    } finally {
      await close();
    }
  });
});

describe('who asks, from a token', () => {
  it('is the subject of a JWT signed with the secret, in a cookie or as Bearer; no one for another', async () => {
    process.env.SESSION_SECRET = 'a long secret of the application';
    const { identify } = await import('../auth/jwt');
    const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject('ana').setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await identify(new Request('http://x', { headers: { authorization: `Bearer ${token}` } }))).toEqual({ id: 'ana', admin: true });
    expect(await identify(new Request('http://x', { headers: { cookie: `theme=dark; session=${token}` } }))).toEqual({ id: 'ana', admin: true });
    const forged = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('ana').sign(new TextEncoder().encode('another secret'));
    expect(await identify(new Request('http://x', { headers: { authorization: `Bearer ${forged}` } }))).toBeNull();
    expect(await identify(new Request('http://x'))).toBeNull();
  });
});
