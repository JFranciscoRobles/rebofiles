// Who is who, as the application says: the people and groups that match what
// is typed where an entry is shared, and how each is called.

import { describe, expect, it } from 'vitest';
import { type Someone, byRoles, createDriveHandler, diskStorage, memoryMetadata } from '../src';
import { client } from './helpers';

const PEOPLE: Someone[] = [
  { id: 'ana@acme.test', name: 'Ana Ruiz', detail: 'ana@acme.test' },
  { id: 'beto@acme.test', name: 'Beto Díaz', detail: 'beto@acme.test' },
  { id: 'group:sales', name: 'Ventas' },
];

function drive(people?: Parameters<typeof createDriveHandler>[0]['people']) {
  return createDriveHandler({
    storage: diskStorage({ folder: `/tmp/rebofiles-people-${Math.random()}`, secret: 's' }),
    metadata: memoryMetadata(),
    identify: (request) => {
      const id = request.headers.get('x-user');
      return id ? { id } : null;
    },
    authorize: byRoles,
    secret: 'u',
    base: '/api/files',
    people,
  });
}

describe('the people of the application', () => {
  it('are looked up by what is typed, at most ten, asked as who asks', async () => {
    const asked: { query: string; by: string }[] = [];
    const handle = drive({
      search: (query, user) => {
        asked.push({ query, by: user.id });
        return [...PEOPLE.filter((one) => one.name.toLowerCase().includes(query.toLowerCase())), ...Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, name: `Ventas ${i}` }))];
      },
    });
    const ana = client(handle, 'ana@acme.test');
    expect((await ana.ask('GET', '/api/files/settings')).body.can).toMatchObject({ people: true });
    const found = (await ana.ask('GET', '/api/files/people?q=ven')).body.people as Someone[];
    expect(found[0]).toEqual({ id: 'group:sales', name: 'Ventas' });
    expect(found).toHaveLength(10);
    expect(asked).toEqual([{ query: 'ven', by: 'ana@acme.test' }]);
    // Nothing typed, nothing asked.
    expect((await ana.ask('GET', '/api/files/people?q=%20')).body.people).toEqual([]);
    expect(asked).toHaveLength(1);
  });

  it('are called by their names, those known; without `names`, none', async () => {
    const handle = drive({
      search: () => [],
      names: (ids) => Object.fromEntries(PEOPLE.filter((one) => ids.includes(one.id)).map((one) => [one.id, one.name])),
    });
    const ana = client(handle, 'ana@acme.test');
    const named = await ana.ask('POST', '/api/files/people/names', { ids: ['beto@acme.test', 'group:sales', 'nadie@acme.test', 7] });
    expect(named.body.names).toEqual({ 'beto@acme.test': 'Beto Díaz', 'group:sales': 'Ventas' });
    const without = client(drive({ search: () => [] }), 'ana@acme.test');
    expect((await without.ask('POST', '/api/files/people/names', { ids: ['beto@acme.test'] })).body.names).toEqual({});
  });

  it('are not looked up by a drive not given them', async () => {
    const ana = client(drive(), 'ana@acme.test');
    expect((await ana.ask('GET', '/api/files/settings')).body.can).toMatchObject({ people: false });
    const refused = await ana.ask('GET', '/api/files/people?q=ana');
    expect(refused.status).toBe(404);
    expect(refused.body.error).toBe('no-people');
    expect((await client(drive({ search: () => PEOPLE }), '').ask('GET', '/api/files/people?q=ana')).status).toBe(401);
  });
});
