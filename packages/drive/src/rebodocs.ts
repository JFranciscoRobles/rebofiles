// Word documents previewed with Rebodocs' engine: the title and the first
// paragraphs, as a small page. Apart from the rest of the package, so that a
// drive without Rebodocs does not carry its engine.
//
//   import { previewDocx } from '@rebofiles/drive/rebodocs';
//   mountDrive(element, { previewDocument: previewDocx, viewDocument: viewDocx });

import { importDocx, outline, paragraphText } from '@rebodocs/core';
import type { ViewerLayout } from '@rebodocs/viewer';
import type { DocumentPreview } from './kinds';

/** How many paragraphs a preview shows, at most. */
const SHOWN = 8;

export function previewDocx(bytes: Uint8Array): DocumentPreview {
  const doc = importDocx(bytes);
  const texts = doc.paragraphs.map((p) => paragraphText(p).replace(/\s+/g, ' ').trim());
  // The title is the first heading at the top level, or else the first line with text.
  const heading = outline(doc).find((item) => item.level <= 1);
  const titlePara = heading?.para ?? texts.findIndex(Boolean);
  const title = titlePara >= 0 ? texts[titlePara] : '';
  const paragraphs = texts.filter((text, i) => text && i !== titlePara).slice(0, SHOWN);
  return { title, paragraphs };
}

/** What is written in a Word document, a paragraph a line: for the drive to find it by (`textDocument`). */
export function textOfDocx(bytes: Uint8Array): string {
  return importDocx(bytes)
    .paragraphs.map((p) => paragraphText(p))
    .join('\n');
}

/** How a document is shown in the viewer: all its pages as many across as fit, or one by one, each whole. */
export type DocumentLayout = ViewerLayout;

/** A document shown in the viewer, as `viewDocument` gives it back. */
export interface DocumentView {
  /** How many pages it has. */
  readonly pages: number;
  layout(mode: DocumentLayout): void;
  /** The browser's print dialog, with the pages as they are laid out: to paper, or to a PDF. */
  print(): void;
  destroy(): void;
}

/**
 * A Word document's pages, by Rebodocs' viewer, for the viewer of the drive: `mountDrive(element, { viewDocument:
 * viewDocx })`. One page under another at first, each whole on the screen, with Rebodocs' bar of the views and the
 * zoom over them; `layout('all')` sets all of them out at once. Its engine is loaded the first time.
 */
export async function viewDocx(element: HTMLElement, bytes: Uint8Array, context: { language?: string } = {}): Promise<DocumentView> {
  const { createViewer, setLocale } = await import('@rebodocs/viewer');
  // In the drive's language: Rebodocs' words are its own, for all its editors in the page.
  if (context.language) setLocale(context.language);
  const viewer = createViewer(element, bytes);
  return {
    get pages() {
      return viewer.pages;
    },
    layout: (mode) => viewer.setLayout(mode),
    print: () => viewer.print(),
    destroy: () => viewer.destroy(),
  };
}

/**
 * The first page of a Word document as Rebodocs draws it, for a thumbnail: drawn once out of sight, and given as
 * the element of that page, at its real size (`data-width`, `data-height` in pixels), to be shown made smaller.
 * `mountDrive(element, { thumbDocument: thumbDocx })`.
 */
export async function thumbDocx(bytes: Uint8Array): Promise<HTMLElement> {
  const { pageThumbnail } = await import('@rebodocs/viewer');
  return pageThumbnail(bytes);
}

/**
 * The first page of a Word document as a picture, its longest side `size` pixels, as Rebodocs' viewer draws it. Its
 * pictures go in it; a font the document carries is drawn in the one of the system nearest it. JPEG, or PNG when
 * `type` says.
 */
export async function pictureOfDocx(bytes: Uint8Array, size: number, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  const { pagePicture } = await import('@rebodocs/viewer');
  return pagePicture(bytes, size, { type, quality });
}
