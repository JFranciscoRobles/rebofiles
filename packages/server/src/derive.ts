// What the server can make of a file itself, for `derive` of createDriveHandler:
// smaller pictures and a placeholder of a picture (with sharp), the first page
// of a PDF as a picture and its text (with pdf.js and @napi-rs/canvas), what is
// written in a Word document (with Rebodocs) and in a file of text. Each is
// imported when it is first needed, so only what is used is installed.
//
//   import { deriveAll } from '@rebofiles/server/derive';
//   createDriveHandler({ ...options, derive: deriveAll() });

import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { readXlsx, splitName, textOfSheets } from '@rebofiles/core';
import type { Derive, Derived, ToDerive } from './made';

export type { Derive, Derived, ToDerive } from './made';

/** The most bytes of a file read to make something of it: more is left as it is. */
const READ_UP_TO = 100 * 1024 * 1024;
/** The most characters of text kept, as the server keeps them. */
const TEXT_UP_TO = 100_000;
/** The sizes a page of a document is drawn at, as the page of the drive draws a Word document: the grid's and the details'. */
const PAGE_SIZES = [320, 640];

const extensionOf = (name: string) => splitName(name).ext.slice(1).toLowerCase();
const isPicture = (file: ToDerive['file']) =>
  /^image\/(png|jpeg|gif|webp|avif|tiff|heic|heif)$/.test(file.type) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'tif', 'tiff', 'heic'].includes(extensionOf(file.name));
const isVideo = (file: ToDerive['file']) => file.type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(extensionOf(file.name));
const isPdf = (file: ToDerive['file']) => file.type === 'application/pdf' || extensionOf(file.name) === 'pdf';
const isDocx = (file: ToDerive['file']) => file.type.includes('wordprocessingml') || extensionOf(file.name) === 'docx';
const TEXT_TYPES = /^(text\/|application\/(json|xml|yaml|x-yaml|javascript|csv|x-sh|sql))/;
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
  'html',
  'htm',
  'css',
  'js',
  'ts',
  'tsx',
  'jsx',
  'ini',
  'toml',
  'sql',
  'sh',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'h',
  'cpp',
  'swift',
  'kt',
]);
const isText = (file: ToDerive['file']) => TEXT_TYPES.test(file.type) || TEXT_EXTENSIONS.has(extensionOf(file.name));
const small = (file: ToDerive['file']) => file.versions[0].size <= READ_UP_TO;

/** The sizes of the drive's that a picture of `longest` pixels is made smaller to: none it would be made larger to. */
const smallerThan = (sizes: readonly number[], longest: number) => sizes.filter((size) => size < longest);
/** Of the drive's sizes, the ones a page is drawn at: the least that is as large as each the grid and the details show. */
const pageSizes = (sizes: readonly number[]) => [...new Set(PAGE_SIZES.map((wanted) => sizes.find((size) => size >= wanted) ?? sizes[sizes.length - 1]))];

type Sharp = typeof import('sharp').default;
let sharpModule: Promise<Sharp> | undefined;
const loadSharp = () => (sharpModule ??= import('sharp').then((m) => (m as unknown as { default?: Sharp }).default ?? (m as unknown as Sharp)));

/** Smaller pictures of a picture in the drive's sizes, as JPEG at its quality (or in its own format, for `original`), and its placeholder. */
export function pictures(): Derive {
  return async ({ file, read, images, want }) => {
    if (!want.pictures || !isPicture(file) || !small(file)) return;
    return picturesOf(await read(), images);
  };
}

/** The smaller pictures of a picture's bytes, in the drive's sizes, and its placeholder, with sharp. */
async function picturesOf(bytes: Uint8Array, images: ToDerive['images']): Promise<Derived> {
  const sharp = await loadSharp();
  const meta = await sharp(bytes).metadata();
  // Turned as the camera said it was held: its width and height as it is shown.
  const turned = (meta.orientation ?? 1) >= 5;
  const longest = Math.max((turned ? meta.height : meta.width) ?? 0, (turned ? meta.width : meta.height) ?? 0);
  const quality = Math.round(images.quality * 100);
  const renditions: NonNullable<Derived['renditions']> = [];
  for (const size of smallerThan(images.sizes, longest)) {
    const shaped = sharp(bytes).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: true });
    const kept = images.format === 'original' && meta.format && ['png', 'webp', 'gif', 'avif'].includes(meta.format);
    const { data, info } = await (kept ? shaped.toFormat(meta.format as 'png') : shaped.jpeg({ quality, mozjpeg: true })).toBuffer({ resolveWithObject: true });
    renditions.push({ size, width: info.width, height: info.height, type: kept ? `image/${info.format}` : 'image/jpeg', bytes: new Uint8Array(data) });
  }
  const tiny = await sharp(bytes).rotate().resize(16, 16, { fit: 'inside' }).webp({ quality: 40 }).toBuffer();
  return { renditions, placeholder: `data:image/webp;base64,${tiny.toString('base64')}` };
}

