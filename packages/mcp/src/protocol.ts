// The Model Context Protocol, as much of it as a server of tools speaks:
// JSON-RPC 2.0 with `initialize`, `ping`, `tools/list` and `tools/call`. The
// same messages go over stdio (stdio.ts) and over HTTP (http.ts); what each
// is answered is here.

import type { Drive } from './drive';
import { DriveRefusal } from './drive';
import { documentTools } from './documents';
import { TOOLS, type Tool } from './tools';

/** The versions of the protocol spoken, the latest first; a client asking for another is offered the latest. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export const SERVER_INFO = { name: 'rebofiles', title: 'ReboFiles', version: '0.1.0' };

const INSTRUCTIONS =
  'The drive of the person you work for: their folders and files, and what others shared with them. Find things with search or list_folder, and use the ids they give. ' +
  'You may do what they may and nothing more. Nothing you do is permanent: what you put in the trash can be restored, and writing a file keeps what it was as a version.';

const DOCUMENTS =
  ' Word documents (.docx) are read and changed with the tools of Rebodocs, each given the id of the file as "document": every change is saved at once as a new version of it, which restore_version undoes. ' +
  'Paragraphs go by number, as read_document shows them, and the numbers move when paragraphs are inserted or deleted: read again before using a number after such a change, or make several changes in one call with edit_document. ' +
  'To change a text, give it exactly as it reads. To review a document without changing its text, use add_note.';

/** The drive's tools, and Rebodocs' on its documents when it is installed: looked for once. */
let all: Promise<Tool[]> | undefined;
export const allTools = (): Promise<Tool[]> => (all ??= documentTools().then((documents) => [...TOOLS, ...documents]));

export interface Message {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Answer = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Answer['id'], result: unknown): Answer => ({ jsonrpc: '2.0', id, result });
const failed = (id: Answer['id'], code: number, message: string): Answer => ({ jsonrpc: '2.0', id, error: { code, message } });

/** The answer to one message; none to a notification, which asks for none. */
export async function answer(message: Message, drive: Drive): Promise<Answer | undefined> {
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') return failed(message?.id ?? null, -32600, 'Not a JSON-RPC 2.0 request.');
  if (message.id === undefined) return undefined;
  const { id, method, params = {} } = message;
  switch (method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '');
      return ok(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: (await allTools()).length > TOOLS.length ? INSTRUCTIONS + DOCUMENTS : INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: (await allTools()).map(({ run: _, ...tool }) => tool) });
    case 'tools/call': {
      const tool = (await allTools()).find((t) => t.name === params.name);
      if (!tool) return failed(id, -32602, `There is no tool "${String(params.name)}".`);
      try {
        const { text, data } = await tool.run(drive, (params.arguments as Record<string, unknown>) ?? {});
        return ok(id, { content: [{ type: 'text', text }], structuredContent: data, isError: false });
      } catch (error) {
        // What the server refused, or a call that made no sense, is told to the model to do something else.
        if (error instanceof DriveRefusal || error instanceof TypeError) return ok(id, { content: [{ type: 'text', text: error.message }], isError: true });
        return failed(id, -32603, 'Something went wrong in the server of the drive.');
      }
    }
    default:
      return failed(id, -32601, `No method "${method}".`);
  }
}
