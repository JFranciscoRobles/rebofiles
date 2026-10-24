// The bytes in a bucket that speaks S3: AWS S3, Cloudflare R2, MinIO,
// Backblaze B2. A file of one part goes up with one PUT; a larger one in
// parts, each signed for its exact length, so a browser cannot send more
// than it said.

import { type Credentials, presign } from './sigv4';
import { type FinishedPart, type Storage, type UploadPlan, attachment, partsOf } from './storage';

/** How long an address handed to the browser is good for, in seconds. */
const URL_LIFE = 15 * 60;

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
  const ask = async (method: string, url: string, body?: string): Promise<Response> => {
    const answer = await send(presign(credentials, { method, url, expires: 60 }), { method, body });
    if (!answer.ok && answer.status !== 404) throw new Error(`The bucket answered ${answer.status} to ${method}: ${(await answer.text()).slice(0, 300)}`);
    return answer;
  };

  return {
    label: `s3://${options.bucket}`,

    async startUpload(key, type, size): Promise<UploadPlan> {
      const parts = partsOf(size);
      if (parts.length === 1) {
        const url = presign(credentials, { method: 'PUT', url: at(key), expires: URL_LIFE, headers: { 'content-type': type, 'content-length': String(size) } });
        return { parts: [{ ...parts[0], url }], state: '' };
      }
      const answer = await ask('POST', at(key, { uploads: '' }));
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await answer.text())?.[1];
      if (!uploadId) throw new Error('The bucket did not start the upload.');
      return {
        parts: parts.map((part) => ({
          ...part,
          url: presign(credentials, { method: 'PUT', url: at(key, { partNumber: String(part.number), uploadId }), expires: URL_LIFE, headers: { 'content-length': String(part.to - part.from) } }),
        })),
        state: uploadId,
      };
    },

    async finishUpload(key, uploadId, parts: FinishedPart[], size) {
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

    async downloadUrl(key, name, type, _base, inline) {
      return presign(credentials, { method: 'GET', url: at(key, { 'response-content-disposition': attachment(name, inline), 'response-content-type': type }), expires: URL_LIFE });
    },

    async remove(keys) {
      for (const key of keys) await ask('DELETE', at(key));
    },
  };
}
