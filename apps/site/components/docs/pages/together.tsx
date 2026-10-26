// Together: an AI assistant working in the drive, with the rights of its person.

import { TOOLS, documentTools } from '@rebofiles/mcp';
import { C, Callout, Code, type DocPage, List, P, RefTable } from '../ui';

export const toolId = (name: string) => `tool-${name}`;

const HTTP = `// app/api/mcp/route.ts, in Next.js
import { createMcpHandler } from '@rebofiles/mcp';

export const POST = createMcpHandler({ base: 'https://acme.com/api/files' });`;

const CLAUDE = `claude mcp add --transport http rebofiles https://acme.com/api/mcp --header "Authorization: Bearer …"`;

const STDIO = `{
  "mcpServers": {
    "rebofiles": {
      "command": "npx",
      "args": ["rebofiles-mcp"],
      "env": { "REBOFILES_URL": "https://acme.com/api/files", "REBOFILES_TOKEN": "…" }
    }
  }
}`;

/** Rebodocs' tools on the drive's Word documents, when it is installed beside: read when the site is built. */
async function DocumentTools() {
  const tools = await documentTools().catch(() => []);
  if (!tools.length) return <P>Rebodocs is not installed where this site was built.</P>;
  return <RefTable label="Rebodocs’ tools on the drive" name="Tool" rows={tools.map((tool) => ({ id: toolId(tool.name), name: tool.name, does: tool.description }))} />;
}

export const assistants: DocPage = {
  title: 'AI assistants (MCP)',
  description: 'An MCP server for Claude and other assistants: over HTTP in your application or over stdio, every tool, what an assistant may touch, and Word documents through Rebodocs.',
  source: 'apps/site/components/docs/pages/together.tsx',
  lead: (
    <>
      <C>@rebofiles/mcp</C> gives an assistant the drive as tools: list, search, read, write text, rename, move, colour and put in the trash. Each is asked of the drive’s routes with the person’s own
      rights, so <C>authorize</C> is asked for the assistant too.
    </>
  ),
  sections: [
    {
      id: 'over-http',
      title: 'In your application, over HTTP',
      badge: 'HTTP',
      color: 'blue',
      lead: 'Beside the drive’s route: it forwards the authorization and cookie of each request to the drive, so a token of the person’s is enough.',
      body: (
        <>
          <Code code={HTTP} />
          <Code lang="bash" code={CLAUDE} />
          <P>
            <C>headers</C> says otherwise what the drive is asked with; <C>fetch</C> gives the drive’s handler itself, to ask it in the same process; <C>origins</C> the origins a browser may call it
            from besides its own.
          </P>
        </>
      ),
    },
    {
      id: 'over-stdio',
      title: 'On your computer, over stdio',
      badge: 'stdio',
      color: 'green',
      lead: 'For Claude Desktop and other clients that start a command.',
      body: <Code lang="json" code={STDIO} />,
    },
    {
      id: 'what-it-may-touch',
      title: 'What an assistant may touch',
      badge: 'Safety',
      color: 'yellow',
      body: (
        <List
          items={[
            'Only what its person may: every tool goes through the drive’s routes, identify and authorize.',
            'Nothing for good: it may put in the trash, not delete; it may not share. What it does can be undone from the trash or the versions.',
            'What the server refuses comes back to the model in words, for it to do something else.',
          ]}
        />
      ),
    },
    {
      id: 'every-tool',
      title: 'Every tool',
      badge: 'Tools',
      color: 'purple',
      lead: 'As the server tells them to the assistant.',
      body: (
        <RefTable
          label="Tools of the drive"
          name="Tool"
          rows={TOOLS.map((tool) => ({ id: toolId(tool.name), name: tool.name, type: tool.annotations.readOnlyHint ? 'reads' : 'writes', does: tool.description }))}
        />
      ),
    },
    {
      id: 'word-documents',
      title: 'Word documents, with Rebodocs',
      badge: 'Rebodocs',
      color: 'pink',
      lead: 'With @rebodocs/mcp installed, the drive’s .docx are read and edited with Rebodocs’ own tools, each change saved as a version.',
      body: (
        <>
          <DocumentTools />
          <Callout title="A save made meanwhile">by someone else is found by asking the drive just before writing, and not written over.</Callout>
        </>
      ),
    },
  ],
};
