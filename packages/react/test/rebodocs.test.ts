import { describe, expect, it } from 'vitest';
import { sampleDocx } from '../../../tools/sample-docx';
import { previewDocx } from '../src/rebodocs';

describe('the preview of a Word document', () => {
  it('takes its title from the first heading and the paragraphs after it', () => {
    expect(previewDocx(sampleDocx())).toEqual({
      title: 'Service agreement',
      paragraphs: ['The parties agree to what follows.', 'Payment is due within thirty days.', 'Either party may end it in writing.'],
    });
  });

  it('shows eight paragraphs at most', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Clause ${i + 1}.`);
    expect(previewDocx(sampleDocx('Long', many)).paragraphs).toHaveLength(8);
  });
});
