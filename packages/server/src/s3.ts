// The bytes in a bucket that speaks S3: AWS S3, Cloudflare R2, MinIO,
// Backblaze B2. A file of one part goes up with one PUT; a larger one in
// parts, each signed for its exact length, so a browser cannot send more
// than it said.

import { createHash } from 'node:crypto';
import { type Credentials, presign } from './sigv4';
import { type FinishedPart, READ_LIFE, type Storage, type UploadPart, type UploadPlan, UploadGone, attachment, partsOf, shownWindow } from './storage';

/** How long an address handed to the browser is good for, in seconds. */
const URL_LIFE = 15 * 60;
/** The most keys S3 deletes in one request. */
const DELETE_BATCH = 1000;

export interface S3Options {
  /** `https://<account-id>.r2.cloudflarestorage.com`, `http://localhost:9000`; AWS's of the region when left out. */
  endpoint?: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Before every key: `files/`. */
  prefix?: string;
  /** For tests: what makes the requests to the bucket. */
  fetch?: typeof fetch;
}

/** The same options, from `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PREFIX`. */
export function s3OptionsFrom(env: Record<string, string | undefined> = process.env): S3Options {
  const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing in the environment: ${missing.join(', ')}.`);
  // The public address of an R2 bucket serves its files to anyone; it is not where the S3 API is.
  if (/\.r2\.dev\/?$/.test(env.S3_ENDPOINT ?? '')) throw new Error('S3_ENDPOINT is the public address of the bucket (r2.dev). The S3 API is at https://<account-id>.r2.cloudflarestorage.com.');
  return {
    endpoint: env.S3_ENDPOINT || undefined,
    bucket: env.S3_BUCKET!,
    region: env.S3_REGION || undefined,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    prefix: env.S3_PREFIX || undefined,
  };
}

export function s3Storage(options: S3Options): Storage {
  const region = options.region ?? (options.endpoint ? 'auto' : 'us-east-1');
  const credentials: Credentials = { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey, region };
  // The bucket in the path, which every S3 takes, rather than in the host name.
  const root = `${(options.endpoint ?? `https://s3.${region}.amazonaws.com`).replace(/\/$/, '')}/${options.bucket}/`;
  const send = options.fetch ?? fetch;
  const at = (key: string, query: Record<string, string> = {}) => {
    const url = new URL(root + (options.prefix ?? '') + key);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    return url.toString();
  };
  const ask = async (method: string, url: string, body?: string, signed: Record<string, string> = {}): Promise<Response> => {
    // Not compressed: Cloudflare gzips the answer to a HEAD of a text, and drops its content-length, which says what arrived.
    const answer = await send(presign(credentials, { method, url, expires: 60, headers: signed }), { method, body, headers: { ...signed, 'accept-encoding': 'identity' } });
    if (!answer.ok && answer.status !== 404) throw new Error(`The bucket answered ${answer.status} to ${method}: ${(await answer.text()).slice(0, 300)}`);
    return answer;
  };

  const partUrl = (key: string, uploadId: string, part: { number: number; from: number; to: number }): UploadPart => ({
    ...part,
    url: presign(credentials, { method: 'PUT', url: at(key, { partNumber: String(part.number), uploadId }), expires: URL_LIFE, headers: { 'content-length': String(part.to - part.from) } }),
  });
  const wholeUrl = (key: string, type: string, size: number) =>
    presign(credentials, { method: 'PUT', url: at(key), expires: URL_LIFE, headers: { 'content-type': type, 'content-length': String(size) } });

  /** The parts of an upload the bucket has, with their ETags and sizes: a thousand a page, as S3 lists them. */
  const listParts = async (key: string, uploadId: string) => {
    const found = new Map<number, { etag: string; size: number }>();
    for (let marker = '0'; ; ) {
      const answer = await ask('GET', at(key, { uploadId, 'part-number-marker': marker }));
      const text = await answer.text();
      if (answer.status === 404) throw new UploadGone('The bucket no longer has that upload.');
      for (const [, part] of text.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
        const number = Number(/<PartNumber>(\d+)</.exec(part)?.[1]);
        const etag = (/<ETag>([^<]*)</.exec(part)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#34;/g, '"');
        found.set(number, { etag, size: Number(/<Size>(\d+)</.exec(part)?.[1]) });
      }
      if (!/<IsTruncated>true</.test(text)) return found;
      marker = /<NextPartNumberMarker>(\d+)</.exec(text)?.[1] ?? '';
      if (!marker) return found;
    }
  };

  return {
    label: `s3://${options.bucket}`,

    async startUpload(key, type, size): Promise<UploadPlan> {
      const parts = partsOf(size);
      // The state is the bucket's id of the upload, and the type a file of one part is signed with, to sign it again.
      if (parts.length === 1) return { parts: [{ ...parts[0], url: wholeUrl(key, type, size) }], state: `\n${type}` };
      const answer = await ask('POST', at(key, { uploads: '' }));
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await answer.text())?.[1];
      if (!uploadId) throw new Error('The bucket did not start the upload.');
      return { parts: parts.map((part) => partUrl(key, uploadId, part)), state: `${uploadId}\n${type}` };
    },

    async resumeUpload(key, state, size) {
      const [uploadId, type = 'application/octet-stream'] = state.split('\n');
      const parts = partsOf(size);
      if (!uploadId) {
        // A file of one part is there whole, or not at all.
        const head = await ask('HEAD', at(key));
        if (head.status !== 404 && Number(head.headers.get('content-length')) === size) return { done: [{ number: 1, etag: head.headers.get('etag') ?? '' }], parts: [] };
        return { done: [], parts: [{ ...parts[0], url: wholeUrl(key, type, size) }] };
      }
      const found = await listParts(key, uploadId);
      // A part that arrived short is sent again: the bucket keeps the last one sent under its number.
      const arrived = (part: { number: number; from: number; to: number }) => found.get(part.number)?.size === part.to - part.from;
      return {
        done: parts.filter(arrived).map((part) => ({ number: part.number, etag: found.get(part.number)!.etag })),
        parts: parts.filter((part) => !arrived(part)).map((part) => partUrl(key, uploadId, part)),
      };
    },

    async finishUpload(key, state, parts: FinishedPart[], size) {
      const [uploadId] = state.split('\n');
      if (uploadId) {
        const xml = parts
          .slice()
          .sort((a, b) => a.number - b.number)
          .map((part) => `<Part><PartNumber>${part.number}</PartNumber><ETag>${part.etag.replace(/[<>&]/g, '')}</ETag></Part>`)
          .join('');
        const answer = await ask('POST', at(key, { uploadId }), `<CompleteMultipartUpload>${xml}</CompleteMultipartUpload>`);
        // S3 can answer 200 and still say in the body that it failed.
        const text = await answer.text();
        if (answer.status === 404 || /<Error>/.test(text)) throw new Error(`The bucket did not finish the upload: ${text.slice(0, 300)}`);
      }
      const head = await ask('HEAD', at(key));
      if (head.status === 404) throw new Error('Nothing arrived at the bucket.');
      const arrived = Number(head.headers.get('content-length'));
      if (arrived !== size) {
        await ask('DELETE', at(key));
        throw new Error(`${arrived} bytes arrived, not the ${size} said.`);
      }
    },

    async abortUpload(key, state) {
      const [uploadId] = state.split('\n');
      // The parts kept for an upload in parts; a file of one part may have arrived whole, under a key nothing points to.
      if (uploadId) await ask('DELETE', at(key, { uploadId }));
      else await ask('DELETE', at(key));
    },

    async downloadUrl(key, name, type, _base, inline) {
      const query = { 'response-content-disposition': attachment(name, inline), 'response-content-type': type };
      if (!inline) return presign(credentials, { method: 'GET', url: at(key, query), expires: READ_LIFE });
      // Signed at the start of the hour: the same address all of it, kept by the browser.
      const window = shownWindow();
      return presign(credentials, {
        method: 'GET',
        url: at(key, { ...query, 'response-cache-control': `private, max-age=${window.seconds}` }),
        expires: window.seconds,
        at: new Date(window.from),
      });
    },

    async copyPart(from, to, state, part) {
      const [uploadId] = state.split('\n');
      if (!uploadId) throw new Error('A file of one part is not copied a part at a time.');
      const source = `/${options.bucket}/${encodeURI((options.prefix ?? '') + from)}`;
      const answer = await ask('PUT', at(to, { partNumber: String(part.number), uploadId }), undefined, {
        'x-amz-copy-source': source,
        'x-amz-copy-source-range': `bytes=${part.from}-${part.to - 1}`,
      });
      // As finishing, it can answer 200 and say in the body that it failed.
      const text = await answer.text();
      if (answer.status === 404 || /<Error>/.test(text)) throw new Error(`The bucket did not copy part ${part.number}: ${text.slice(0, 300)}`);
    },

    async copy(from, to, size) {
      // CopyObject: the bucket copies the bytes itself, up to 5 GiB in one request.
      if (size > 5 * 1024 ** 3) throw new Error('A file larger than 5 GiB is not copied in one request.');
      const answer = await ask('PUT', at(to), undefined, { 'x-amz-copy-source': `/${options.bucket}/${encodeURI((options.prefix ?? '') + from)}` });
      // As finishing, it can answer 200 and say in the body that it failed.
      const text = await answer.text();
      if (answer.status === 404 || /<Error>/.test(text)) throw new Error(`The bucket did not copy ${from}: ${text.slice(0, 300)}`);
    },

    async write(key, bytes, type) {
      const url = presign(credentials, { method: 'PUT', url: at(key), expires: 60, headers: { 'content-type': type, 'content-length': String(bytes.length) } });
      const answer = await send(url, { method: 'PUT', body: bytes as Uint8Array<ArrayBuffer>, headers: { 'content-type': type } });
      if (!answer.ok) throw new Error(`The bucket answered ${answer.status} to a PUT: ${(await answer.text()).slice(0, 300)}`);
    },

    async read(key, range) {
      const answer = await ask('GET', at(key), undefined, range ? { range: `bytes=${range.from}-${range.to - 1}` } : {});
      if (answer.status === 404) throw new Error(`The bucket has nothing at ${key}.`);
      return new Uint8Array(await answer.arrayBuffer());
    },

    async sweepUploads(before) {
      // Listed a thousand a page, under the prefix only: a bucket shared with others keeps their uploads too.
      let swept = 0;
      for (let marker = { key: '', id: '' }; ; ) {
        const query = new URLSearchParams({ uploads: '', prefix: options.prefix ?? '', ...(marker.key ? { 'key-marker': marker.key, 'upload-id-marker': marker.id } : {}) });
        const text = await (await ask('GET', `${root}?${query}`)).text();
        for (const [, upload] of text.matchAll(/<Upload>([\s\S]*?)<\/Upload>/g)) {
          const key = /<Key>([^<]*)</.exec(upload)?.[1] ?? '';
          const id = /<UploadId>([^<]*)</.exec(upload)?.[1] ?? '';
          const started = Date.parse(/<Initiated>([^<]*)</.exec(upload)?.[1] ?? '');
          if (!key || !id || !(started < before.getTime())) continue;
          const url = new URL(root + key.replace(/&amp;/g, '&'));
          url.searchParams.set('uploadId', id);
          await ask('DELETE', url.toString());
          swept++;
        }
        if (!/<IsTruncated>true</.test(text)) return swept;
        marker = { key: /<NextKeyMarker>([^<]*)</.exec(text)?.[1] ?? '', id: /<NextUploadIdMarker>([^<]*)</.exec(text)?.[1] ?? '' };
        if (!marker.key) return swept;
      }
    },

    async remove(keys) {
      const xmlText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      for (let from = 0; from < keys.length; from += DELETE_BATCH) {
        const objects = keys
          .slice(from, from + DELETE_BATCH)
          .map((key) => `<Object><Key>${xmlText((options.prefix ?? '') + key)}</Key></Object>`)
          .join('');
        const xml = `<Delete><Quiet>true</Quiet>${objects}</Delete>`;
        // S3 takes a list to delete only with the MD5 of it.
        // To the bucket itself, not under the prefix: the keys in the list have it.
        const answer = await ask('POST', `${root}?delete=`, xml, { 'content-md5': createHash('md5').update(xml).digest('base64') });
        // Quiet: only what could not be deleted is said, each as an <Error>.
        const text = await answer.text();
        if (answer.status === 404 || /<Error>/.test(text)) throw new Error(`The bucket did not delete everything: ${text.slice(0, 300)}`);
      }
    },
  };
}
