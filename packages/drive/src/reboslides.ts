// Decks (.reboslides) in the drive with ReboSlides' engine: the first slide
// as their thumbnail, the whole deck in the viewer, and their text to find
// them by. Apart from the rest of the package, so that a drive without
// ReboSlides does not carry its engine.
//
//   import { slidesFormat } from '@rebofiles/drive/reboslides';
//   mountDrive(element, { formats: [slidesFormat] });

import { parseDeck, plainTextOf } from '@reboslides/core';
import type { FileFormat, ShownDocument } from './screen';

/** Whether a file is a deck, by its name or its type. */
export const isDeck = (file: { name: string; type: string }): boolean => /\.reboslides$/i.test(file.name) || file.type === 'application/vnd.reboslides+json';

/** A canvas as the bytes of a picture of `type`. */
const blobOf = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The slide could not be drawn.'))), type, quality));

/**
 * The first slide of a deck as a picture, its longest side `size` pixels, as ReboSlides draws it: its pictures and
 * its fonts waited for. JPEG, or what `type` says. `mountDrive(element, { formats: [slidesFormat] })` makes it.
 */
export async function pictureOfDeck(bytes: Uint8Array, size: number, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  const { deckOf, slideCanvas } = await import('@reboslides/viewer');
  const deck = deckOf(bytes);
  const { width, height } = deck.size;
  const canvas = await slideCanvas(deck, 0, width >= height ? size : (size * width) / height);
  return blobOf(canvas, type, quality);
}

/**
 * A deck shown in the viewer of the drive, by ReboSlides' viewer: its slides one under another, with a bar to see
 * them as a grid, present and print. Its engine is loaded the first time.
 */
export async function viewDeck(element: HTMLElement, bytes: Uint8Array, context: { language?: string } = {}): Promise<ShownDocument> {
  const { createViewer } = await import('@reboslides/viewer');
  const viewer = createViewer(element, bytes, { locale: context.language });
  return {
    pages: viewer.deck.slides.length,
    layout: (mode) => viewer.setLayout(mode === 'all' ? 'grid' : 'slides'),
    print: () => viewer.print(),
    destroy: () => viewer.destroy(),
  };
}

/** What is written in a deck, its title, each slide's texts and its notes, a line each: to find it by. */
export function textOfDeck(bytes: Uint8Array): string {
  const deck = parseDeck(new TextDecoder().decode(bytes));
  const lines = [deck.title];
  for (const slide of deck.slides) {
    for (const element of slide.elements) if (element.type === 'text') lines.push(plainTextOf(element));
    if (slide.notes) lines.push(slide.notes);
  }
  return lines.filter(Boolean).join('\n');
}

/** Decks for the drive's `formats`: their thumbnail, their viewer and their text. */
export const slidesFormat: FileFormat = { test: isDeck, picture: pictureOfDeck, view: viewDeck, text: textOfDeck };
