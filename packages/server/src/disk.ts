// The bytes in a folder of the disk. The browser cannot reach a disk, so the
// server carries them: the addresses this storage makes are the server's own,
// each with a token that says what it may write or read, and for how long.
// For one machine, a playground or a desktop; a site puts them in a bucket.

import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { READ_LIFE, type Storage, attachment, partsOf, shownWindow } from './storage';
import { openToken, sealToken } from './tokens';

const URL_LIFE = 15 * 60;

interface Grant {
  key: string;
  /** 'write' a part, or 'read' the whole. */
  may: 'write' | 'read';
  part?: number;
  size?: number;
  name?: string;
  type?: string;
  inline?: boolean;
  /** Kept by the browser this many seconds: an address to show the bytes, the same all its hour. */
  cache?: number;
}

export interface DiskOptions {
  /** The folder; made when it is not there. */
  folder: string;
  /** What the tokens are signed with: long and random, the same in every process. */
  secret: string;
  /** How the folder is shown to a person; `disk:` and the folder as given unless said. */
  label?: string;
}

export function diskStorage(options: DiskOptions): Storage {
  const folder = resolve(options.folder);
  const pathOf = (key: string): string => {
    const path = resolve(folder, key);
    if (!path.startsWith(folder + sep)) throw new Error(`${key} is outside the folder`);
    return path;
  };
  const partPath = (key: string, number: number) => `${pathOf(key)}.part${number}`;
  const address = (base: string, grant: Grant) => `${base}/bytes?token=${sealToken(options.secret, grant, URL_LIFE)}`;

  return {
    label: options.label ?? `disk:${options.folder}`,

    async startUpload(key, _type, size, base) {
      return { parts: partsOf(size).map((part) => ({ ...part, url: address(base, { key, may: 'write', part: part.number, size: part.to - part.from }) })), state: '' };
    },

    async finishUpload(key, _state, parts, size) {
      const target = pathOf(key);
      await mkdir(dirname(target), { recursive: true });
      // Written beside it first and put in its place after, so a failure halfway leaves nothing at the key.
      const whole = `${target}.uploading`;
      const out = await open(whole, 'w');
      try {
        for (const part of parts.slice().sort((a, b) => a.number - b.number)) await out.writeFile(await readFile(partPath(key, part.number)));
      } finally {
        await out.close();
      }
      for (const part of parts) await rm(partPath(key, part.number), { force: true });
      const arrived = (await stat(whole)).size;
      if (arrived !== size) {
        await rm(whole, { force: true });
        throw new Error(`${arrived} bytes arrived, not the ${size} said.`);
      }
      await rename(whole, target);
    },

    async resumeUpload(key, _state, size, base) {
      // A part is there when a file of its exact size is: one cut halfway is sent again.
      const done = [];
      const parts = [];
      for (const part of partsOf(size)) {
        const arrived = (await stat(partPath(key, part.number)).catch(() => undefined))?.size;
        if (arrived === part.to - part.from) done.push({ number: part.number, etag: `"${part.number}"` });
        else parts.push({ ...part, url: address(base, { key, may: 'write', part: part.number, size: part.to - part.from }) });
      }
      return { done, parts };
    },

    async abortUpload(key, _state, size) {
      for (const part of partsOf(size)) await rm(partPath(key, part.number), { force: true });
      await rm(`${pathOf(key)}.uploading`, { force: true });
    },

    async downloadUrl(key, name, type, base, inline) {
      if (!inline) return `${base}/bytes?token=${sealToken(options.secret, { key, may: 'read', name, type } satisfies Grant, READ_LIFE)}`;
      // Sealed from the start of the hour: the same address all of it, kept by the browser.
      const window = shownWindow();
      return `${base}/bytes?token=${sealToken(options.secret, { key, may: 'read', name, type, inline, cache: window.seconds } satisfies Grant, window.seconds, window.from)}`;
    },

    async remove(keys) {
      for (const key of keys) await rm(pathOf(key), { force: true });
    },

    async copyPart(from, to, _state, part) {
      const source = await open(pathOf(from), 'r');
      try {
        const bytes = new Uint8Array(part.to - part.from);
        await source.read(bytes, 0, bytes.length, part.from);
        const target = partPath(to, part.number);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      } finally {
        await source.close();
      }
    },

    async write(key, bytes) {
      const target = pathOf(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(`${target}.uploading`, bytes);
      await rename(`${target}.uploading`, target);
    },

    async read(key, range) {
      const file = await open(pathOf(key), 'r');
      try {
        const size = (await file.stat()).size;
        const from = Math.min(range?.from ?? 0, size);
        const to = Math.min(range?.to ?? size, size);
        const bytes = new Uint8Array(Math.max(0, to - from));
        await file.read(bytes, 0, bytes.length, from);
        return bytes;
      } finally {
        await file.close();
      }
    },

    async sweepUploads(before) {
      // The parts of an upload, and a whole one being put together, left by an upload that never finished.
      const keys = new Set<string>();
      const look = async (dir: string): Promise<void> => {
        for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) await look(path);
          else if (/\.(part\d+|uploading)$/.test(entry.name) && (await stat(path)).mtimeMs < before.getTime()) {
            await rm(path, { force: true });
            keys.add(path.replace(/\.(part\d+|uploading)$/, ''));
          }
        }
      };
      await look(folder);
      return keys.size;
    },

    async serve(request, path) {
      if (path !== '/bytes') return undefined;
      const grant = openToken<Grant>(options.secret, new URL(request.url).searchParams.get('token') ?? '');
      if (!grant) return new Response('That address is out of date.', { status: 403 });
      if (request.method === 'PUT' && grant.may === 'write') {
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.length !== grant.size) return new Response(`This part is ${grant.size} bytes.`, { status: 400 });
        const target = partPath(grant.key, grant.part!);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
        return new Response(null, { status: 200, headers: { etag: `"${grant.part}"`, 'access-control-expose-headers': 'etag' } });
      }
      if (request.method === 'GET' && grant.may === 'read') {
        const file = pathOf(grant.key);
        const size = (await stat(file).catch(() => undefined))?.size;
        if (size === undefined) return new Response('Not there.', { status: 404 });
        return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
          headers: {
            'content-type': grant.type ?? 'application/octet-stream',
            'content-length': String(size),
            'content-disposition': attachment(grant.name ?? 'file', grant.inline),
            ...(grant.cache ? { 'cache-control': `private, max-age=${grant.cache}` } : {}),
          },
        });
      }
      return new Response('Not with this address.', { status: 405 });
    },
  };
}

/** Where a key is on the disk, for a test or a tool that reads it there. */
export const diskPath = (folder: string, key: string) => join(resolve(folder), key);
