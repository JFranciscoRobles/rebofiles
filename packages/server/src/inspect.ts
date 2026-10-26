// What a file is by its bytes, not by its name; and two `inspect`s for the
// server, which look at a file once its bytes arrived and before it is listed:
// one refuses a file whose bytes are not what its name says, or a program; the
// other asks ClamAV. Neither needs anything but Node.

import { connect } from 'node:net';
import type { Drive, FileEntry, FolderEntry } from '@rebofiles/core';
import { Refused } from './refused';

/** What the page says of an upload, as `beforeUpload` is asked with it. */
export interface UploadAsked {
  user: { id: string };
  /** A new file, or a new version of one (then `file` is that one). */
  purpose: 'file' | 'version';
  /** Its name: the one it will have, or the one the file has, for a version. */
  name: string;
  /** The type the page says it is. */
  type: string;
  size: number;
  /** The folder it goes into; null for the top. */
  parent: FolderEntry | null;
  file?: FileEntry;
}

/** An upload whose bytes are in the storage, as `inspect` is asked with it. */
export interface UploadArrived extends Omit<UploadAsked, 'purpose'> {
  /** A smaller picture the page made of a version is a `rendition`; its name is the file's. */
  purpose: 'file' | 'version' | 'rendition';
  /** Where the bytes are in the storage. */
  key: string;
  /** Its bytes, from `from` to `to` (not included), or all of them. */
  read(range?: { from: number; to: number }): Promise<Uint8Array>;
}

/** Refuses with a `Refused`, or by giving false (or a promise of it); anything else lets the file in. */
export type Inspect = (upload: UploadArrived, drive: Drive) => unknown;

const starts = (bytes: Uint8Array, at: number, ...signature: number[]) => signature.every((byte, i) => bytes[at + i] === byte);
const ascii = (bytes: Uint8Array, at: number, text: string) => starts(bytes, at, ...[...text].map((c) => c.charCodeAt(0)));

/** How many of the first bytes `typeOfBytes` needs. */
export const SNIFF_BYTES = 4100;

/**
 * The type the first bytes of a file say it is, or null for none it knows (a text, among them). A Word document, a
 * sheet or a presentation are zip archives by their bytes, and are `application/zip` here.
 */
