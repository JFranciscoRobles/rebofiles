// Without @rebodocs/mcp installed, the drive's tools and nothing else: no
// tool for documents to call, and nothing said about them.

import { describe, expect, it, vi } from 'vitest';
import { setUp } from './setup';

vi.mock('@rebodocs/mcp', () => {
  throw new Error('Cannot find package "@rebodocs/mcp"');
});

describe('without Rebodocs', () => {
  it('lists the drive’s tools alone', async () => {
    const { ana } = setUp();
    const init = (await ana.rpc('initialize', { protocolVersion: '2025-11-25' })).result as unknown as { instructions: string };
    expect(init.instructions).not.toContain('Word documents');
    const { tools } = (await ana.rpc('tools/list')).result as unknown as { tools: { name: string }[] };
    expect(tools).toHaveLength(15);
    expect((await ana.rpc('tools/call', { name: 'read_document', arguments: {} })).error).toMatchObject({ code: -32602 });
  });
});
