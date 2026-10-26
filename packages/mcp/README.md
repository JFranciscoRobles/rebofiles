<h1 align="center">@rebofiles/mcp</h1>

<p align="center">
  The drive for an AI assistant: tools to list, search, read, write, rename, move and trash files, through the routes of @rebofiles/server, with the rights of the one using it. No dependencies but core.
</p>

---

The tools ask the drive's own routes, as the person the assistant works for,
so `identify` takes the assistant for them and `authorize` decides for it as
for them: it sees what they see and may do what they may. It cannot delete
for good, nor share: what it puts in the trash comes back with `restore`, and
what it writes keeps what the file was as a version.

It speaks the Model Context Protocol itself, JSON-RPC over stdio or over
HTTP, without its SDK, as the rest of ReboFiles is without dependencies.

## Install

```bash
npm install @rebofiles/mcp
```

## In your application, over HTTP

Beside the drive's route, the assistant's: it forwards the `authorization`
and `cookie` of each request to the drive, so a token of the person's is
enough.

```ts
// app/api/mcp/route.ts, in Next.js
import { createMcpHandler } from '@rebofiles/mcp';

export const POST = createMcpHandler({ base: 'https://acme.com/api/files' });
```

`headers: (request) => ({ … })` says otherwise what the drive is asked with;
`fetch` gives the drive's handler itself, to ask it in the same process; and
`origins` the origins a browser may call it from besides its own, as any
other is refused. Each request is one message answered with JSON: no stream,
no session.

```bash
claude mcp add --transport http rebofiles https://acme.com/api/mcp --header "Authorization: Bearer …"
```

## On your computer, over stdio

```bash
npx rebofiles-mcp --base https://acme.com/api/files --header "Authorization: Bearer …"
# or REBOFILES_URL and REBOFILES_TOKEN in the environment
```

```json
{ "mcpServers": { "rebofiles": { "command": "npx", "args": ["rebofiles-mcp"], "env": { "REBOFILES_URL": "https://acme.com/api/files", "REBOFILES_TOKEN": "…" } } } }
```

The playground of the repository serves it at `http://localhost:5180/api/mcp`.

## The tools

| Tool | What it does |
| --- | --- |
| `list_folder` | What is in a folder, or at the top of My files, with the id of each. |
| `search` | By name: every word, any case, with or without accents; in a folder, or the trash. |
| `get_info` | One entry: type, size, owner, where, who it is shared with, its versions. |
| `read_file` | The text of a text file, or of a Word document with `@rebodocs/core` installed; of a version too. Up to a megabyte. |
| `list_recent`, `list_shared` | Recent, and Shared with me. |
| `create_folder`, `create_text_file` | Something new, with "(2)" when the name is taken. |
| `update_text_file` | A new version of a text file; the old one stays. |
| `rename`, `move` | Refused when the name is taken there. |
| `move_to_trash`, `restore` | Into the trash and out of it. |

Each says whether it only reads (`readOnlyHint`). What the server refuses
comes back to the model as an error result in words ("You may not do that
here."), for it to do something else.

## The API

| Name | What it is |
| --- | --- |
| `createMcpHandler(options)` | `(Request) => Promise<Response>`, over HTTP. |
| `serveStdio(options, streams?)` | Over stdin and stdout, until stdin ends. |
| `TOOLS`, `answer(message, drive)` | The tools, and the answer to one JSON-RPC message, for a transport of your own. |
| `driveAt(options)` | The drive's routes, as the tools ask them. |

## Status

Tested in `test/mcp.test.ts` over HTTP and stdio against a drive in the same
process, two people's assistants among them; and driven by the protocol's
official SDK as a client, over stdio from the command installed from its
tarball and over HTTP from the playground. Not on npm yet.

## Where it can improve

- **Binary files.** Pictures and PDFs are not read; they could come back as
  the protocol's images and resources.
- **Word documents written.** It reads them; writing them is Rebodocs' MCP's.
- **A stream.** Each request is answered whole; long work cannot say how far
  it is.

## License

MIT. Anyone may use it for anything.
