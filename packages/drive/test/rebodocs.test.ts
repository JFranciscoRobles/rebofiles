import { describe, expect, it } from 'vitest';
import { sampleDocx } from '../../../tools/sample-docx';
import { pageWidthToFit, previewDocx } from '../src/rebodocs';

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

describe('the pages of a document, all at once', () => {
  const ratio = 11 / 8.5;
  it('are as large as lets all of them fit on the screen', () => {
    const one = pageWidthToFit(1, ratio, 1200, 700);
    // One page: as tall as the screen.
    expect(Math.round(one * ratio)).toBe(700 - 48);
    const three = pageWidthToFit(3, ratio, 1200, 700);
    expect(three * ratio).toBeLessThanOrEqual(700);
    expect(Math.ceil(3 / Math.floor(1200 / (three + 24)))).toBe(1);
  });

  it('are an overview of a set width for one too long to fit, to be scrolled', () => {
    expect(pageWidthToFit(80, ratio, 1200, 700)).toBe(220);
  });
});
