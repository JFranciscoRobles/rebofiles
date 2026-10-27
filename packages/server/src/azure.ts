// The bytes in Azure Blob Storage, in a container. Every address is signed
// here with the account's key (a SAS of the blob, good for minutes): the
// browser sends each part as a block of the blob, and the server makes the
// blob of them with its list of blocks. Blocks never listed are let go of by
// Azure itself after a week, so there is nothing to sweep.

import { createHmac } from 'node:crypto';
import { type FinishedPart, READ_LIFE, type Storage, type UploadPart, type UploadPlan, UploadGone, attachment, partsOf, shownWindow } from './storage';

/** How long an address handed to the browser is good for, in seconds. */
const URL_LIFE = 15 * 60;
/** The version of Azure's API the addresses are signed for. */
const VERSION = '2024-11-04';

export interface AzureOptions {
  /** The storage account's name. */
  account: string;
  /** One of its access keys, as the portal gives it (base64). */
  key: string;
  container: string;
  /** `https://<account>.blob.core.windows.net` unless said; Azurite's `http://127.0.0.1:10000/devstoreaccount1`. */
  endpoint?: string;
  /** Before every key: `files/`. */
  prefix?: string;
  /** For tests: what makes the requests to Azure. */
  fetch?: typeof fetch;
}

