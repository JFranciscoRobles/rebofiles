// Several files, and folders with all that is in them, downloaded as one .zip
// made in the page: what goes in it from the server, which says what may be
// read, and the bytes of each from where they are, straight into the archive.
// Their addresses are asked for a few at a time as it goes, so a long one does
// not outlive them. A large one, where the browser can, is written to a file
// the person chooses as it is made, nothing of it held in the page.

import type { EntryId } from '@rebofiles/core';
import type { Packed } from '@rebofiles/core';
import type { FileAddress } from './client';

/** What makes an archive: what goes in it, and where each file is read from. A drive's client, or a link's. */
export interface ZipSource {
  pack(ids: EntryId[]): Promise<Packed>;
  urls(ids: EntryId[], options: { inline?: boolean }): Promise<Record<EntryId, FileAddress>>;
}
import { type ZipItem, type ZipSink, blobSink, streamSink, worthDeflating, writeZip } from './zip';

export interface ZipProgress {
  /** Bytes of the files read so far, of all of them. */
  read: number;
  size: number;
  files: number;
}

export interface ZipDownloadOptions {
  /** The name of the file saved, with or without ".zip". */
  name: string;
  onProgress?: (progress: ZipProgress) => void;
  signal?: AbortSignal;
  /** From how many bytes it is written to a file the person chooses, where the browser can; 500 MB unless said. */
  streamFrom?: number;
}

export interface ZipDownload {
  files: number;
  size: number;
  /** Files that could not be read, and are not in it: to download again on their own. */
  missed: { id: EntryId; path: string }[];
}

/** How many addresses are asked for at once, as the files come: they are good for a quarter of an hour. */
const AT_ONCE = 40;

type Picker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;

export async function downloadZip(client: ZipSource, ids: EntryId[], options: ZipDownloadOptions): Promise<ZipDownload> {
  const name = /\.zip$/i.test(options.name) ? options.name : `${options.name}.zip`;
  const packed = await client.pack(ids);
  const size = packed.files.reduce((sum, file) => sum + file.size, 0);
  const missed: { id: EntryId; path: string }[] = [];

  // A large one straight to a file, where the browser lets the page write one; else in the page, saved at the end.
  const picker = (globalThis as { showSaveFilePicker?: Picker }).showSaveFilePicker;
  let sink: ZipSink;
  let finish: () => Promise<void>;
  let stop: (reason: unknown) => Promise<void> = async () => undefined;
  if (picker && size >= (options.streamFrom ?? 500 * 1024 * 1024)) {
    const handle = await picker({ suggestedName: name, types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }] });
    const streamed = streamSink(await handle.createWritable());
    sink = streamed;
    finish = () => streamed.close();
    stop = (reason) => streamed.abort(reason);
  } else {
    const kept = blobSink();
    sink = kept;
    finish = async () => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(kept.blob());
      link.download = name;
      link.click();
      // Long enough for the browser to have taken it.
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    };
  }

  async function* items(): AsyncGenerator<ZipItem> {
    for (const path of packed.folders) yield { path, modified: new Date() };
    for (let from = 0; from < packed.files.length; from += AT_ONCE) {
      const batch = packed.files.slice(from, from + AT_ONCE);
      const urls = await client.urls(
        batch.map((file) => file.id),
        { inline: false },
      );
      for (const file of batch) {
        options.signal?.throwIfAborted();
        const address = urls[file.id];
        // One that cannot be read is left out, and said, rather than leaving the rest out with it.
        const answer = address ? await fetch(address.url, { signal: options.signal }).catch((error: Error) => (options.signal?.aborted ? Promise.reject(error) : undefined)) : undefined;
        if (!answer?.ok || !answer.body) {
          missed.push({ id: file.id, path: file.path });
          continue;
        }
        const body = answer.body;
        yield { path: file.path, modified: new Date(file.modified), size: file.size, compress: worthDeflating(file.type, file.path), open: async () => body };
      }
    }
  }

  try {
    await writeZip(items(), sink, { onRead: (read) => options.onProgress?.({ read, size, files: packed.files.length }) });
    await finish();
  } catch (error) {
    await stop(error).catch(() => undefined);
    throw error;
  }
  return { files: packed.files.length - missed.length, size, missed };
}
