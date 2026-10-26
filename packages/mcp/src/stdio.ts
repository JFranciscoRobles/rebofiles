// The tools over stdio, as an assistant on the same computer starts them
// (Claude Desktop, Claude Code): one message a line in, one answer a line out.
// Nothing but answers goes to stdout; what is for a person goes to stderr.

import type { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import { type DriveOptions, driveAt } from './drive';
import { type Message, answer } from './protocol';

export async function serveStdio(options: DriveOptions, streams: { input?: Readable; output?: Writable } = {}): Promise<void> {
  const drive = driveAt(options);
  const output = streams.output ?? process.stdout;
  const lines = createInterface({ input: streams.input ?? process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
  const pending: Promise<void>[] = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    // Each answered as it is ready: a slow read does not hold up a ping.
    const done = (async () => {
      let message: Message;
      try {
        message = JSON.parse(line) as Message;
      } catch {
        output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Not JSON.' } })}\n`);
        return;
      }
      const said = await answer(message, drive);
      if (said) output.write(`${JSON.stringify(said)}\n`);
    })();
    pending.push(done);
  }
  await Promise.all(pending);
}
