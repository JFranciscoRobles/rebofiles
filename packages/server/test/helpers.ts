// What the tests of the server share: a drive asked through its routes, as a
// browser would, and an S3 kept in memory that speaks as much of it as the
// storage asks.

import type { Entry } from '@rebofiles/core';
import type { UploadPart } from '../src';

export type Handler = (request: Request) => Promise<Response>;

export function client(handle: Handler, who = 'ana', origin = 'http://drive.test') {
  const ask = async (method: string, path: string, body?: unknown) => {
    const answer = await handle(new Request(origin + path, { method, headers: { 'x-user': who, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: answer.status, body: (await answer.json()) as Record<string, unknown> & { entry: Entry; entries: Entry[]; url: string } };
  };
  /** Up the way a browser goes: ask where, send each part there, say it is done. */
  const upload = async (bytes: Uint8Array, asked: Record<string, unknown>, send: (url: string, init: RequestInit) => Promise<Response>) => {
    const start = await ask('POST', '/api/files/uploads', { type: 'application/octet-stream', ...asked, size: bytes.length });
    if (start.status !== 200) return start;
    const parts = [];
    for (const part of start.body.parts as UploadPart[]) {
      const answer = await send(part.url.startsWith('/') ? origin + part.url : part.url, {
        method: 'PUT',
        headers: { 'content-type': String(asked.type ?? 'application/octet-stream') },
        body: bytes.slice(part.from, part.to),
      });
      parts.push({ number: part.number, etag: answer.headers.get('etag') ?? '' });
    }
    return ask('POST', '/api/files/uploads/finish', { token: start.body.token, parts });
  };
  return { ask, upload };
}

export const bytesOf = (size: number, seed = 1) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) % 251);

/** An S3 in memory, as a `fetch`. It does not check signatures; what it was asked is kept to look at. `listPage`: how many parts it lists a page, 1000 as S3. */
export function memoryS3({ listPage = 1000 } = {}) {
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, Map<number, Uint8Array>>();
  const seen: { method: string; url: URL }[] = [];
  let next = 0;
  const fetch = async (address: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(address));
    const method = init.method ?? 'GET';
    seen.push({ method, url });
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\//, ''));
    const q = url.searchParams;
    const body = init.body === undefined ? new Uint8Array() : new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer());
    const signed = q.get('X-Amz-SignedHeaders')?.split(';');
    // It cannot check a signature, but it can see that a header that was signed was not sent, as S3 would refuse.
    const sent = new Headers(init.headers);
    const unsent = signed?.find((name) => name !== 'host' && name !== 'content-length' && !sent.has(name));
    if (method === 'POST' && q.has('uploads')) {
      const id = `u${++next}`;
      uploads.set(id, new Map());
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (method === 'PUT' && q.has('uploadId')) {
      uploads.get(q.get('uploadId')!)!.set(Number(q.get('partNumber')), body);
      return new Response(null, { headers: { etag: `"p${q.get('partNumber')}"` } });
    }
    if (method === 'GET' && q.has('uploadId')) {
      const parts = uploads.get(q.get('uploadId')!);
      if (!parts) return new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 });
      const after = Number(q.get('part-number-marker') ?? 0);
      const numbers = [...parts.keys()].sort((a, b) => a - b).filter((n) => n > after);
      const page = numbers.slice(0, listPage);
      const listed = page.map((n) => `<Part><PartNumber>${n}</PartNumber><ETag>&quot;p${n}&quot;</ETag><Size>${parts.get(n)!.length}</Size></Part>`).join('');
      const more = numbers.length > page.length;
      return new Response(`<ListPartsResult><IsTruncated>${more}</IsTruncated>${more ? `<NextPartNumberMarker>${page.at(-1)}</NextPartNumberMarker>` : ''}${listed}</ListPartsResult>`);
    }
    if (method === 'DELETE' && q.has('uploadId')) {
      uploads.delete(q.get('uploadId')!);
      return new Response(null, { status: 204 });
    }
    if (method === 'POST' && q.has('delete')) {
      const xml = new TextDecoder().decode(body);
      const { createHash } = await import('node:crypto');
      if (sent.get('content-md5') !== createHash('md5').update(xml).digest('base64')) return new Response('<Error><Code>InvalidDigest</Code></Error>', { status: 400 });
      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) objects.delete(match[1]);
      return new Response('<DeleteResult/>');
    }
    if (method === 'POST' && q.has('uploadId')) {
      const parts = uploads.get(q.get('uploadId')!)!;
      const order = [...new TextDecoder().decode(body).matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)].map((m) => Number(m[1]));
      const whole = new Uint8Array(order.reduce((sum, n) => sum + parts.get(n)!.length, 0));
      let at = 0;
      for (const n of order) whole.set(parts.get(n)!, at), (at += parts.get(n)!.length);
      objects.set(key, whole);
      uploads.delete(q.get('uploadId')!);
      return new Response('<CompleteMultipartUploadResult/>');
    }
    if (method === 'PUT') {
      if (signed && !signed.includes('content-length')) return new Response('unsigned length', { status: 400 });
      if (unsent) return new Response(`<Error><Code>SignatureDoesNotMatch</Code><Message>${unsent} was signed but not sent</Message></Error>`, { status: 403 });
      objects.set(key, body);
      return new Response(null, { headers: { etag: '"one"' } });
    }
    if (!objects.has(key)) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
    // As Cloudflare does: an answer it may compress says no length, and a HEAD of a text it compresses.
    if (method === 'HEAD') return new Response(null, { headers: sent.get('accept-encoding') === 'identity' ? { 'content-length': String(objects.get(key)!.length) } : {} });
    if (method === 'DELETE') return objects.delete(key), new Response(null, { status: 204 });
    return new Response(objects.get(key)!.slice());
  };
  return { fetch: fetch as typeof globalThis.fetch, objects, uploads, seen };
}
