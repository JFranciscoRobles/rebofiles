// A .zip written as its files come, without holding any of them whole: each
// one's bytes go through as they are read, its CRC and sizes worked out on
// the way and written after it, as the format lets. Names in UTF-8; text
// deflated by the browser's own CompressionStream, what is compressed
// already (pictures, PDFs, Word documents) kept as it is; ZIP64 for a file,
// an archive or a number of files too large for the format of 1989.

export interface ZipItem {
  /** Where it goes in the archive; a folder's ends in "/". */
  path: string;
  modified: Date;
  /** Its bytes, asked for when it is its turn; a folder has none. */
  open?: () => Promise<ReadableStream<Uint8Array>>;
  /** How large it is, when known: past 4 GiB, it is written as ZIP64 from its start. */
  size?: number;
  /** Deflated, as text is worth; kept as it is when not. */
  compress?: boolean;
}

/** Where the bytes of the archive go, in order. */
export interface ZipSink {
  write(bytes: Uint8Array): Promise<void> | void;
  /** A file's bytes, kept as they come rather than read through `write`, when the sink can; how many there were. */
  pipe?(stream: ReadableStream<Uint8Array>): Promise<number>;
}

export interface ZipOptions {
  /** Every entry as ZIP64, whatever its size: for tests. */
  zip64?: boolean;
  /** Called as the bytes of the files are read, with how many have been so far. */
  onRead?: (bytes: number) => void;
}

const LIMIT = 0xffffffff;

// --- CRC-32, as the format has it -----------------------------------------------------

const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// --- Writing numbers -------------------------------------------------------------------

class Bytes {
  private readonly out: number[] = [];
  u16(n: number) {
    this.out.push(n & 0xff, (n >>> 8) & 0xff);
    return this;
  }
  u32(n: number) {
    this.out.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
    return this;
  }
  u64(n: number) {
    // Exact to 2^53, which no file reaches.
    return this.u32(n % 2 ** 32).u32(Math.floor(n / 2 ** 32));
  }
  raw(bytes: Uint8Array) {
    for (const byte of bytes) this.out.push(byte);
    return this;
  }
  done() {
    return Uint8Array.from(this.out);
  }
}

/** The time and the date as MS-DOS kept them, to the even second, in local time; before 1980, 1980. */
function dosTime(at: Date): [number, number] {
  const year = Math.max(1980, at.getFullYear());
  return [(at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1), ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate()];
}

interface Written {
  name: Uint8Array;
  folder: boolean;
  method: number;
  time: number;
  date: number;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
  zip64: boolean;
}