export interface VideoOptions {
  /** The ffmpeg to run: `ffmpeg` on the path unless said, or the one of `ffmpeg-static`. */
  ffmpeg?: string;
  /** The second its frame is taken at: 1 unless said, the first for a video shorter. */
  at?: number;
}

/**
 * A frame of a video, as its pictures in the drive's sizes and its placeholder: what the grid and the details show of
 * it, for a video that came from no page (an assistant, a sync). With ffmpeg, which has to be installed, and sharp.
 */
export function video(options: VideoOptions = {}): Derive {
  return async ({ file, read, images, want }) => {
    if (!want.pictures || !isVideo(file) || !small(file)) return;
    const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { execFile } = await import('node:child_process');
    // On the disk, as ffmpeg reads where a video keeps what it is made of, often at its end.
    const folder = await mkdtemp(join(tmpdir(), 'rebofiles-video-'));
    try {
      const input = join(folder, `in.${extensionOf(file.name) || 'mp4'}`);
      const output = join(folder, 'frame.png');
      await writeFile(input, await read());
      const frame = (at: number) =>
        new Promise<void>((done, fail) =>
          execFile(options.ffmpeg ?? 'ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', input, '-frames:v', '1', output], { timeout: 60_000 }, (error) => (error ? fail(error) : done())),
        );
      await frame(options.at ?? 1);
      let bytes = await readFile(output).catch(() => undefined);
      if (!bytes?.length) {
        await frame(0);
        bytes = await readFile(output);
      }
      return picturesOf(new Uint8Array(bytes), images);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  };
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfModule: Promise<PdfJs> | undefined;
const loadPdf = () => (pdfModule ??= import('pdfjs-dist/legacy/build/pdf.mjs'));
/** Where pdf.js keeps the fonts every PDF may use without having them: a folder of its own package. */
const standardFonts = () => {
  try {
    return join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts') + sep;
  } catch {
    return undefined;
  }
};

/** Of a PDF: what is written in it, its first fifty pages; and its first page drawn, as the grid and the details show it. */
export function pdf(options: { pages?: number } = {}): Derive {
  return async ({ file, read, images, want }) => {
    if ((!want.pictures && !want.text) || !isPdf(file) || !small(file)) return;
    const { getDocument } = await loadPdf();
    const loading = getDocument({ data: await read(), standardFontDataUrl: standardFonts(), verbosity: 0 });
    const doc = await loading.promise;
    try {
      const made: Derived = {};
      if (want.text) {
        const said: string[] = [];
        for (let n = 1; n <= Math.min(doc.numPages, options.pages ?? 50); n++) {
          const content = await (await doc.getPage(n)).getTextContent();
          said.push(content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join(''));
          if (said.join('\n').length > TEXT_UP_TO) break;
        }
        // A page scanned has no text: none said, for what reads pictures (`ocr`) to read it.
        const written = said.join('\n').trim();
        if (written) made.text = written.slice(0, TEXT_UP_TO);
      }
      if (want.pictures) {
        const page = await doc.getPage(1);
        const natural = page.getViewport({ scale: 1 });
        const draw = async (size: number, type: 'image/webp' | 'image/jpeg' | 'image/png') => {
          const viewport = page.getViewport({ scale: size / Math.max(natural.width, natural.height) });
          const { canvas, context } = (doc.canvasFactory as { create(w: number, h: number): unknown }).create(Math.round(viewport.width), Math.round(viewport.height)) as unknown as {
            canvas: { width: number; height: number; encode(format: string, quality?: number): Promise<Uint8Array> };
            context: { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void };
          };
          // Paper: a page without a colour of its own is white, not see-through.
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;
          const format = type.split('/')[1];
          return { width: canvas.width, height: canvas.height, bytes: new Uint8Array(await canvas.encode(format, format === 'png' ? undefined : Math.round(images.quality * 100))) };
        };
        // A page is mostly text, which WebP keeps sharper and lighter than JPEG, as the page of the drive makes them.
        const type = images.format === 'original' ? 'image/png' : 'image/webp';
        made.renditions = [];
        for (const size of pageSizes(images.sizes)) made.renditions.push({ size, type, ...(await draw(size, type)) });
        const tiny = await draw(24, 'image/png');
        made.placeholder = `data:image/png;base64,${Buffer.from(tiny.bytes).toString('base64')}`;
      }
      return made;
    } finally {
      await loading.destroy();
    }
  };
}

/** What is written in a Word document, by Rebodocs' engine (`@rebodocs/core`). */
export function docx(): Derive {
  return async ({ file, read, want }) => {
    if (!want.text || !isDocx(file) || !small(file)) return;
    const rebodocs = await import('@rebodocs/core');
    const document = rebodocs.importDocx(await read());
    return {
      text: document.paragraphs
        .map((paragraph) => rebodocs.paragraphText(paragraph))
        .join('\n')
        .slice(0, TEXT_UP_TO),
    };
  };
}

/** What is written in an Excel workbook, its cells a row a line: read by core, with nothing to install. */
export function xlsx(): Derive {
  return async ({ file, read, want }) => {
    if (!want.text || !small(file) || !(extensionOf(file.name) === 'xlsx' || file.type.includes('spreadsheetml'))) return;
    return { text: textOfSheets(await readXlsx(await read(), { rows: 5000, columns: 100 })).slice(0, TEXT_UP_TO) };
  };
}

const OCR_PICTURES = /^image\/(png|jpeg|webp|bmp|x-portable-bitmap)$/;

/** The first pages of a PDF drawn as PNG, their longest side `size` pixels: for what reads pictures. */
async function pagesOfPdf(bytes: Uint8Array, pages: number, size: number): Promise<Uint8Array[]> {
  const { getDocument } = await loadPdf();
  const loading = getDocument({ data: bytes, standardFontDataUrl: standardFonts(), verbosity: 0 });
  const doc = await loading.promise;
  try {
    const drawn: Uint8Array[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, pages); n++) {
      const page = await doc.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: size / Math.max(natural.width, natural.height) });
      const { canvas, context } = (doc.canvasFactory as { create(w: number, h: number): unknown }).create(Math.round(viewport.width), Math.round(viewport.height)) as unknown as {
        canvas: { encode(format: string): Promise<Uint8Array> };
        context: { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void };
      };
      context.fillStyle = '#fff';
      context.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;
      drawn.push(new Uint8Array(await canvas.encode('png')));
    }
    return drawn;
  } finally {
    await loading.destroy();
  }
}

