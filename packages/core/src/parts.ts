// How a file's bytes are cut to be sent, the same in the page and on the
// server: parts of 8 MiB, more for a file that would need more than S3's ten
// thousand, the last as long as what is left.

const MiB = 1024 * 1024;

/** How many bytes go in each part of an upload: S3 takes parts of 5 MiB at least, but for the last. */
export const PART_SIZE = 8 * MiB;

/** The most parts S3 puts together into one object. */
export const MAX_PARTS = 10_000;

/** The bytes of each part of a file of `size`: PART_SIZE, or more, in whole MiB, for a file that would need more than MAX_PARTS. */
export const partSizeOf = (size: number): number => Math.max(PART_SIZE, Math.ceil(size / MAX_PARTS / MiB) * MiB);

/** The parts of a file of `size` bytes: one for a small file, as a part of its own costs a request. */
export function partsOf(size: number): { number: number; from: number; to: number }[] {
  const parts = [];
  const each = partSizeOf(size);
  for (let from = 0, number = 1; from < size || number === 1; from += each, number++) parts.push({ number, from, to: Math.min(size, from + each) });
  return parts;
}
