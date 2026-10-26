// The tools as an assistant calls them: JSON-RPC over HTTP to the MCP
// handler, which asks a real drive's routes in the same process as the
// person the request says. And over stdio, a line in and a line out.

import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { sampleDocx } from '../../../tools/sample-docx';
import { PROTOCOL_VERSIONS, serveStdio } from '../src';
import { parseArgs } from '../src/bin';
import { DOCX_TYPE, ORIGIN, setUp, upload } from './setup';

describe('the protocol', () => {
  it('says what it is, the version asked when it speaks it, and its tools', async () => {
    const { ana } = setUp();
    const init = (await ana.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result!;
    expect(init).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'rebofiles' } });
    expect((await ana.rpc('initialize', { protocolVersion: '1999-01-01' })).result!.protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
    const { tools } = (await ana.rpc('tools/list')).result as unknown as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    // The drive's own, before Rebodocs' on its documents.
    const own = tools.slice(
      0,
      tools.findIndex((t) => t.name === 'create_document'),
    );
    expect(own.map((t) => t.name)).toEqual([
      'list_folder',
      'search',
      'get_info',
      'read_file',
      'list_recent',
      'list_shared',
      'get_activity',
      'create_folder',
      'create_text_file',
      'update_text_file',
      'restore_version',
      'rename',
      'move',
      'move_to_trash',
      'restore',
    ]);
    expect(tools.find((t) => t.name === 'read_file')!.annotations.readOnlyHint).toBe(true);
    expect(own.some((t) => /delete|share$/.test(t.name))).toBe(false);
  });

  it('answers a ping, refuses what it does not know, and takes notifications without answering', async () => {
    const { mcp, ana } = setUp();
    expect((await ana.rpc('ping')).result).toEqual({});
    expect((await ana.rpc('resources/list')).error).toMatchObject({ code: -32601 });
    expect((await ana.rpc('tools/call', { name: 'delete_forever', arguments: {} })).error).toMatchObject({ code: -32602 });
    const note = await mcp(new Request(`${ORIGIN}/api/mcp`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }));
    expect(note.status).toBe(202);
  });

  it('refuses a request from another origin, and what is not a POST', async () => {
    const { mcp } = setUp();
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect((await mcp(new Request(`${ORIGIN}/api/mcp`, { method: 'POST', headers: { origin: 'http://evil.test' }, body }))).status).toBe(403);
    expect((await mcp(new Request(`${ORIGIN}/api/mcp`, { method: 'POST', headers: { origin: ORIGIN }, body }))).status).toBe(200);
    expect((await mcp(new Request(`${ORIGIN}/api/mcp`))).status).toBe(405);
  });
});

