// The routes for `node:http` and what is built on it (Express, Fastify's raw
// mode): the Request made of what arrived, and the Response written back. The
// body is read here, as it came: no parser of JSON may have read it before.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export function nodeHandler(handle: (request: Request) => Promise<Response>) {
  return async (incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    const method = incoming.method ?? 'GET';
    const host = incoming.headers.host ?? 'localhost';
    // Gone when the page is: an answer that goes on, as the events, ends with it.
    const gone = new AbortController();
    outgoing.on('close', () => gone.abort());
    // Express takes the path it is mounted at off `url` (`app.use('/api/files', …)`), and keeps it whole in `originalUrl`.
    const path = (incoming as IncomingMessage & { originalUrl?: string }).originalUrl ?? incoming.url ?? '/';
    const request = new Request(`http://${host}${path}`, {
      method,
      headers,
      signal: gone.signal,
      body: method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(incoming) as ReadableStream),
      duplex: 'half',
    } as RequestInit);
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body)
      try {
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          if (gone.signal.aborted) break;
          outgoing.write(chunk);
        }
      } catch (error) {
        if (!gone.signal.aborted) throw error;
      }
    outgoing.end();
  };
}
