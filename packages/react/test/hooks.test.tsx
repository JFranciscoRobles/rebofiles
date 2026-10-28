// @vitest-environment happy-dom
// The hooks, each in a component as an application would write it, against
// the drive kept in the page: what they show, what they ask again after a
// change made through them, through <FileDrive>, or by someone else.

import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as core from '@rebofiles/core';
import { createMemoryClient } from '@rebofiles/drive';
import {
  DriveProvider,
  FileDrive,
  useActions,
  useActivity,
  useComments,
  useDrive,
  useEntries,
  useEntry,
  useExpiring,
  useNotifications,
  usePeople,
  useRequests,
  useSettings,
  useTextSearch,
  useUploads,
  useWithField,
} from '../src';

afterEach(cleanup);

const made = (user = 'ana') => createMemoryClient({ user, uploadStep: 0 });
const within = (client: ReturnType<typeof made>, props: { live?: boolean; language?: 'en' | 'es' | 'zh' } = {}) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DriveProvider client={client} {...props}>
        {children}
      </DriveProvider>
    );
  };
const names = (entries: core.Entry[]) => entries.map((entry) => entry.name);

describe('useEntries', () => {
  it('lists a folder, and asks again after a change made through useActions', async () => {
    const client = made();
    const clients = await client.createFolder('Clients', null);
    const { result } = renderHook(() => ({ entries: useEntries({ section: 'files', folder: null }), actions: useActions() }), { wrapper: within(client) });
    expect(result.current.entries.loading).toBe(true);
    await waitFor(() => expect(names(result.current.entries.entries)).toEqual(['Clients']));
    await act(() => result.current.actions.createFolder('Archive', null));
    await waitFor(() => expect(names(result.current.entries.entries).sort()).toEqual(['Archive', 'Clients']));
    await act(() => result.current.actions.moveToTrash(clients.id));
    await waitFor(() => expect(names(result.current.entries.entries)).toEqual(['Archive']));
  });

  it('says it is loading for another view until it comes, not showing the last one as this one', async () => {
    const client = made();
    const inside = await client.createFolder('Inside', null);
    await client.createFolder('Deeper', inside.id);
    const { result, rerender } = renderHook(({ folder }: { folder: string | null }) => useEntries({ section: 'files', folder }), {
      wrapper: within(client),
      initialProps: { folder: null as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ folder: inside.id });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(names(result.current.entries)).toEqual(['Deeper']));
    expect(names(result.current.path)).toEqual(['Inside']);
  });

  it('finds by name, lists the recent and the trash', async () => {
    const client = made();
    await client.upload(new File(['a'], 'report.pdf'), {});
    const notes = await client.upload(new File(['b'], 'notes.txt'), {});
    await client.moveToTrash(notes.id);
    const { result } = renderHook(() => ({ found: useEntries({ section: 'search', query: 'rep' }), recent: useEntries({ section: 'recent' }), trash: useEntries({ section: 'trash' }) }), {
      wrapper: within(client),
    });
    await waitFor(() => expect(names(result.current.found.entries)).toEqual(['report.pdf']));
    await waitFor(() => expect(names(result.current.recent.entries)).toEqual(['report.pdf']));
    await waitFor(() => expect(names(result.current.trash.entries)).toEqual(['notes.txt']));
  });

  it('shows what someone else changed, as it happens; and not when told not to watch', async () => {
    const client = made();
    const team = await client.createFolder('Team', null);
    const { result } = renderHook(() => useEntries({ section: 'files', folder: team.id }), { wrapper: within(client) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => client.apply((drive, at) => core.createFolder(drive, { id: 'from-bea', name: 'From Bea', parent: team.id }, at), 'bea'));
    await waitFor(() => expect(names(result.current.entries)).toEqual(['From Bea']));

    const quiet = made();
    const still = renderHook(() => useEntries({ section: 'files', folder: null }), { wrapper: within(quiet, { live: false }) });
    await waitFor(() => expect(still.result.current.loading).toBe(false));
    act(() => quiet.apply((drive, at) => core.createFolder(drive, { id: 'x', name: 'Unseen', parent: null }, at), 'bea'));
    await new Promise((done) => setTimeout(done, 400));
    expect(still.result.current.entries).toEqual([]);
  });
});

describe('useEntry', () => {
  it('is null while it loads and for none, and the entry as it is after a rename', async () => {
    const client = made();
    const folder = await client.createFolder('Old name', null);
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => ({ entry: useEntry(id), actions: useActions() }), {
      wrapper: within(client),
      initialProps: { id: folder.id as string | null },
    });
    expect(result.current.entry).toBeNull();
    await waitFor(() => expect(result.current.entry?.entry.name).toBe('Old name'));
    await act(() => result.current.actions.rename(folder.id, 'New name'));
    await waitFor(() => expect(result.current.entry?.entry.name).toBe('New name'));
    rerender({ id: null });
    expect(result.current.entry).toBeNull();
  });
});

