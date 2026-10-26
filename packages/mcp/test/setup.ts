// A drive, its MCP beside it, and an assistant for each person, who says who
// it works for with a bearer token: what the tests of the MCP go through.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { byRoles, createDriveHandler, diskStorage, memoryMetadata } from '@rebofiles/server';
import { createMcpHandler } from '../src';

let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'rebofiles-mcp-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

export const ORIGIN = 'http://acme.test';

/** What the tools give back as data, as much of it as the tests look at. */
export type Data = { id: string; name: string; type?: string; size?: number; folder: string | null; trashed?: boolean; versions: { id: string }[]; entries: { id: string; name: string }[] };

/** A drive, its MCP beside it, and an assistant for each person, who says who it works for with a bearer token. */
/** `meanwhile`, when given, runs before each request the MCP makes to the drive: for what someone else does at the same time. */
export function setUp(meanwhile?: (request: Request) => Promise<void>) {
  const drive = createDriveHandler({
    storage: diskStorage({ folder: join(folder, String(Math.random())), secret: 's' }),
    metadata: memoryMetadata(),
    identify: (request) => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      return token ? { id: token } : null;
    },
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
  });
  const mcp = createMcpHandler({
    base: `${ORIGIN}/api/files`,
    fetch: async (input, init) => {
      const request = new Request(new URL(String(input), ORIGIN), init);
      await meanwhile?.(request);
      return drive(request);
    },
  });
  let next = 0;
  const assistant = (who: string) => {
    const rpc = async (method: string, params?: Record<string, unknown>) => {
      const answer = await mcp(
        new Request(`${ORIGIN}/api/mcp`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${who}` },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++next, method, params }),
        }),
      );
      return (await answer.json()) as {
        result?: Record<string, unknown> & { content: { text: string }[]; structuredContent: Data; isError: boolean };
        error?: { code: number; message: string };
      };
    };
    const call = async (name: string, args: Record<string, unknown> = {}) => (await rpc('tools/call', { name, arguments: args })).result!;
    return { rpc, call };
  };
  return { mcp, drive, ana: assistant('ana'), bea: assistant('bea') };
}

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Handler = ReturnType<typeof setUp>['drive'];

/** A file put in the drive through its routes, as a person would put it there: a new one by its name, or a new version of one. */
export async function upload(drive: Handler, who: string, to: string | { file: string }, type: string, bytes: Uint8Array): Promise<string> {
  const ask = (path: string, body: unknown) =>
    drive(new Request(`${ORIGIN}/api/files${path}`, { method: 'POST', headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const start = (await (await ask('/uploads', { ...(typeof to === 'string' ? { name: to, parent: null } : to), type, size: bytes.length })).json()) as { token: string; parts: { url: string }[] };
  await drive(new Request(new URL(start.parts[0].url, `${ORIGIN}/api/files/`), { method: 'PUT', body: bytes as Uint8Array<ArrayBuffer> }));
  const done = (await (await ask('/uploads/finish', { token: start.token, parts: [{ number: 1, etag: '"1"' }] })).json()) as { entry: { id: string } };
  return done.entry.id;
}

/** Shared by one person with another, through the drive's route. */
export async function share(drive: Handler, who: string, id: string, withWhom: string, role: string) {
  await drive(
    new Request(`${ORIGIN}/api/files/entries/${id}/shares`, {
      method: 'POST',
      headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json' },
      body: JSON.stringify({ with: withWhom, role }),
    }),
  );
}
