// The routes for `node:http` and what is built on it (Express, Fastify's raw
// mode): the Request made of what arrived, and the Response written back.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export function nodeHandler(handle: (request: Request) => Promise<Response>) {
  return async (incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    const method = incoming.method ?? 'GET';
    const host = incoming.headers.host ?? 'localhost';
    const request = new Request(`http://${host}${incoming.url ?? '/'}`, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(incoming) as ReadableStream),
      duplex: 'half',
    } as RequestInit);
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) outgoing.write(chunk);
    outgoing.end();
  };
}