describe('the tools', () => {
  it('make a folder, write a file into it, list, find and read it', async () => {
    const { ana } = setUp();
    const contracts = (await ana.call('create_folder', { name: 'Contracts' })).structuredContent;
    const written = await ana.call('create_text_file', { name: 'terms.md', text: '# Terms\n\nPayment within 30 days.', folder: contracts.id });
    expect(written.structuredContent).toMatchObject({ name: 'terms.md', type: 'text/markdown', size: 32 });

    expect((await ana.call('list_folder', { folder: contracts.id })).content[0].text).toContain('file "terms.md"');
    expect((await ana.call('list_folder')).structuredContent.entries.map((e: { name: string }) => e.name)).toEqual(['Contracts']);
    const found = (await ana.call('search', { query: 'TERMS' })).structuredContent.entries;
    expect(found).toHaveLength(1);
    expect((await ana.call('read_file', { id: found[0].id })).content[0].text).toBe('# Terms\n\nPayment within 30 days.');
    expect((await ana.call('list_recent')).structuredContent.entries[0].name).toBe('terms.md');
  });

  it('write a new version, keep the old one to read, rename, move, trash and restore', async () => {
    const { ana } = setUp();
    const file = (await ana.call('create_text_file', { name: 'notes.txt', text: 'one' })).structuredContent;
    expect((await ana.call('update_text_file', { id: file.id, text: 'two' })).content[0].text).toBe('Saved version 2 of "notes.txt".');
    const info = (await ana.call('get_info', { id: file.id })).structuredContent;
    expect(info.versions).toHaveLength(2);
    expect((await ana.call('read_file', { id: file.id })).content[0].text).toBe('two');
    expect((await ana.call('read_file', { id: file.id, version: info.versions[1].id })).content[0].text).toBe('one');

    const archive = (await ana.call('create_folder', { name: 'Archive' })).structuredContent;
    expect((await ana.call('rename', { id: file.id, name: 'minutes.txt' })).structuredContent.name).toBe('minutes.txt');
    expect((await ana.call('move', { id: file.id, folder: archive.id })).structuredContent.folder).toBe(archive.id);
    expect((await ana.call('move_to_trash', { id: file.id })).structuredContent.trashed).toBe(true);
    expect((await ana.call('search', { query: 'minutes', in_trash: true })).structuredContent.entries).toHaveLength(1);
    expect((await ana.call('restore', { id: file.id })).structuredContent.folder).toBe(archive.id);

    const done = ((await ana.call('get_activity', { id: file.id, limit: 3 })).structuredContent as unknown as { activity: { action: string }[] }).activity;
    expect(done.map((a) => a.action)).toEqual(['restored', 'trashed', 'moved']);
    expect((await ana.call('get_activity', { id: file.id })).content[0].text).toMatch(/ ana renamed file "minutes.txt" \(id .*\) from "notes.txt"/);
  });

  it('read a Word document with Rebodocs, and say what they do not read', async () => {
    const { ana, drive } = setUp();
    const docx = sampleDocx('Service agreement', ['Payment is due within thirty days.']);
    await upload(drive, 'ana', 'agreement.docx', DOCX_TYPE, docx);
    const [agreement] = (await ana.call('search', { query: 'agreement' })).structuredContent.entries;
    expect((await ana.call('read_file', { id: agreement.id })).content[0].text).toBe('Service agreement\nPayment is due within thirty days.');

    const folderOf = (await ana.call('create_folder', { name: 'A folder' })).structuredContent;
    const read = await ana.call('read_file', { id: folderOf.id });
    expect(read).toMatchObject({ isError: true, content: [{ text: '"A folder" is a folder: list_folder shows what is in it.' }] });
    expect((await ana.call('update_text_file', { id: agreement.id, text: 'x' })).isError).toBe(true);
  });

  it('may do only what the person may: authorize is asked for the assistant too', async () => {
    const { ana, bea } = setUp();
    const own = (await ana.call('create_text_file', { name: 'private.txt', text: 'Ana only.' })).structuredContent;
    // Bea's assistant does not see it, nor may it touch it.
    expect((await bea.call('list_folder')).structuredContent.entries).toEqual([]);
    expect((await bea.call('search', { query: 'private' })).structuredContent.entries).toEqual([]);
    const refused = await bea.call('read_file', { id: own.id });
    expect(refused).toMatchObject({ isError: true, content: [{ text: 'You may not do that here.' }] });
    expect((await bea.call('rename', { id: own.id, name: 'mine.txt' })).isError).toBe(true);
    expect((await bea.call('move_to_trash', { id: own.id })).isError).toBe(true);
    expect((await ana.call('get_info', { id: own.id })).structuredContent.name).toBe('private.txt');
  });

  it('say what was missing from a call', async () => {
    const { ana } = setUp();
    expect(await ana.call('search', {})).toMatchObject({ isError: true, content: [{ text: '"query" is needed, as text.' }] });
  });
});

describe('over stdio', () => {
  it('answers each line with a line, and nothing to a notification', async () => {
    const { drive } = setUp();
    const input = new PassThrough();
    const output = new PassThrough();
    const said: string[] = [];
    output.on('data', (chunk: Buffer) => said.push(...chunk.toString().split('\n').filter(Boolean)));
    const served = serveStdio(
      { base: `${ORIGIN}/api/files`, headers: () => ({ authorization: 'Bearer ana' }), fetch: (i, init) => drive(new Request(new URL(String(i), ORIGIN), init)) },
      { input, output },
    );
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_folder', arguments: { name: 'From stdio' } } })}\n`);
    input.write('not json\n');
    input.end();
    await served;
    const answers = said.map((line) => JSON.parse(line));
    expect(answers.map((a) => a.id)).toEqual(expect.arrayContaining([1, 2, null]));
    expect(answers).toHaveLength(3);
    expect(answers.find((a) => a.id === 2).result.structuredContent.name).toBe('From stdio');
  });

  it('takes where the drive is and the person’s token from the command or the environment', () => {
    expect(parseArgs(['--base', 'https://acme.com/api/files', '--header', 'X-Team: acme'], { REBOFILES_TOKEN: 't0k' })).toEqual({
      base: 'https://acme.com/api/files',
      headers: { authorization: 'Bearer t0k', 'x-team': 'acme' },
    });
    expect(() => parseArgs([], {})).toThrow('Say where the drive is');
  });
});
