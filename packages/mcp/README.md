<h1 align="center">@rebofiles/mcp</h1>

<p align="center">
  The drive for an AI assistant: tools to list, search, read, write, rename, move and trash files, and with Rebodocs to edit its Word documents, through the routes of @rebofiles/server, with the rights of the one using it. No dependencies but core.
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
| `restore_version` | An earlier version back, as a new one: that too can be undone. |
| `rename`, `move` | Refused when the name is taken there. |
| `move_to_trash`, `restore` | Into the trash and out of it. |

Each says whether it only reads (`readOnlyHint`). What the server refuses
comes back to the model as an error result in words ("You may not do that
here."), for it to do something else.

## Word documents, with Rebodocs

```bash
npm install @rebodocs/mcp
```

With it installed beside, the drive's `.docx` files are worked on with the
tools of [Rebodocs' MCP](https://rebodocs.com/docs/assistants/), by the same
engine as its editor: "find the service contract, set the payment at sixty
days and note it for finance" is `search`, then `edit_document`, on the file
itself, keeping its layout and formatting.

- **Each takes the file's id** as `document`, instead of a path, and reads
  it from the drive as the person: a viewer's assistant reads, an editor's
  writes.
- **Each change is a version.** The tool's document is written back at once
  as a new version of the same file, so there is nothing to open, save or
  close, and nothing kept between calls, over HTTP as over stdio.
  `restore_version` with the one before undoes it, and `compare_documents`,
  without another file, says what changed since the version before.
- **Not over someone else's.** When the file was saved by someone while a
  tool ran, the change is not written and the assistant is told to read it
  again.
- **The drive's files for its files**: `insert_image` and `set_letterhead`
  take the id of a picture of the drive (`image`), and `compare_documents`
  a version (`version`) or another document (`other`).
- `create_document` starts an empty one.

`read_pages` and the table of contents, which need the fonts of a document
to work out its pages, are not served. Without `@rebodocs/mcp`, the tools are
the drive's alone and nothing is said of documents.

## The API

| Name | What it is |
| --- | --- |
| `createMcpHandler(options)` | `(Request) => Promise<Response>`, over HTTP. |
| `serveStdio(options, streams?)` | Over stdin and stdout, until stdin ends. |
| `TOOLS`, `answer(message, drive)` | The drive's tools, and the answer to one JSON-RPC message, for a transport of your own. |
| `allTools()`, `documentTools()` | Those and Rebodocs' on the documents, when it is installed; Rebodocs' alone. |
| `driveAt(options)` | The drive's routes, as the tools ask them. |

## Status

Tested in `test/mcp.test.ts` over HTTP and stdio against a drive in the same
process, two people's assistants among them; Rebodocs' tools in
`test/documents.test.ts`, and the server without them in
`test/without-rebodocs.test.ts`. Driven by the protocol's official SDK as a
client, over stdio from the command installed from its tarball and over HTTP
from the playground, a contract written, changed, compared and restored
there. Not on npm yet.

## Where it can improve

- **Binary files.** Pictures and PDFs are not read; they could come back as
  the protocol's images and resources.
- **The pages of a document.** With fonts given to the server, `read_pages`
  and the table of contents could be served too.
- **One save at a time.** A save made meanwhile is found by asking the drive
  just before writing; a write that said which version it replaces, refused
  by the server otherwise, would close the moment between.
- **A stream.** Each request is answered whole; long work cannot say how far
  it is.

## License

MIT. Anyone may use it for anything.
