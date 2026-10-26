import { describe, expect, it } from 'vitest';
import { textMatch, wordsOf } from '../src';

describe('text found in a file', () => {
  it('has every word of the query, without case or accents', () => {
    expect(textMatch('Llamar a Acmé el lunes', 'acme LUNES')).not.toBeNull();
    expect(textMatch('Llamar a Acmé el lunes', 'acme martes')).toBeNull();
    expect(textMatch('anything', '  ')).toBeNull();
    expect(wordsOf('Canción, “final”!')).toEqual(['cancion', 'final']);
  });

  it('is shown in a piece around the first word found, as the text is, cut at whole words', () => {
    const text = `${'palabra '.repeat(30)}la canción del verano ${'otra '.repeat(30)}`;
    const { snippet } = textMatch(text, 'cancion')!;
    expect(snippet).toContain('la canción del verano');
    expect(snippet.startsWith('…palabra')).toBe(true);
    expect(snippet.endsWith('otra…')).toBe(true);
    expect(snippet.length).toBeLessThan(150);
    expect(textMatch('Canción corta', 'corta')!.snippet).toBe('Canción corta');
  });
});
