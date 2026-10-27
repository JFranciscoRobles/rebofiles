// The QR codes of addresses, read back by a reader of QR codes (jsQR), as a
// phone's camera would: short and long, of every size of version they need.

import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvg } from '../src/qr';

/** What a reader makes of a matrix drawn as pixels, four to a module, with its quiet zone. */
function read(modules: boolean[][]): string | undefined {
  const scale = 4;
  const side = (modules.length + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const at = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
    }),
  );
  return jsQR(pixels, side, side)?.data;
}

describe('a QR code', () => {
  it.each([
    'https://a.co',
    'https://files.acme.test/?link=eyJwdXJwb3NlIjoibGluayIsImxpbmsiOiJiMmM0In0.q9Zr7sdLk2',
    `https://files.acme.test/s/${'x'.repeat(180)}`,
    `https://files.acme.test/s/${'y'.repeat(400)}`,
    'Solicitud de Northwind · 合同',
  ])('reads back as %s', (text) => {
    const modules = qrMatrix(text);
    expect(read(modules)).toBe(text);
  });

  it('is of the smallest version that holds it', () => {
    expect(qrMatrix('https://a.co')).toHaveLength(21);
    expect(qrMatrix('x'.repeat(200)).length).toBeGreaterThan(45);
  });

  it('is refused for what no QR code holds', () => {
    expect(() => qrMatrix('x'.repeat(3000))).toThrow(/too long/);
  });

  it('is drawn as SVG, one path with a quiet zone', () => {
    const svg = qrSvg('https://a.co');
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 29 29"/);
    expect(svg.match(/<path /g)).toHaveLength(1);
  });
});