export interface OcrOptions {
  /** The languages written in the pictures, as Tesseract names them: `['eng']` unless said; `['eng', 'spa']`. */
  languages?: string[];
  /** How many pages of a PDF without text are read: 3 unless said. */
  pages?: number;
  /** Where the data of each language is fetched from: Tesseract's own on a CDN unless said, a folder or an address of yours. */
  langPath?: string;
  /** Where that data is kept once fetched, not to fetch it again: the system's folder of temporary files unless said. */
  cachePath?: string;
}

/**
 * What is written in a picture, and in a PDF scanned (with no text of its own), read by Tesseract (`tesseract.js`):
 * a photo of a receipt, a contract scanned, found by their words. Not among those `deriveAll()` makes unless given,
 * as the data of a language is fetched the first time: `deriveAll(pictures(), pdf(), docx(), xlsx(), text(), ocr())`.
 * After `pdf()`, so it reads only a PDF that had no text.
 */
export function ocr(options: OcrOptions = {}): Derive {
  return async ({ file, read, want }) => {
    if (!want.text || !small(file)) return;
    const pictures = OCR_PICTURES.test(file.type) ? [await read()] : isPdf(file) ? await pagesOfPdf(await read(), options.pages ?? 3, 2000) : [];
    if (!pictures.length) return;
    const { createWorker } = await import('tesseract.js');
    const { tmpdir } = await import('node:os');
    const worker = await createWorker((options.languages ?? ['eng']).join('+'), 1, { langPath: options.langPath, cachePath: options.cachePath ?? tmpdir() });
    try {
      const said: string[] = [];
      for (const picture of pictures) said.push((await worker.recognize(Buffer.from(picture))).data.text);
      const written = said.join('\n').trim();
      return written ? { text: written.slice(0, TEXT_UP_TO) } : undefined;
    } finally {
      await worker.terminate();
    }
  };
}

/** What is written in a file of text: its first megabyte, unless it is not text after all. */
export function text(): Derive {
  return async ({ file, read, want }) => {
    if (!want.text || !isText(file)) return;
    const bytes = await read({ from: 0, to: Math.min(file.versions[0].size, 1024 * 1024) });
    if (bytes.includes(0)) return;
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, TEXT_UP_TO) };
  };
}

/**
 * Several, one after another: the pictures and the placeholder of the first that makes them, the text of the first
 * that reads it. One that fails is passed over, so a missing library leaves only what it makes unmade. All five
 * unless said.
 */
export function deriveAll(...derives: Derive[]): Derive {
  const all = derives.length ? derives : [pictures(), pdf(), docx(), xlsx(), text()];
  return async (asked) => {
    const made: Derived = {};
    for (const one of all) {
      const want = { pictures: asked.want.pictures && !made.renditions?.length, text: asked.want.text && made.text === undefined };
      if (!want.pictures && !want.text) break;
      try {
        const got = await one({ ...asked, want });
        if (!got) continue;
        if (want.pictures && got.renditions?.length) made.renditions = got.renditions;
        if (want.pictures && got.placeholder) made.placeholder = got.placeholder;
        if (want.text && got.text !== undefined) made.text = got.text;
      } catch (error) {
        if (derives.length) throw error;
        console.warn(`What ${asked.file.name} would be made into could not be made:`, error instanceof Error ? error.message : error);
      }
    }
    return made;
  };
}