export function typeOfBytes(bytes: Uint8Array): string | null {
  if (starts(bytes, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(bytes, 0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a')) return 'image/gif';
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return 'image/webp';
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) return 'audio/wav';
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'AVI ')) return 'video/x-msvideo';
  if (ascii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (/^(avif|avis)$/.test(brand)) return 'image/avif';
    if (/^(heic|heix|mif1|msf1)$/.test(brand)) return 'image/heic';
    if (/^qt {2}$/.test(brand)) return 'video/quicktime';
    if (/^M4A /.test(brand)) return 'audio/mp4';
    return 'video/mp4';
  }
  if (starts(bytes, 0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  if (ascii(bytes, 0, '%PDF-')) return 'application/pdf';
  if (starts(bytes, 0, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0, 0x50, 0x4b, 0x05, 0x06)) return 'application/zip';
  if (starts(bytes, 0, 0x1f, 0x8b)) return 'application/gzip';
  if (ascii(bytes, 0, '7z') && starts(bytes, 2, 0xbc, 0xaf, 0x27, 0x1c)) return 'application/x-7z-compressed';
  if (ascii(bytes, 0, 'Rar!')) return 'application/vnd.rar';
  if (starts(bytes, 0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return 'application/x-ole-storage';
  if (ascii(bytes, 0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (ascii(bytes, 0, 'OggS')) return 'audio/ogg';
  if (ascii(bytes, 0, 'fLaC')) return 'audio/flac';
  if (ascii(bytes, 0, 'MZ')) return 'application/x-msdownload';
  if (starts(bytes, 0, 0x7f, 0x45, 0x4c, 0x46)) return 'application/x-elf';
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0)) return 'application/x-mach-binary';
  return null;
}

/** The programs `checkType` refuses unless told: what runs on Windows, Linux and a Mac. */
const PROGRAMS = ['application/x-msdownload', 'application/x-elf', 'application/x-mach-binary'];

/** What the bytes of a file of each extension may be. An extension not here is taken as it comes, but for a program. */
const EXPECTED: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  avif: ['image/avif'],
  heic: ['image/heic'],
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  docx: ['application/zip'],
  xlsx: ['application/zip'],
  pptx: ['application/zip'],
  odt: ['application/zip'],
  ods: ['application/zip'],
  odp: ['application/zip'],
  epub: ['application/zip'],
  doc: ['application/x-ole-storage'],
  xls: ['application/x-ole-storage'],
  ppt: ['application/x-ole-storage'],
  gz: ['application/gzip'],
  '7z': ['application/x-7z-compressed'],
  rar: ['application/vnd.rar'],
  mp4: ['video/mp4', 'video/quicktime'],
  m4v: ['video/mp4', 'video/quicktime'],
  mov: ['video/quicktime', 'video/mp4'],
  m4a: ['audio/mp4', 'video/mp4'],
  webm: ['video/webm'],
  mkv: ['video/webm'],
  avi: ['video/x-msvideo'],
  mp3: ['audio/mpeg'],
  wav: ['audio/wav'],
  ogg: ['audio/ogg'],
  oga: ['audio/ogg'],
  flac: ['audio/flac'],
};

export interface CheckTypeOptions {
  /** Programs taken too: an .exe, a binary of Linux or of a Mac. Refused unless said. */
  programs?: boolean;
  /** Only files whose bytes are among these types, as `typeOfBytes` says them; null for one it does not know (a text). */
  only?: (string | null)[];
}

/**
 * An `inspect` that refuses a file whose bytes are not what its name says (a program called `photo.png`), and a
 * program, unless told. A smaller picture the page made must be a picture. Reads the first 4 KB.
 */
export function checkType(options: CheckTypeOptions = {}): Inspect {
  return async (upload) => {
    const found = typeOfBytes(await upload.read({ from: 0, to: Math.min(upload.size, SNIFF_BYTES) }));
    if (upload.purpose === 'rendition') {
      if (!found?.startsWith('image/')) throw new Refused(422, 'type-mismatch', 'A smaller picture is a picture.');
      return;
    }
    if (found && PROGRAMS.includes(found) && !options.programs) throw new Refused(422, 'program-refused', `${upload.name} is a program, and programs are not kept here.`);
    if (options.only && !options.only.includes(found)) throw new Refused(422, 'type-refused', `Files like ${upload.name} are not kept here.`);
    const extension = /\.([^.]+)$/.exec(upload.name)?.[1]?.toLowerCase() ?? '';
    const expected = EXPECTED[extension];
    if (expected && !(found && expected.includes(found))) throw new Refused(422, 'type-mismatch', `${upload.name} is not what its name says: its bytes are not those of a .${extension}.`);
  };
}

export interface ClamavOptions {
  /** Where clamd listens on TCP (`TCPSocket` in clamd.conf): 127.0.0.1:3310 unless said. */
  host?: string;
  port?: number;
  /** Milliseconds for the whole scan; 60 seconds unless said. */
  timeout?: number;
  /** What clamd takes in one go, as its `StreamMaxLength` says (25 MB unless changed there): a larger file is refused, not passed unscanned. */
  maxSize?: number;
}

/** How much is read of the file and sent to clamd at a time. */
const CHUNK = 1024 * 1024;

/**
 * An `inspect` that asks ClamAV's daemon (clamd), by its INSTREAM command, and refuses what it finds a virus in. Its
 * failure (clamd down, a time out) refuses the file too, with a 503: a file not scanned is not let in.
 */
export function clamav(options: ClamavOptions = {}): Inspect {
  const maxSize = options.maxSize ?? 25 * 1024 * 1024;
  return async (upload) => {
    if (upload.size > maxSize) throw new Refused(413, 'too-large-to-scan', `${upload.name} is larger than what is scanned for viruses here.`);
    let answer: string;
    try {
      answer = await scan(upload, options);
    } catch (error) {
      throw new Refused(503, 'not-scanned', `${upload.name} could not be scanned for viruses. Try again in a moment.`, { cause: error });
    }
    const found = /^stream: (.+) FOUND$/.exec(answer);
    if (found) throw new Refused(422, 'virus-found', `${upload.name} has a virus (${found[1]}), and was not kept.`);
    if (!/^stream: OK$/.test(answer))
      throw new Refused(503, 'not-scanned', `${upload.name} could not be scanned for viruses. Try again in a moment.`, { cause: new Error(`ClamAV answered: ${answer}`) });
  };
}

function scan(upload: UploadArrived, options: ClamavOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: options.host ?? '127.0.0.1', port: options.port ?? 3310 });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => socket.destroy(new Error('ClamAV took too long.')), options.timeout ?? 60_000);
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('error', (error) => (clearTimeout(timer), reject(error)));
    socket.on('close', () => (clearTimeout(timer), resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim())));
    socket.on('connect', async () => {
      try {
        socket.write('zINSTREAM\0');
        // Each piece with its length before it, four bytes, the largest first; a length of none ends it.
        for (let from = 0; from < upload.size; from += CHUNK) {
          const bytes = await upload.read({ from, to: Math.min(upload.size, from + CHUNK) });
          const length = Buffer.alloc(4);
          length.writeUInt32BE(bytes.length);
          socket.write(length);
          socket.write(bytes);
        }
        socket.write(Buffer.alloc(4));
      } catch (error) {
        socket.destroy(error as Error);
      }
    });
  });
}

/** Several `inspect`s, one after another: the first to refuse refuses. */
export const inspectAll =
  (...all: Inspect[]): Inspect =>
  async (upload, drive) => {
    for (const one of all) if ((await one(upload, drive)) === false) return false;
  };