/** The same options, from `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`, `AZURE_STORAGE_CONTAINER`, `AZURE_STORAGE_ENDPOINT` and `AZURE_STORAGE_PREFIX`. */
export function azureOptionsFrom(env: Record<string, string | undefined> = process.env): AzureOptions {
  const missing = ['AZURE_STORAGE_ACCOUNT', 'AZURE_STORAGE_KEY', 'AZURE_STORAGE_CONTAINER'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing in the environment: ${missing.join(', ')}.`);
  return {
    account: env.AZURE_STORAGE_ACCOUNT!,
    key: env.AZURE_STORAGE_KEY!,
    container: env.AZURE_STORAGE_CONTAINER!,
    endpoint: env.AZURE_STORAGE_ENDPOINT || undefined,
    prefix: env.AZURE_STORAGE_PREFIX || undefined,
  };
}

/** A block's id: the same length for every part of a blob, as Azure asks, and its number in it. */
const blockOf = (number: number) => Buffer.from(`part-${String(number).padStart(6, '0')}`).toString('base64');
const numberOf = (block: string) => Number(/^part-(\d+)$/.exec(Buffer.from(block, 'base64').toString())?.[1] ?? Number.NaN);
const iso = (time: number) => new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z');

export function azureStorage(options: AzureOptions): Storage {
  const root = (options.endpoint ?? `https://${options.account}.blob.core.windows.net`).replace(/\/$/, '');
  const send = options.fetch ?? fetch;
  const secret = Buffer.from(options.key, 'base64');
  const nameOf = (key: string) => (options.prefix ?? '') + key;

  /**
   * The address of a blob signed for `permissions` (r, a, c, w, d) until `seconds` from `from`: a SAS of the blob,
   * with what the answer is to say of itself (`rscc`, `rscd`, `rsct`), and the query of the operation besides.
   */
  const signed = (key: string, permissions: string, seconds: number, query: Record<string, string> = {}, answer: { rscc?: string; rscd?: string; rsct?: string } = {}, from = Date.now() - 60_000) => {
    const name = nameOf(key);
    const start = iso(from);
    const expiry = iso(from + seconds * 1000 + 60_000);
    const resource = `/blob/${options.account}/${options.container}/${name}`;
    // As Azure reads it from version 2020-12-06 on: permissions, start, expiry, the resource, and the rest in order.
    const toSign = [permissions, start, expiry, resource, '', '', '', VERSION, 'b', '', '', answer.rscc ?? '', answer.rscd ?? '', '', '', answer.rsct ?? ''].join('\n');
    const sig = createHmac('sha256', secret).update(toSign, 'utf8').digest('base64');
    const url = new URL(`${root}/${options.container}/${name.split('/').map(encodeURIComponent).join('/')}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const sas: Record<string, string> = { sv: VERSION, sr: 'b', sp: permissions, st: start, se: expiry, ...answer, sig };
    for (const [k, v] of Object.entries(sas)) url.searchParams.set(k, v);
    return url.toString();
  };
  const ask = async (method: string, url: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}): Promise<Response> => {
    const answer = await send(url, { method, body: init.body, headers: { 'x-ms-version': VERSION, ...init.headers } });
    if (!answer.ok && answer.status !== 404) throw new Error(`Azure answered ${answer.status} to ${method}: ${(await answer.text()).slice(0, 300)}`);
    return answer;
  };
  const partUrl = (key: string, part: { number: number; from: number; to: number }): UploadPart => ({
    ...part,
    url: signed(key, 'w', URL_LIFE, { comp: 'block', blockid: blockOf(part.number) }),
  });
  /** The blocks sent for a blob and not yet made into it, by their numbers, with their sizes. */
  const uncommitted = async (key: string) => {
    const answer = await ask('GET', signed(key, 'r', 60, { comp: 'blocklist', blocklisttype: 'uncommitted' }));
    const found = new Map<number, number>();
    if (answer.status === 404) return found;
    const text = await answer.text();
    for (const [, block] of text.matchAll(/<Block>([\s\S]*?)<\/Block>/g)) {
      const number = numberOf(/<Name>([^<]*)</.exec(block)?.[1] ?? '');
      if (Number.isFinite(number)) found.set(number, Number(/<Size>(\d+)</.exec(block)?.[1]));
    }
    return found;
  };
  const sizeOf = async (key: string) => {
    const head = await ask('HEAD', signed(key, 'r', 60));
    return head.status === 404 ? undefined : Number(head.headers.get('content-length'));
  };

  return {
    label: `azure://${options.account}/${options.container}`,

    async startUpload(key, type, size): Promise<UploadPlan> {
      // Every file a block at a time, the one of a single part too: the browser sends nothing but the bytes.
      return { parts: partsOf(size).map((part) => partUrl(key, part)), state: type, etags: false };
    },

    async resumeUpload(key, _state, size) {
      const parts = partsOf(size);
      const found = await uncommitted(key);
      // A block that arrived short is sent again: Azure keeps the last one sent under its id.
      const arrived = (part: { number: number; from: number; to: number }) => found.get(part.number) === part.to - part.from;
      if (!found.size && (await sizeOf(key)) === size) return { done: parts.map((part) => ({ number: part.number, etag: '' })), parts: [] };
      return { done: parts.filter(arrived).map((part) => ({ number: part.number, etag: '' })), parts: parts.filter((part) => !arrived(part)).map((part) => partUrl(key, part)) };
    },

    async finishUpload(key, state, parts: FinishedPart[], size) {
      const numbers = parts.map((part) => part.number).sort((a, b) => a - b);
      const xml = `<?xml version="1.0" encoding="utf-8"?><BlockList>${numbers.map((n) => `<Latest>${blockOf(n)}</Latest>`).join('')}</BlockList>`;
      const answer = await ask('PUT', signed(key, 'w', 60, { comp: 'blocklist' }), {
        body: xml,
        headers: { 'content-type': 'application/xml', 'x-ms-blob-content-type': state || 'application/octet-stream' },
      });
      if (answer.status === 404) throw new UploadGone('Azure no longer has the blocks of that upload.');
      const arrived = await sizeOf(key);
      if (arrived === undefined) throw new Error('Nothing arrived at Azure.');
      if (arrived !== size) {
        await ask('DELETE', signed(key, 'd', 60));
        throw new Error(`${arrived} bytes arrived, not the ${size} said.`);
      }
    },

    async abortUpload() {
      // Blocks never made into a blob go by themselves, after a week: there is no asking Azure to drop them sooner.
    },

    async downloadUrl(key, name, type, _base, inline) {
      if (!inline) return signed(key, 'r', READ_LIFE, {}, { rscd: attachment(name), rsct: type });
      // Signed at the start of the hour: the same address all of it, kept by the browser.
      const window = shownWindow();
      return signed(key, 'r', window.seconds, {}, { rscc: `private, max-age=${window.seconds}`, rscd: attachment(name, true), rsct: type }, window.from);
    },

    async copyPart(from, to, _state, part) {
      // Put Block From URL: Azure reads the range of the blob there itself, at an address signed to read it.
      const answer = await ask('PUT', signed(to, 'w', 60, { comp: 'block', blockid: blockOf(part.number) }), {
        headers: { 'x-ms-copy-source': signed(from, 'r', 300), 'x-ms-source-range': `bytes=${part.from}-${part.to - 1}`, 'content-length': '0' },
      });
      if (answer.status === 404) throw new Error(`Azure has nothing at ${from} to copy part ${part.number} of.`);
    },

    async copy(from, to, size, type) {
      // An empty one is written as it is: there is no range of it to read.
      if (size === 0) return this.write!(to, new Uint8Array(), type);
      // A block at a time read by Azure from the blob there (Put Block From URL), then the blob made of them.
      const source = signed(from, 'r', 600);
      const parts = partsOf(size);
      for (const part of parts) {
        await ask('PUT', signed(to, 'w', 60, { comp: 'block', blockid: blockOf(part.number) }), {
          headers: { 'x-ms-copy-source': source, 'x-ms-source-range': `bytes=${part.from}-${part.to - 1}`, 'content-length': '0' },
        });
      }
      const xml = `<?xml version="1.0" encoding="utf-8"?><BlockList>${parts.map((part) => `<Latest>${blockOf(part.number)}</Latest>`).join('')}</BlockList>`;
      await ask('PUT', signed(to, 'w', 60, { comp: 'blocklist' }), { body: xml, headers: { 'content-type': 'application/xml', 'x-ms-blob-content-type': type } });
    },

    async write(key, bytes, type) {
      await ask('PUT', signed(key, 'cw', 60), { body: bytes as Uint8Array<ArrayBuffer>, headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': type } });
    },

    async read(key, range) {
      const answer = await ask('GET', signed(key, 'r', 60), { headers: range ? { range: `bytes=${range.from}-${range.to - 1}` } : {} });
      if (answer.status === 404) throw new Error(`Azure has nothing at ${key}.`);
      return new Uint8Array(await answer.arrayBuffer());
    },

    async remove(keys) {
      // One at a time: a key gone already is as good as deleted.
      for (const key of keys) await ask('DELETE', signed(key, 'd', 60));
    },
  };
}
