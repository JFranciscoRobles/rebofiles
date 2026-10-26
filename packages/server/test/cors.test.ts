// A page of another origin, as the desktop application's: let in when listed,
// the browser's question first answered, nothing told to one not listed.

import { describe, expect, it } from 'vitest';
import { createDriveHandler, diskStorage, everyone, memoryMetadata } from '../src';

const handle = createDriveHandler({
  storage: diskStorage({ folder: '/tmp/rebofiles-cors-unused', secret: 's' }),
  metadata: memoryMetadata(),
  ...everyone('ana'),
  secret: 'u',
  base: '/api/files',
  cors: { origins: ['tauri://localhost'] },
});
const ask = (method: string, origin: string | null, extra: Record<string, string> = {}) =>
  handle(new Request('http://drive.test/api/files/entries', { method, headers: { ...(origin ? { origin } : {}), ...extra } }));

describe('pages of other origins', () => {
  it('are answered the question the browser asks first, and may read the answers, when listed', async () => {
    const first = await ask('OPTIONS', 'tauri://localhost', { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, authorization' });
    expect(first.status).toBe(204);
    expect(first.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
    expect(first.headers.get('access-control-allow-headers')).toBe('content-type, authorization');
    expect(first.headers.get('access-control-allow-methods')).toContain('PATCH');

    const listed = await ask('GET', 'tauri://localhost');
    expect(listed.status).toBe(200);
    expect(listed.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
    expect(listed.headers.get('access-control-allow-credentials')).toBe('true');
    expect(listed.headers.get('access-control-expose-headers')).toBe('ETag');
    expect(await listed.json()).toMatchObject({ entries: [] });
  });

  it('are told nothing when not listed, and a page of the same origin is answered as always', async () => {
    const other = await ask('GET', 'https://elsewhere.example');
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
    expect((await ask('OPTIONS', 'https://elsewhere.example', { 'access-control-request-method': 'POST' })).headers.get('access-control-allow-origin')).toBeNull();
    expect((await ask('GET', null)).headers.get('access-control-allow-origin')).toBeNull();
  });
});
