// Pictures made smaller in the page before they go up: one for each size of
// the drive's settings that is smaller than the picture, its longest side at
// most that many pixels. As JPEG, smallest for photos, unless the settings say
// to keep the type of the original. The original goes up as it is, and stays.

import type { ImageSettings } from '@rebofiles/core';

export interface MadeRendition {
  blob: Blob;
  size: number;
  width: number;
  height: number;
}

/** What the page can draw and make smaller: not a drawing (SVG), nor what moves (GIF). */
const MADE_SMALLER = /^image\/(jpeg|png|webp|bmp|avif)$/;
/** What a canvas writes in every browser; anything else is made a JPEG. */
const WRITTEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const makesRenditions = (type: string) => MADE_SMALLER.test(type);

/** The smaller pictures of `file`, as the settings say; none for what is not a picture, or where there is no canvas. */
export async function renditionsOf(file: Blob, images: ImageSettings): Promise<MadeRendition[]> {
  if (!images.enabled || !makesRenditions(file.type) || typeof createImageBitmap !== 'function') return [];
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const type = images.format === 'original' && WRITTEN.has(file.type) ? file.type : 'image/jpeg';
    const made: MadeRendition[] = [];
    for (const size of images.sizes) {
      // Never larger than it is: what is shown larger than the last size is the original.
      if (size >= longest) break;
      const scale = size / longest;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      made.push({ blob: await draw(bitmap, width, height, type, images.quality), size, width, height });
    }
    return made;
  } finally {
    bitmap.close();
  }
}

async function draw(bitmap: ImageBitmap, width: number, height: number, type: string, quality: number): Promise<Blob> {
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  // A JPEG has no transparency: what was transparent is white, not black.
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The picture could not be made smaller.'))), type, quality));
}

/** The longest side of a placeholder, in pixels: blurred, a few are enough to show what is coming. */
export const PLACEHOLDER_SIZE = 16;

/**
 * A tiny picture of `picture`, as a data: URL of a few hundred bytes, to keep with its version and show blurred while
 * the picture itself comes. Undefined for what the page cannot draw.
 */
export async function placeholderOf(picture: Blob): Promise<string | undefined> {
  if (!makesRenditions(picture.type) || typeof createImageBitmap !== 'function') return undefined;
  const bitmap = await createImageBitmap(picture);
  try {
    const scale = PLACEHOLDER_SIZE / Math.max(bitmap.width, bitmap.height, 1);
    const width = Math.max(1, Math.round(bitmap.width * Math.min(1, scale)));
    const height = Math.max(1, Math.round(bitmap.height * Math.min(1, scale)));
    const blob = await draw(bitmap, width, height, 'image/jpeg', 0.6);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } finally {
    bitmap.close();
  }
}
