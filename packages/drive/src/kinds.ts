// What kind of file an entry is, as the drive shows it: its tile, its
// colour, and whether the page can preview it.

import { type Entry, splitName } from '@rebofiles/core';

/** What the preview of a document shows: its title and its first paragraphs. */
export interface DocumentPreview {
  title: string;
  paragraphs: string[];
}

export type Kind = 'folder' | 'docx' | 'pdf' | 'sheet' | 'image' | 'text' | 'other';

export function kindOf(entry: Entry): Kind {
  if (entry.kind === 'folder') return 'folder';
  const ext = splitName(entry.name).ext.slice(1).toLowerCase();
  if (ext === 'docx' || ext === 'doc' || entry.type.includes('wordprocessingml')) return 'docx';
  if (ext === 'pdf' || entry.type === 'application/pdf') return 'pdf';
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext) || entry.type.includes('spreadsheet')) return 'sheet';
  if (entry.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image';
  if (entry.type.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log'].includes(ext)) return 'text';
  return 'other';
}

/** The extension on a file's tile: DOCX, PDF, PNG. */
export const badgeOf = (entry: Entry): string => splitName(entry.name).ext.slice(1, 5).toUpperCase() || 'FILE';