describe('useSettings', () => {
  it('reads the settings, saves one’s own language, and the texts follow it', async () => {
    const client = made();
    const { result } = renderHook(() => ({ settings: useSettings(), drive: useDrive() }), { wrapper: within(client) });
    await waitFor(() => expect(result.current.settings.settings).not.toBeNull());
    expect(result.current.drive.t('newFolder')).toBe('New folder');
    await act(() => result.current.settings.saveMine({ language: 'es' }));
    await waitFor(() => expect(result.current.drive.language).toBe('es'));
    expect(result.current.drive.t('newFolder')).toBe('Carpeta nueva');
    await act(() => result.current.settings.save({ trashDays: 7 }));
    await waitFor(() => expect(result.current.settings.drive?.trashDays).toBe(7));
  });
});

describe('useUploads', () => {
  it('sends files up, tells when each is done, and the listing asks again', async () => {
    const client = made();
    const { result } = renderHook(() => ({ uploads: useUploads(), entries: useEntries({ section: 'files', folder: null }) }), { wrapper: within(client) });
    const done: string[] = [];
    act(() => result.current.uploads.upload([new File(['one'], 'one.txt'), new File(['two'], 'two.txt')], null, (entry) => done.push(entry.name)));
    await waitFor(() => expect(done.sort()).toEqual(['one.txt', 'two.txt']));
    await waitFor(() => expect(result.current.uploads.uploads.every((u) => u.state === 'done')).toBe(true));
    await waitFor(() => expect(names(result.current.entries.entries).sort()).toEqual(['one.txt', 'two.txt']));
  });
});

describe('useDrive', () => {
  it('needs a provider above it', () => {
    expect(() => renderHook(() => useDrive())).toThrow(/DriveProvider/);
  });
});

describe('<FileDrive>', () => {
  it('mounts the drive, and a change made in it reaches the hooks beside it', async () => {
    const client = made();
    await client.createFolder('Clients', null);
    function Count() {
      const { entries } = useEntries({ section: 'files', folder: null });
      return <output aria-label="count">{entries.length}</output>;
    }
    render(
      <DriveProvider client={client}>
        <FileDrive title="Acme" settings={false} />
        <Count />
      </DriveProvider>,
    );
    await waitFor(() => expect(screen.getByRole('option', { name: /^Clients/ })).toBeTruthy());
    expect(screen.getByLabelText('count').textContent).toBe('1');
    // Made by another part of the page, with a provider of its own on the same client: told by the client's watch,
    // the provider asks again, and the drive with it, from its revision.
    const { result } = renderHook(() => useActions(), { wrapper: within(client) });
    await act(() => result.current.createFolder('Archive', null));
    await waitFor(() => expect(screen.getByLabelText('count').textContent).toBe('2'), { timeout: 2000 });
    await waitFor(() => expect(screen.getByRole('option', { name: /^Archive/ })).toBeTruthy(), { timeout: 2000 });
  });
});

