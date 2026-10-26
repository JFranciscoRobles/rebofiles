// Word documents previewed with Rebodocs' engine: the title and the first
// paragraphs, as a small page. Apart from the rest of the package, so that a
// drive without Rebodocs does not carry its engine.
//
//   import { previewDocx } from '@rebofiles/drive/rebodocs';
//   mountDrive(element, { previewDocument: previewDocx, viewDocument: viewDocx });

import { importDocx, outline, paragraphText } from '@rebodocs/core';
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

/** How a document is shown in the viewer: all its pages as many across as fit, or one by one, each whole. */
export type DocumentLayout = 'all' | 'pages';

/** A document shown in the viewer, as `viewDocument` gives it back. */
export interface DocumentView {
  /** How many pages it has. */
  readonly pages: number;
  layout(mode: DocumentLayout): void;
  destroy(): void;
}

/** The least width a page is shown at when all of them are, in pixels: an overview, to be read one by one; and the gap between them. */
const LEAST_WIDE = 140;
const GAP = 24;

/**
 * The width each page is shown at so that all of them fit in `width` × `height`, as many across as that takes,
 * the largest that does; when none is as wide as LEAST_WIDE, pages that wide, and the rest is scrolled to.
 */
export function pageWidthToFit(pages: number, ratio: number, width: number, height: number): number {
  let best = 0;
  for (let across = 1; across <= pages; across++) {
    const wide = (width - GAP * (across + 1)) / across;
    const rows = Math.ceil(pages / across);
    const tall = Math.min(wide, (height - GAP * (rows + 1)) / rows / ratio);
    best = Math.max(best, tall);
  }
  return best >= LEAST_WIDE ? best : Math.max(LEAST_WIDE, Math.min(220, (width - GAP * 2) / 2));
}

/**
 * A Word document's pages, by Rebodocs' editor, read only, for the viewer of the drive:
 * `mountDrive(element, { viewDocument: viewDocx })`. All of its pages at first, as large as lets them all fit on the
 * screen, or at the editor's least zoom (a quarter) for one too long to; with Rebodocs' bar of the zoom over them; `layout('pages')` shows them one under another, each whole on the screen. Its engine is loaded the first time.
 */
export async function viewDocx(element: HTMLElement, bytes: Uint8Array, context: { language?: string } = {}): Promise<DocumentView> {
  const { Editor, createStatusBar, setLocale } = await import('@rebodocs/editor');
  // In the drive's language: Rebodocs' words are its own, for all its editors in the page.
  if (context.language) setLocale(context.language);
  const editor = new Editor(element, importDocx(bytes));
  editor.readOnly = true;
  // Rebodocs' own bar, floating over the pages: the page one is on, how the page fits, and the zoom.
  const bar = document.createElement('div');
  bar.className = 'rf-doc-zoom';
  element.appendChild(bar);
  const status = createStatusBar(bar, editor, { layout: 'floating' });
  // One page under another, or all of them at once; a document only read has no notes to open nor language to set.
  for (const away of bar.querySelectorAll('[data-name="spread"], [data-name="flow"], [data-name="notes"], [data-name="language"]')) away.remove();
  let current: DocumentLayout = 'all';
  const layout = (mode: DocumentLayout) => {
    current = mode;
    if (mode === 'pages') {
      editor.setView('column');
      editor.setFit('page');
    } else {
      editor.setView('grid');
      // The size of a page at zoom 1, from the one it is shown at now.
      const page = element.querySelector<HTMLElement>('.dx-page');
      const width = (page?.offsetWidth ?? 816) / editor.zoom;
      const ratio = (page?.offsetHeight ?? 1056) / (page?.offsetWidth ?? 816);
      const fits = pageWidthToFit(editor.pageCount, ratio, element.clientWidth, element.clientHeight);
      editor.setZoom(Math.min(1, fits / width));
      // The editor's own gaps and margins are not quite those reckoned: measured once it has drawn, and made
      // smaller until all of it fits, as long as a page is still read.
      let tries = 0;
      const shrink = () => {
        if (current !== 'all' || tries++ >= 4 || element.scrollHeight <= element.clientHeight + 1) return;
        const smaller = editor.zoom * (element.clientHeight / element.scrollHeight) * 0.99;
        const before = editor.zoom;
        if (smaller * width < LEAST_WIDE) return;
        editor.setZoom(smaller);
        // The editor goes no smaller than its least zoom: a long document is then scrolled through.
        if (editor.zoom === before) return;
        requestAnimationFrame(() => requestAnimationFrame(shrink));
      };
      if (fits >= LEAST_WIDE) requestAnimationFrame(() => requestAnimationFrame(shrink));
    }
    // From the first page, whichever way.
    element.scrollTop = 0;
    for (const inside of element.querySelectorAll<HTMLElement>('*')) if (inside.scrollTop) inside.scrollTop = 0;
  };
  layout('pages');
  // The bar's buttons of the views set them out as Rebodocs does; here, all the pages fit on the screen, or each one does.
  let shownView = editor.view;
  const offChange = editor.onChange(() => {
    if (editor.view === shownView) return;
    shownView = editor.view;
    // After the bar has done its own, which sets a zoom of its choosing once the view is set.
    const mode: DocumentLayout | undefined = editor.view === 'grid' ? 'all' : editor.view === 'column' ? 'pages' : undefined;
    if (mode) setTimeout(() => editor.view === shownView && layout(mode));
  });
  return {
    pages: editor.pageCount,
    layout,
    destroy: () => {
      offChange();
      status.destroy();
      editor.destroy();
    },
  };
}

