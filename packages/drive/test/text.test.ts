import { describe, expect, it } from 'vitest';
import { textOf } from '../src/text';

describe('the text of a file', () => {
  it('is read from text, by its type or its name, and from a Word document by what reads it', async () => {
    expect(await textOf(new Blob(['hello'], { type: 'text/plain' }), 'a.bin')).toBe('hello');
    expect(await textOf(new Blob(['# Title']), 'notes.md')).toBe('# Title');
    expect(await textOf(new Blob([new Uint8Array([1, 0, 2])]), 'fake.txt')).toBeUndefined();
    expect(await textOf(new Blob(['x'], { type: 'image/png' }), 'a.png')).toBeUndefined();
    const docx = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(await textOf(docx, 'contract.docx')).toBeUndefined();
    expect(await textOf(docx, 'contract.docx', (bytes) => `read ${bytes.length} bytes`)).toBe('read 2 bytes');
  });
});
