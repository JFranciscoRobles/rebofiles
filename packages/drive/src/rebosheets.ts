// Workbooks (.xlsx and .csv) in the drive with Rebosheets' engine: the first
// cells of the sheet in view as their thumbnail, and the grid with its sheets
// in the viewer, read only. Their text the drive reads by itself. Apart from
// the rest of the package, so that a drive without Rebosheets does not carry
// its engine.
//
//   import { sheetsFormat } from '@rebofiles/drive/rebosheets';
//   mountDrive(element, { formats: [sheetsFormat] });

import type { FileFormat, ShownDocument } from './screen';

/** Whether a file is a workbook Rebosheets opens, by its name or its type. */
export const isWorkbook = (file: { name: string; type: string }): boolean => /\.(xlsx|csv)$/i.test(file.name) || file.type.includes('spreadsheetml') || file.type === 'text/csv';

/** An .xlsx is a zip, which starts so; anything else is read as the text of a CSV. */
const sourceOf = (bytes: Uint8Array) => (bytes[0] === 0x50 && bytes[1] === 0x4b ? bytes : new TextDecoder().decode(bytes).replace(/^﻿/, ''));

const blobOf = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The sheet could not be drawn.'))), type, quality));

/**
 * The first cells of a workbook's sheet in view as a picture, `size` pixels a side, headers and all, as Rebosheets
 * draws them: about as many cells at any size. JPEG, or what `type` says.
 */
export async function pictureOfWorkbook(bytes: Uint8Array, size: number, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  const { sheetCanvas } = await import('@rebosheets/viewer');
  const canvas = sheetCanvas(sourceOf(bytes), { width: size, height: size, zoom: (0.75 * size) / 320, scale: 1 });
  return blobOf(canvas, type, quality);
}

/** A workbook shown in the viewer of the drive, by Rebosheets' viewer: its grid read only, and its sheets. */
export async function viewWorkbook(element: HTMLElement, bytes: Uint8Array, context: { language?: string } = {}): Promise<ShownDocument> {
  const { createViewer } = await import('@rebosheets/viewer');
  const viewer = createViewer(element, sourceOf(bytes), { locale: context.language });
  return { destroy: () => viewer.destroy() };
}

/** Workbooks for the drive's `formats`: their thumbnail and their viewer. */
export const sheetsFormat: FileFormat = { test: isWorkbook, picture: pictureOfWorkbook, view: viewWorkbook };