describe('useComments', () => {
  it('reads what is said of an entry, says more, a reply under it, resolves and takes back', async () => {
    const client = made();
    const plan = await client.createFolder('Plan', null);
    const { result } = renderHook(() => useComments(plan.id), { wrapper: within(client) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toEqual([]);
    const first = await act(() => result.current.add('Looks good'));
    await act(() => result.current.add('Agreed', first.id));
    await waitFor(() => expect(result.current.comments.map((c) => c.text)).toEqual(['Looks good', 'Agreed']));
    await act(() => result.current.resolve(first.id));
    await waitFor(() => expect(result.current.comments[0].resolved?.by).toBe('ana'));
    await act(() => result.current.remove(first.id));
    await waitFor(() => expect(result.current.comments).toEqual([]));
  });
});

describe('useEntries, starred and received; useActions, what is newer', () => {
  it('stars a file and lists it, copies it beside, gives a folder a colour and a file its fields', async () => {
    const client = made();
    const cases = await client.createFolder('Cases', null);
    const report = await client.upload(new File(['a'], 'report.pdf'), { parent: cases.id });
    const { result } = renderHook(
      () => ({ starred: useEntries({ section: 'starred' }), inside: useEntries({ section: 'files', folder: cases.id }), entry: useEntry(report.id), actions: useActions() }),
      { wrapper: within(client) },
    );
    await waitFor(() => expect(result.current.starred.loading).toBe(false));
    expect(result.current.starred.entries).toEqual([]);
    await act(() => result.current.actions.star(report.id));
    await waitFor(() => expect(names(result.current.starred.entries)).toEqual(['report.pdf']));
    await act(() => result.current.actions.copy(report.id));
    await waitFor(() => expect(result.current.inside.entries).toHaveLength(2));
    await act(() => result.current.actions.setFields(report.id, { case: '2026-114' }));
    await waitFor(() => expect(result.current.entry?.entry.fields?.case).toBe('2026-114'));
    await act(() => result.current.actions.setColor(cases.id, 'green'));
    expect((await client.entry(cases.id)).entry).toMatchObject({ color: 'green' });
    await act(() => result.current.actions.star(report.id, false));
    await waitFor(() => expect(result.current.starred.entries).toEqual([]));
  });

  it('lists what came through requests, and a review of it is seen', async () => {
    const client = made();
    const came = await client.upload(new File(['id'], 'passport.pdf'), {});
    const { result } = renderHook(() => ({ received: useEntries({ section: 'received' }), actions: useActions() }), {
      wrapper: within({ ...client, received: async () => [(await client.entry(came.id)).entry] }),
    });
    await waitFor(() => expect(names(result.current.received.entries)).toEqual(['passport.pdf']));
    await act(() => result.current.actions.review(came.id, 'rejected', 'Blurred'));
    await waitFor(() => expect(result.current.received.entries[0].fields).toMatchObject({ review: 'rejected', reviewReason: 'Blurred' }));
  });
});

describe('useActivity', () => {
  it('says who did what to an entry, the newest first, and asks again after a change', async () => {
    const client = made();
    const folder = await client.createFolder('Old name', null);
    const { result } = renderHook(() => ({ activity: useActivity(folder.id), actions: useActions() }), { wrapper: within(client) });
    await waitFor(() => expect(result.current.activity.activity.map((a) => a.action)).toEqual(['created']));
    await act(() => result.current.actions.rename(folder.id, 'New name'));
    await waitFor(() => expect(result.current.activity.activity).toHaveLength(2));
    expect(result.current.activity.activity[0]).toMatchObject({ by: 'ana', name: 'New name' });
  });
});

describe('useTextSearch', () => {
  it('finds a file by what is written inside, and nothing for an empty query', async () => {
    const client = made();
    await client.upload(new File(['x'], 'contract.txt'), { text: async () => 'The indemnity is capped at one year of fees.' });
    const { result, rerender } = renderHook(({ query }: { query: string }) => useTextSearch(query), { wrapper: within(client), initialProps: { query: 'indemnity' } });
    await waitFor(() => expect(result.current.results.map((r) => r.entry.name)).toEqual(['contract.txt']));
    expect(result.current.results[0].snippet).toMatch(/indemnity/);
    rerender({ query: '  ' });
    expect(result.current).toMatchObject({ results: [], loading: false });
  });
});

describe('useNotifications', () => {
  it('reads what one was told and how many are new, and saying they were seen asks again', async () => {
    let unseen = 1;
    const notice = { id: 'n1', kind: 'shared' as const, entry: 'e1', name: 'Plan', by: 'bea', at: '2026-10-28T10:00:00.000Z', role: 'viewer' as const };
    const client = { ...made(), notifications: async () => ({ notifications: [notice], unseen }), sawNotifications: async () => void (unseen = 0) };
    const { result } = renderHook(() => useNotifications(), { wrapper: within(client) });
    await waitFor(() => expect(result.current.unseen).toBe(1));
    expect(result.current.notifications.map((n) => n.name)).toEqual(['Plan']);
    await act(() => result.current.saw());
    await waitFor(() => expect(result.current.unseen).toBe(0));
  });
});

describe('useRequests', () => {
  it('lists the requests for files made, and one more after a link that takes files', async () => {
    const client = made();
    const inbox = await client.createFolder('Inbox', null);
    const { result } = renderHook(() => ({ requests: useRequests(), actions: useActions() }), { wrapper: within(client) });
    await waitFor(() => expect(result.current.requests.loading).toBe(false));
    expect(result.current.requests.requests).toEqual([]);
    await act(() => result.current.actions.createLink(inbox.id, 7, { uploads: 'only' }));
    await waitFor(() => expect(result.current.requests.requests.map((r) => r.folder.name)).toEqual(['Inbox']));
  });
});

describe('usePeople', () => {
  it('looks up who matches what is typed, and no one for nothing typed', async () => {
    const asked: string[] = [];
    const client = { ...made(), people: async (query: string) => (asked.push(query), [{ id: 'bea', name: 'Bea Ruiz' }]) };
    const { result, rerender } = renderHook(({ query }: { query: string }) => usePeople(query), { wrapper: within(client), initialProps: { query: '' } });
    expect(result.current).toMatchObject({ people: [], loading: false });
    rerender({ query: 'be' });
    await waitFor(() => expect(result.current.people.map((p) => p.name)).toEqual(['Bea Ruiz']));
    expect(asked).toEqual(['be']);
  });
});

describe('useExpiring and useWithField', () => {
  it('lists what is about to expire, the soonest first, and the files of one record by a field', async () => {
    const client = made();
    const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    const passport = await client.upload(new File(['p'], 'passport.pdf'), {});
    const licence = await client.upload(new File(['l'], 'licence.pdf'), {});
    const deed = await client.upload(new File(['d'], 'deed.pdf'), {});
    await client.setFields(passport.id, { expires: inDays(10), client: 'carla' });
    await client.setFields(licence.id, { expires: inDays(3), client: 'carla' });
    await client.setFields(deed.id, { expires: inDays(90), client: 'diego' });
    const { result, rerender } = renderHook(({ who }: { who: string }) => ({ expiring: useExpiring(30), of: useWithField('client', who), actions: useActions() }), {
      wrapper: within(client),
      initialProps: { who: 'carla' },
    });
    await waitFor(() => expect(result.current.expiring.files.map((f) => f.entry.name)).toEqual(['licence.pdf', 'passport.pdf']));
    await waitFor(() => expect(names(result.current.of.entries).sort()).toEqual(['licence.pdf', 'passport.pdf']));
    await act(() => result.current.actions.setFields(deed.id, { client: 'carla' }));
    await waitFor(() => expect(result.current.of.entries).toHaveLength(3));
    rerender({ who: '' });
    expect(result.current.of).toMatchObject({ entries: [], loading: false });
  });
});