/** Thumbnails made one at a time: each needs an editor laid out for a moment. */
let making: Promise<unknown> = Promise.resolve();

/**
 * The first page of a Word document as Rebodocs draws it, for a thumbnail: drawn once by its editor out of
 * sight, and given as the element of that page, at its real size (`data-width`, `data-height` in pixels), to be
 * shown made smaller. `mountDrive(element, { thumbDocument: thumbDocx })`.
 */
export function thumbDocx(bytes: Uint8Array): Promise<HTMLElement> {
  const made = making.then(async () => {
    const { Editor } = await import('@rebodocs/editor');
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:1400px;overflow:hidden;visibility:hidden;pointer-events:none';
    document.body.appendChild(box);
    const editor = new Editor(box, importDocx(bytes));
    try {
      editor.readOnly = true;
      editor.setZoom(1);
      // Its text is put in the page as it comes into view: a frame or two after.
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const page = box.querySelector<HTMLElement>('.dx-page');
      if (!page) throw new Error('The document has no page to show.');
      // Its pictures as data while the editor holds them: closed, it lets their addresses go.
      await Promise.all([...page.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
      const copy = page.cloneNode(true) as HTMLElement;
      const originals = [...page.querySelectorAll('img')];
      await Promise.all(
        [...copy.querySelectorAll('img')].map(async (img, i) => {
          try {
            img.src = await dataUrl(await (await fetch(originals[i].src)).blob());
          } catch {
            img.remove();
          }
        }),
      );
      copy.dataset.width = String(page.offsetWidth);
      copy.dataset.height = String(page.offsetHeight);
      for (const away of copy.querySelectorAll('[contenteditable], textarea, input, .dx-caret, .dx-sel')) away.remove();
      // In the editor's own class, so the rules of its pages still hold outside it.
      const shell = document.createElement('div');
      shell.className = 'dx-editor dx-readonly';
      shell.appendChild(copy);
      shell.dataset.width = copy.dataset.width;
      shell.dataset.height = copy.dataset.height;
      return shell;
    } finally {
      editor.destroy();
      box.remove();
    }
  });
  making = made.catch(() => undefined);
  return made;
}

/** A blob as a data address, for what is drawn inside a picture, which may load nothing from elsewhere. */
const dataUrl = (blob: Blob) =>
  new Promise<string>((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * The first page of a Word document as a picture, its longest side `size` pixels: what Rebodocs' editor draws,
 * put in an SVG with the editor's stylesheet and drawn on a canvas. Its pictures go in it; a font the document
 * carries is drawn in the one of the system nearest it. JPEG, or PNG when `type` says.
 */
export async function pictureOfDocx(bytes: Uint8Array, size: number, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  const shell = await thumbDocx(bytes);
  const width = Number(shell.dataset.width) || 816;
  const height = Number(shell.dataset.height) || 1056;
  // Its pictures as data, and anything drawn on a canvas as a picture: an SVG drawn as a picture reaches nothing outside.
  for (const img of shell.querySelectorAll('img')) {
    try {
      img.src = await dataUrl(await (await fetch(img.src)).blob());
    } catch {
      img.remove();
    }
  }
  for (const canvas of shell.querySelectorAll('canvas')) {
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.style.cssText = canvas.style.cssText;
    img.width = canvas.width;
    canvas.replaceWith(img);
  }
  const css = [...document.querySelectorAll('style')]
    .map((style) => style.textContent ?? '')
    .filter((text) => text.includes('.dx-'))
    .join('\n');
  const page = shell.querySelector<HTMLElement>('.dx-page');
  if (page) page.style.cssText += ';position:absolute;left:0;top:0;margin:0;box-shadow:none;transform:none';
  const xhtml = new XMLSerializer().serializeToString(shell);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#fff;position:relative"><style>${css.replace(/]]>/g, '')}</style>${xhtml}</div></foreignObject></svg>`;
  const picture = new Image();
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await picture.decode();
  const scale = size / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The page could not be drawn.'))), type, quality));
}