/** The archive of `items`, in their order, into `sink`. */
export async function writeZip(items: Iterable<ZipItem> | AsyncIterable<ZipItem>, sink: ZipSink, options: ZipOptions = {}): Promise<void> {
  const encoder = new TextEncoder();
  const written: Written[] = [];
  let offset = 0;
  let read = 0;
  const put = async (bytes: Uint8Array) => {
    await sink.write(bytes);
    offset += bytes.length;
  };

  for await (const item of items) {
    const folder = item.path.endsWith('/');
    const name = encoder.encode(item.path);
    const method = !folder && item.compress && typeof CompressionStream === 'function' ? 8 : 0;
    const [time, date] = dosTime(item.modified);
    const zip64 = !folder && (options.zip64 === true || (item.size ?? 0) >= LIMIT - 65_536 || offset >= LIMIT);
    const entry: Written = { name, folder, method, time, date, crc: 0, compressed: 0, size: 0, offset, zip64 };
    // Bit 3: the CRC and the sizes come after the bytes; bit 11: the name is UTF-8.
    const flags = folder ? 0x0800 : 0x0808;
    const header = new Bytes()
      .u32(0x04034b50)
      .u16(zip64 ? 45 : 20)
      .u16(flags)
      .u16(method)
      .u16(time)
      .u16(date)
      .u32(0)
      .u32(zip64 ? LIMIT : 0)
      .u32(zip64 ? LIMIT : 0)
      .u16(name.length)
      .u16(zip64 ? 20 : 0)
      .raw(name);
    if (zip64) header.u16(0x0001).u16(16).u64(0).u64(0);
    await put(header.done());

    if (!folder && item.open) {
      let crc = 0;
      let size = 0;
      const tap = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          crc = crc32(chunk, crc);
          size += chunk.length;
          read += chunk.length;
          options.onRead?.(read);
          controller.enqueue(chunk);
        },
      });
      let body = (await item.open()).pipeThrough(tap);
      if (method === 8) body = body.pipeThrough(new CompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>);
      let compressed = 0;
      if (sink.pipe) compressed = await sink.pipe(body);
      else {
        const reader = body.getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          await sink.write(chunk.value);
          compressed += chunk.value.length;
        }
      }
      offset += compressed;
      Object.assign(entry, { crc, size, compressed });
      // The descriptor, now that they are known: sizes of 8 bytes in a ZIP64 entry.
      const descriptor = new Bytes().u32(0x08074b50).u32(crc);
      if (zip64) descriptor.u64(compressed).u64(size);
      else if (compressed >= LIMIT || size >= LIMIT) throw new Error(`${item.path} grew past 4 GiB while it was read, more than it was said to be.`);
      else descriptor.u32(compressed).u32(size);
      await put(descriptor.done());
    } else if (!folder) {
      await put(new Bytes().u32(0x08074b50).u32(0).u32(0).u32(0).done());
    }
    written.push(entry);
  }

  // The central directory: every entry again, with what is known of it now.
  const start = offset;
  for (const entry of written) {
    const big = entry.zip64 || entry.offset >= LIMIT;
    const extra = big ? new Bytes().u16(0x0001).u16(24).u64(entry.size).u64(entry.compressed).u64(entry.offset).done() : new Uint8Array();
    await put(
      new Bytes()
        .u32(0x02014b50)
        .u16(45)
        .u16(big ? 45 : 20)
        .u16(entry.folder ? 0x0800 : 0x0808)
        .u16(entry.method)
        .u16(entry.time)
        .u16(entry.date)
        .u32(entry.crc)
        .u32(big ? LIMIT : entry.compressed)
        .u32(big ? LIMIT : entry.size)
        .u16(entry.name.length)
        .u16(extra.length)
        .u16(0)
        .u16(0)
        .u16(0)
        // A folder as MS-DOS marked one.
        .u32(entry.folder ? 0x10 : 0)
        .u32(big ? LIMIT : entry.offset)
        .raw(entry.name)
        .raw(extra)
        .done(),
    );
  }
  const size = offset - start;
  const count = written.length;
  if (count >= 0xffff || start >= LIMIT || size >= LIMIT || written.some((entry) => entry.zip64 || entry.offset >= LIMIT)) {
    const record = offset;
    await put(new Bytes().u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0).u64(count).u64(count).u64(size).u64(start).done());
    await put(new Bytes().u32(0x07064b50).u32(0).u64(record).u32(1).done());
    await put(new Bytes().u32(0x06054b50).u16(0).u16(0).u16(0xffff).u16(0xffff).u32(LIMIT).u32(LIMIT).u16(0).done());
  } else {
    await put(new Bytes().u32(0x06054b50).u16(0).u16(0).u16(count).u16(count).u32(size).u32(start).u16(0).done());
  }
}

/** Into the memory of the page, as a Blob: a file's bytes kept as Blobs, which a browser keeps on its disk past a size. */
export function blobSink(): ZipSink & { blob(type?: string): Blob } {
  const parts: BlobPart[] = [];
  return {
    write: (bytes) => void parts.push(bytes as Uint8Array<ArrayBuffer>),
    async pipe(stream) {
      const blob = await new Response(stream).blob();
      parts.push(blob);
      return blob.size;
    },
    blob: (type = 'application/zip') => new Blob(parts, { type }),
  };
}

/** Into a stream to write, as a file the person chose to save to: nothing of it held in the page. */
export function streamSink(writable: WritableStream<Uint8Array>): ZipSink & { close(): Promise<void>; abort(reason?: unknown): Promise<void> } {
  const writer = writable.getWriter();
  return {
    write: (bytes) => writer.write(bytes),
    close: () => writer.close(),
    abort: (reason) => writer.abort(reason),
  };
}

const COMPRESSED = /^(image\/(?!svg)|video\/|audio\/|application\/(zip|gzip|x-7z|x-rar|pdf|vnd\.openxmlformats|vnd\.oasis|epub))/;
/** Whether a file of this type is worth deflating: text is, what is compressed already is not. */
export const worthDeflating = (type: string, name: string) => !COMPRESSED.test(type) && !/\.(jpe?g|png|gif|webp|avif|heic|mp4|mov|mp3|m4a|zip|gz|7z|rar|pdf|docx|xlsx|pptx)$/i.test(name);
