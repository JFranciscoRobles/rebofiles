// The bytes in a folder of the disk. The browser cannot reach a disk, so the
// server carries them: the addresses this storage makes are the server's own,
// each with a token that says what it may write or read, and for how long.
// For one machine, a playground or a desktop; a site puts them in a bucket.

import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { type Storage, attachment, partsOf } from './storage';
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
      return address(base, { key, may: 'read', name, type, inline });
    },

    async remove(keys) {
      for (const key of keys) await rm(pathOf(key), { force: true });
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
          headers: { 'content-type': grant.type ?? 'application/octet-stream', 'content-length': String(size), 'content-disposition': attachment(grant.name ?? 'file', grant.inline) },
        });
      }
      return new Response('Not with this address.', { status: 405 });
    },
  };
}

/** Where a key is on the disk, for a test or a tool that reads it there. */
export const diskPath = (folder: string, key: string) => join(resolve(folder), key);
