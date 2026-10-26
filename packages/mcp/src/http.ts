// The tools over HTTP, as the protocol's Streamable HTTP has it, without a
// stream: each request a POST of one message, each answered with JSON, and
// nothing kept between them. A Request in, a Response out, as the drive's own
// handler, so it goes into the same application beside it.
//
//   // app/api/mcp/route.ts
//   export const POST = createMcpHandler({ base: 'https://acme.com/api/files' });

import { type DriveOptions, driveAt } from './drive';
import { type Message, answer } from './protocol';

export interface McpHandlerOptions extends Omit<DriveOptions, 'headers'> {
  /**
   * The headers the drive is asked with, from the request the assistant made: who it works for. Its
   * `authorization` and `cookie` unless said, so the drive's `identify` takes the assistant for the person.
   */
  headers?: (request: Request) => Record<string, string> | Promise<Record<string, string>>;
  /** The origins a browser may call it from, besides its own. A request from any other is refused, against DNS rebinding. */
  origins?: string[];
}

const FORWARDED = ['authorization', 'cookie'];

export function createMcpHandler(options: McpHandlerOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin && !options.origins?.includes(origin)) return new Response('Not from that origin.', { status: 403 });
    // No stream to open, nor a session to end: only messages, posted.
    if (request.method !== 'POST') return new Response('POST a JSON-RPC message.', { status: 405, headers: { allow: 'POST' } });

    let message: Message;
    try {
      message = (await request.json()) as Message;
    } catch {
      return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'The body is not JSON.' } }, { status: 400 });
    }
    const headers = options.headers ? () => options.headers!(request) : () => Object.fromEntries(FORWARDED.flatMap((name) => (request.headers.get(name) ? [[name, request.headers.get(name)!]] : [])));
    const drive = driveAt({ base: options.base, fetch: options.fetch, headers });

    if (Array.isArray(message)) {
      const answers = (await Promise.all(message.map((m: Message) => answer(m, drive)))).filter(Boolean);
      return answers.length ? Response.json(answers) : new Response(null, { status: 202 });
    }
    const said = await answer(message, drive);
    return said ? Response.json(said) : new Response(null, { status: 202 });
  };
}
