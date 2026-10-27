// A QR code of a text, as the standard (ISO/IEC 18004) draws one: its bytes
// in byte mode, with correction of errors at level M (15% of it may be lost),
// in the smallest version from 1 to 40 that holds them, and the mask that
// reads best. For the address of a link, shown to a phone's camera; nothing
// to install. Made after Project Nayuki's, which is MIT.

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
/** Level M's two bits in the format information. */
const LEVEL_M = 0;

/** How many modules of a version hold data and correction, all but those of its patterns. */
function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = (version: number) => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

/** Multiplied in GF(2⁸) modulo x⁸ + x⁴ + x³ + x² + 1. */
function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
}
function remainder(data: number[], by: number[]): number[] {
  const result = by.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    by.forEach((coefficient, i) => (result[i] ^= multiply(coefficient, factor)));
  }
  return result;
}

/** The centres of the alignment patterns of a version, on each axis. */
function alignmentAt(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let at = version * 4 + 10; result.length < count; at -= step) result.splice(1, 0, at);
  return result;
}

/** A QR code of `text`: its modules, row by row, true where dark. Throws for a text longer than a QR code holds. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  for (; ; version++) {
    if (version > 40) throw new Error('The text is too long for a QR code.');
    const bits = 4 + (version < 10 ? 8 : 16) + bytes.length * 8;
    if (bits <= dataCodewords(version) * 8) break;
  }
  // The bits: byte mode, the count, the bytes; ended, and filled to the size.
  const bits: number[] = [];
  const put = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(version) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // In blocks, each with its correction, interleaved.
  const blocks = BLOCKS[version];
  const eccLength = ECC_PER_BLOCK[version];
  const raw = Math.floor(rawModules(version) / 8);
  const short = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks);
  const by = divisor(eccLength);
  const made: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const part = data.slice(k, k + shortLength - eccLength + (i < short ? 0 : 1));
    k += part.length;
    const ecc = remainder(part, by);
    if (i < short) part.push(0);
    made.push([...part, ...ecc]);
  }
  const codewords: number[] = [];
  for (let i = 0; i < made[0].length; i++) made.forEach((block, j) => (i !== shortLength - eccLength || j >= short) && codewords.push(block[i]));

  // The patterns, then the codewords between them.
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
      }
  const centres = alignmentAt(version);
  const last = centres.length - 1;
  centres.forEach((cx, i) =>
    centres.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const format = (mask: number) => {
    const value = (LEVEL_M << 3) | mask;
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const word = ((value << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((word >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const word = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((word >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  let at = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && at < codewords.length * 8) {
          modules[y][x] = ((codewords[at >>> 3] >>> (7 - (at & 7))) & 1) !== 0;
          at++;
        }
      }
  }

  // The mask that leaves the fewest patterns a reader could take for others.
  const masked = (mask: number, x: number, y: number) =>
    [
      (x + y) % 2 === 0,
      y % 2 === 0,
      x % 3 === 0,
      (x + y) % 3 === 0,
      (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0,
      (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][mask];
  const apply = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && masked(mask, x, y)) modules[y][x] = !modules[y][x];
  };
  let best = 0;
  let least = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    apply(mask);
    format(mask);
    const score = penalty(modules);
    if (score < least) (least = score), (best = mask);
    apply(mask);
  }
  apply(best);
  format(best);
  return modules;
}

/** How hard a matrix is to read: long runs, blocks of one colour, what looks like a finder, and too much of one colour. */
function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let result = 0;
  const lines: boolean[][] = [...modules, ...modules[0].map((_, x) => modules.map((row) => row[x]))];
  const finder = [true, false, true, true, true, false, true];
  for (const line of lines) {
    for (let i = 0, run = 1; i < size; i++, run++)
      if (i === size - 1 || line[i] !== line[i + 1]) {
        if (run >= 5) result += 3 + (run - 5);
        run = 0;
      }
    for (let i = 0; i + 7 <= size; i++) {
      if (!finder.every((dark, k) => line[i + k] === dark)) continue;
      const before = i >= 4 && [1, 2, 3, 4].every((k) => !line[i - k]);
      const after = i + 11 <= size && [7, 8, 9, 10].every((k) => !line[i + k]);
      if (before) result += 40;
      if (after) result += 40;
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x < size - 1 && y < size - 1 && modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) result += 3;
    }
  const total = size * size;
  return result + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

/** A QR code as SVG: one path of its dark modules, with a quiet zone of `margin` modules around. */
export function qrSvg(text: string, how: { margin?: number; dark?: string; light?: string } = {}): string {
  const modules = qrMatrix(text);
  const margin = how.margin ?? 4;
  const side = modules.length + margin * 2;
  let path = '';
  modules.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x + margin},${y + margin}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="${how.light ?? '#fff'}"/><path d="${path}" fill="${how.dark ?? '#000'}"/></svg>`;
}

/** A QR code as a PNG of about `pixels` on each side, to download and print. */
export async function qrPng(text: string, pixels = 1024): Promise<Blob> {
  const modules = qrMatrix(text);
  const side = modules.length + 8;
  const scale = Math.max(1, Math.floor(pixels / side));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side * scale;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  modules.forEach((row, y) => row.forEach((on, x) => on && context.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale)));
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The QR code could not be drawn.'))), 'image/png'));
}
