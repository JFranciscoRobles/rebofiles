// Which server the window is of: kept, and tried before it is taken.

import { describe, expect, it } from 'vitest';
import { forget, recall, remember, tryServer } from '../src/server';

const storage = () => {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
};
const answering = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('the server of the window', () => {
  it('is kept between starts, and forgotten when another is asked for', () => {
    const s = storage();
    expect(recall(s)).toBeNull();
    remember({ address: 'https://files.example.com/api/files', token: 't' }, s);
    expect(recall(s)).toEqual({ address: 'https://files.example.com/api/files', token: 't' });
    forget(s);
    expect(recall(s)).toBeNull();
    s.setItem('rebofiles-desktop:server', '{not json');
    expect(recall(s)).toBeNull();
  });

  it('is taken when it answers as a ReboFiles server, with the token given; and else says why', async () => {
    let asked: RequestInit | undefined;
    const ok = (async (_: unknown, init?: RequestInit) => ((asked = init), new Response(JSON.stringify({ storage: 'disk', maxSize: 1 })))) as unknown as typeof fetch;
    expect(await tryServer({ address: 'https://files.example.com/api/files/', token: 'secret' }, ok)).toBeNull();
    expect(asked?.headers).toEqual({ authorization: 'Bearer secret' });

    expect(await tryServer({ address: 'files' }, ok)).toEqual({ problem: 'not-an-address' });
    expect(await tryServer({ address: 'ftp://files.example.com' }, ok)).toEqual({ problem: 'not-http' });
    expect(await tryServer({ address: 'https://x.example' }, answering(401, {}))).toEqual({ problem: 'token', status: 401 });
    expect(await tryServer({ address: 'https://x.example' }, answering(404, {}))).toEqual({ problem: 'answered', status: 404 });
    expect(await tryServer({ address: 'https://x.example' }, answering(200, { hello: 1 }))).toEqual({ problem: 'not-rebofiles' });
    const down = (async () => {
      throw new TypeError('Load failed');
    }) as unknown as typeof fetch;
    expect(await tryServer({ address: 'https://x.example' }, down)).toEqual({ problem: 'unreachable' });
  });
});
