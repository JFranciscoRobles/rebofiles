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
      const answer = await send(part.url.startsWith('/') ? origin + part.url : part.url, { method: 'PUT', body: bytes.slice(part.from, part.to) });
      parts.push({ number: part.number, etag: answer.headers.get('etag') ?? '' });
    }
    return ask('POST', '/api/files/uploads/finish', { token: start.body.token, parts });
  };
  return { ask, upload };
}

export const bytesOf = (size: number, seed = 1) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) % 251);

/** An S3 in memory, as a `fetch`. It does not check signatures; what it was asked is kept to look at. */
export function memoryS3() {
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
    const signedLength = q.get('X-Amz-SignedHeaders')?.includes('content-length');
    if (method === 'POST' && q.has('uploads')) {
      const id = `u${++next}`;
      uploads.set(id, new Map());
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (method === 'PUT' && q.has('uploadId')) {
      uploads.get(q.get('uploadId')!)!.set(Number(q.get('partNumber')), body);
      return new Response(null, { headers: { etag: `"p${q.get('partNumber')}"` } });
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
      if (signedLength === false) return new Response('unsigned length', { status: 400 });
      objects.set(key, body);
      return new Response(null, { headers: { etag: '"one"' } });
    }
    if (!objects.has(key)) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
    if (method === 'HEAD') return new Response(null, { headers: { 'content-length': String(objects.get(key)!.length) } });
    if (method === 'DELETE') return objects.delete(key), new Response(null, { status: 204 });
    return new Response(objects.get(key)!.slice());
  };
  return { fetch: fetch as typeof globalThis.fetch, objects, uploads, seen };
}
