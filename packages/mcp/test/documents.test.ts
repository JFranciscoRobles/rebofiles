// Rebodocs' tools on the drive's Word documents: read from the drive as the
// person, each change written back as a new version of the same file.

import { describe, expect, it } from 'vitest';
import { sampleDocx } from '../../../tools/sample-docx';
import { DOCX_TYPE, setUp, share, upload } from './setup';

/** A picture of one pixel, as a PNG. */
const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

type Tool = { name: string; inputSchema: { properties: Record<string, unknown>; required: string[] }; annotations: { readOnlyHint: boolean; destructiveHint: boolean } };

async function withAgreement() {
  const set = setUp();
  const id = await upload(set.drive, 'ana', 'agreement.docx', DOCX_TYPE, sampleDocx());
  return { ...set, id };
}

describe('the tools of Rebodocs', () => {
  it('are listed for the drive’s documents: an id instead of a path, and not those that need the pages', async () => {
    const { ana } = setUp();
    const init = (await ana.rpc('initialize', { protocolVersion: '2025-11-25' })).result as unknown as { instructions: string };
    expect(init.instructions).toContain('restore_version');
    const { tools } = (await ana.rpc('tools/list')).result as unknown as { tools: Tool[] };
    const named = (name: string) => tools.find((t) => t.name === name)!;
    expect(tools.length).toBeGreaterThan(50);
    for (const name of ['create_document', 'get_overview', 'read_document', 'replace_text', 'edit_document', 'fill_variables', 'add_note', 'compare_documents', 'insert_image'])
      expect(named(name)).toBeTruthy();
    for (const name of ['read_pages', 'insert_table_of_contents', 'update_table_of_contents', 'open_document', 'save_document']) expect(named(name)).toBeUndefined();
    expect(named('replace_text').inputSchema.required).toContain('document');
    expect(tools.filter((t) => 'path' in t.inputSchema.properties).map((t) => t.name)).toEqual([]);
    expect(named('insert_image').inputSchema.required).toEqual(['document', 'after_paragraph', 'image']);
    expect(named('read_document').annotations.readOnlyHint).toBe(true);
    // A change is a version to restore: none of them destroys anything.
    expect(tools.some((t) => t.annotations.destructiveHint)).toBe(false);
  });

  it('read a document without making a version of it', async () => {
    const { ana, id } = await withAgreement();
    const read = await ana.call('read_document', { document: id });
    expect(read.content[0].text).toContain('Payment is due within thirty days.');
    expect(read.structuredContent).toMatchObject({ changed: false });
    expect((await ana.call('get_info', { id })).structuredContent.versions).toHaveLength(1);
  });

  it('save each change as a new version, compare it with the one before, and restore that one', async () => {
    const { ana, id } = await withAgreement();
    const replaced = await ana.call('replace_text', { document: id, find: 'thirty', replace: 'sixty' });
    expect(replaced.isError).toBe(false);
    expect(replaced.content[0].text).toContain('Saved as version 2 of "agreement.docx"');
    expect((await ana.call('read_file', { id })).content[0].text).toContain('Payment is due within sixty days.');

    const compared = (await ana.call('compare_documents', { document: id })).content[0].text;
    expect(compared).toContain('[-thirty-]');
    expect(compared).toContain('{+sixty+}');

    const { versions } = (await ana.call('get_info', { id })).structuredContent;
    expect((await ana.call('restore_version', { id, version: versions[1].id })).content[0].text).toBe('"agreement.docx" is as version 1 was, now as version 3.');
    expect((await ana.call('read_file', { id })).content[0].text).toContain('within thirty days');
  });

  it('start a document, and write in it', async () => {
    const { ana } = setUp();
    const made = (await ana.call('create_document', { name: 'Minutes' })).structuredContent;
    expect(made).toMatchObject({ name: 'Minutes.docx', type: DOCX_TYPE });
    await ana.call('insert_paragraphs', { document: made.id, after_paragraph: 0, paragraphs: [{ text: 'The meeting began at nine.' }] });
    expect((await ana.call('read_file', { id: made.id })).content[0].text).toContain('The meeting began at nine.');
  });

  it('put a picture of the drive in a document', async () => {
    const { ana, drive, id } = await withAgreement();
    const logo = await upload(drive, 'ana', 'logo.png', 'image/png', PIXEL);
    const put = await ana.call('insert_image', { document: id, after_paragraph: 1, image: logo, width_cm: 2 });
    expect(put.isError).toBe(false);
    expect((await ana.call('read_document', { document: id })).content[0].text).toContain('[2] [image]');
    const notOne = await ana.call('insert_image', { document: id, after_paragraph: 1, image: id });
    expect(notOne).toMatchObject({ isError: true, content: [{ text: '"agreement.docx" is not a picture that goes in a document: PNG, JPEG or GIF.' }] });
  });

  it('say what the assistant got wrong, and what is not a Word document', async () => {
    const { ana, id } = await withAgreement();
    const missing = await ana.call('replace_text', { document: id, find: 'ninety', replace: 'x' });
    expect(missing.isError).toBe(true);
    expect((await ana.call('get_info', { id })).structuredContent.versions).toHaveLength(1);
    const notes = (await ana.call('create_text_file', { name: 'notes.txt', text: 'x' })).structuredContent;
    expect(await ana.call('read_document', { document: notes.id })).toMatchObject({ isError: true, content: [{ text: '"notes.txt" is text/plain, not a Word document (.docx).' }] });
    expect((await ana.call('compare_documents', { document: id })).content[0].text).toBe('"agreement.docx" has only one version: there is nothing earlier to compare it with.');
  });

  it('change a document only as the person may: a viewer reads, an editor writes', async () => {
    const { ana, bea, drive, id } = await withAgreement();
    expect((await bea.call('read_document', { document: id })).content[0].text).toBe('You may not do that here.');
    await share(drive, 'ana', id, 'bea', 'viewer');
    expect((await bea.call('read_document', { document: id })).isError).toBe(false);
    expect((await bea.call('replace_text', { document: id, find: 'thirty', replace: 'sixty' })).content[0].text).toBe('You may not do that here.');
    await share(drive, 'ana', id, 'bea', 'editor');
    expect((await bea.call('replace_text', { document: id, find: 'thirty', replace: 'sixty' })).isError).toBe(false);
    expect((await ana.call('get_info', { id })).structuredContent).toMatchObject({ modifiedBy: 'bea' });
  });

  it('do not write over a version someone saved while the tool ran', async () => {
    let id = '';
    let asked = 0;
    const { ana, drive } = setUp(async (request) => {
      // Ana saves hers from the browser as her assistant looks, before saving its own, whether the file is still as it read it.
      if (request.method === 'GET' && id && new URL(request.url).pathname === `/api/files/entries/${id}` && ++asked === 2)
        await upload(drive, 'ana', { file: id }, DOCX_TYPE, sampleDocx('Service agreement', ['Her own text.']));
    });
    id = await upload(drive, 'ana', 'agreement.docx', DOCX_TYPE, sampleDocx());
    const replaced = await ana.call('replace_text', { document: id, find: 'thirty', replace: 'sixty' });
    expect(replaced).toMatchObject({ isError: true });
    expect(replaced.content[0].text).toBe('"agreement.docx" was saved by ana while this was done, and was not changed: read it again and do it on what it is now.');
    expect((await ana.call('read_file', { id })).content[0].text).toBe('Service agreement\nHer own text.');
  });
});
