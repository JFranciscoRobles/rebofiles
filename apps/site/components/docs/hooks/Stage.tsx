'use client';

// A real drive for the hooks, kept in the page: one DriveProvider on a drive
// made here, the piece of interface of the hook chosen (the very file shown
// under "Use it"), what it is given, and what the hook gives right now, read
// by calling it with the same.

import type { EntryId, Notice } from '@rebofiles/core';
import {
  DriveProvider,
  type MemoryClient,
  createMemoryClient,
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
} from '@rebofiles/react';
import { type ComponentType, useEffect, useState } from 'react';
import { useLocale } from '@/components/useLocale';
import { type LiveValue, field, live, useEmit, useT } from './live';
import Actions from './examples/useActions';
import Activity from './examples/useActivity';
import Comments from './examples/useComments';
import Drive from './examples/useDrive';
import Entries from './examples/useEntries';
import Entry from './examples/useEntry';
import Expiring from './examples/useExpiring';
import Notifications from './examples/useNotifications';
import People from './examples/usePeople';
import Requests from './examples/useRequests';
import Settings from './examples/useSettings';
import TextSearch from './examples/useTextSearch';
import { UploadsPanel } from './examples/useUploads';
import WithField from './examples/useWithField';

/** What the demos are given: the files of the drive made here, and what is typed or chosen above them. */
interface Given {
  folder: EntryId | null;
  file: EntryId;
  query: string;
  days: number;
  client: string;
}

interface Made {
  client: MemoryClient;
  contract: EntryId;
  clients: EntryId;
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const DIRECTORY = [
  { id: 'bea', name: 'Bea Ruiz', detail: 'Legal' },
  { id: 'ben', name: 'Benito Soto', detail: 'Sales' },
  { id: 'carla', name: 'Carla Ruiz', detail: 'Client' },
  { id: 'diego', name: 'Diego Paz', detail: 'Client' },
];

/** Acme's drive, small: two folders, a contract with its text and a comment, documents that run out, a request for files. */
async function make(): Promise<Made> {
  // Made at once; only an upload of the demo's is slowed, below, to be seen going.
  const memory = createMemoryClient({ user: 'You', label: 'memory', uploadStep: 0 });
  const text = (words: string) => async () => words;
  const clients = await memory.createFolder('Clients', null);
  const invoices = await memory.createFolder('Invoices', null);
  const contract = await memory.upload(new File(['contract'], 'contract-northwind.txt', { type: 'text/plain' }), {
    parent: clients.id,
    text: text('This agreement is made between Acme Ltd. and Northwind S.A. The indemnity is capped at one year of fees. Payment is due within thirty days of each invoice.'),
  });
  const passport = await memory.upload(new File(['passport'], 'passport-carla.pdf', { type: 'application/pdf' }), { parent: clients.id, text: text('Passport. Carla Ruiz.') });
  const licence = await memory.upload(new File(['licence'], 'licence-diego.pdf', { type: 'application/pdf' }), { parent: clients.id, text: text('Driving licence. Diego Paz.') });
  const insurance = await memory.upload(new File(['insurance'], 'insurance-carla.pdf', { type: 'application/pdf' }), { parent: clients.id, text: text('Home insurance policy for Carla Ruiz.') });
  await memory.upload(new File(['0142'], 'invoice-0142.pdf', { type: 'application/pdf' }), { parent: invoices.id, text: text('Invoice 0142. Northwind S.A. $2,500.00') });
  await memory.upload(new File(['# Notes'], 'notes.md', { type: 'text/markdown' }), { text: text('Call Northwind about the indemnity before Friday.') });
  await memory.setFields(contract.id, { client: 'carla' });
  await memory.setFields(passport.id, { client: 'carla', expires: inDays(9) });
  await memory.setFields(insurance.id, { client: 'carla', expires: inDays(40) });
  await memory.setFields(licence.id, { client: 'diego', expires: inDays(-2) });
  await memory.star(contract.id);
  await memory.rename(contract.id, 'contract-northwind-final.txt');
  const first = await memory.addComment(contract.id, 'Is the indemnity capped as we agreed?');
  await memory.addComment(contract.id, 'Yes, one year of fees.', first.id);
  await memory.createLink(invoices.id, 14, { uploads: 'only' });

  // What a drive of one person in a page has none of: others to be told by, a directory, a mail to remind by.
  let unseen = 2;
  const notices: Notice[] = [
    { id: 'n1', kind: 'shared', entry: invoices.id, name: 'Invoices', by: 'Bea Ruiz', at: new Date(Date.now() - 3_600_000).toISOString(), role: 'editor' },
    { id: 'n2', kind: 'mentioned', entry: contract.id, name: 'contract-northwind-final.txt', by: 'Benito Soto', at: new Date(Date.now() - 86_400_000).toISOString() },
  ];
  const client: MemoryClient = {
    ...memory,
    notifications: async () => ({ notifications: notices, unseen }),
    sawNotifications: async () => void (unseen = 0),
    people: async (query) => DIRECTORY.filter((person) => `${person.name} ${person.detail}`.toLowerCase().includes(query.toLowerCase())),
    names: async (ids) => Object.fromEntries(DIRECTORY.filter((person) => ids.includes(person.id)).map((person) => [person.id, person.name])),
    remind: async (id) => (await memory.entry(id)).entry,
    // A file of the demo goes up as on a slow connection, an eighth at a time, and stops when stopped.
    upload: async (file, how = {}) => {
      for (let sent = 0; sent < 8; sent++) {
        how.onProgress?.({ sent: Math.round((file.size * sent) / 8), size: file.size });
        await new Promise<void>((done, fail) => {
          const timer = setTimeout(done, 350);
          how.signal?.addEventListener('abort', () => (clearTimeout(timer), fail(new DOMException('The upload was stopped.', 'AbortError'))));
        });
      }
      return memory.upload(file, how);
    },
  };
  return { client, contract: contract.id, clients: clients.id };
}

/** One drive for the page, made the first time a hook is opened and kept as the hooks change: what is done in one is seen in the next. */
let once: Promise<Made> | null = null;
const theDrive = () => (once ??= make());

const names = (entries: { name: string }[]) => entries.map((entry) => entry.name);

/** Each hook called with what its demo is given, and what it gives put as values: one hook each, called the same way at every render. */
const PROBES: Record<string, (given: Given) => LiveValue[]> = {
  useEntries: ({ folder }) => {
    const { entries, path, loading, error } = useEntries({ section: 'files', folder });
    return [live.list('entries', names(entries)), live.list('path', names(path)), live.bool('loading', loading), live.error('error', error), live.call('refresh')];
  },
  useEntry: ({ file }) => {
    const found = useEntry(file);
    if (!found) return [{ key: 'useEntry(id)', value: 'null', kind: 'empty' }];
    return [live.str('entry.name', found.entry.name), live.str('entry.owner', found.entry.owner), live.list('path', names(found.path)), live.bool('trashed', found.trashed)];
  },
  useTextSearch: ({ query }) => {
    const { results, loading, error } = useTextSearch(query);
    return [
      live.list(
        'results',
        results.map((r) => r.entry.name),
      ),
      live.str('results[0].snippet', results[0]?.snippet),
      live.bool('loading', loading),
      live.error('error', error),
    ];
  },
  useActivity: ({ file }) => {
    const { activity, loading } = useActivity(file, 10);
    return [live.num('activity.length', activity.length), live.str('activity[0].action', activity[0]?.action), live.str('activity[0].by', activity[0]?.by), live.bool('loading', loading)];
  },
  useActions: ({ file }) => {
    const actions = useActions();
    const found = useEntry(file);
    const starred = useEntries({ section: 'starred' }).entries.some((entry) => entry.id === file);
    return [
      ...['rename', 'star', 'copy', 'setFields', 'moveToTrash', 'restore'].filter((name) => name in actions).map((name) => live.call(name)),
      { key: '// the file now', value: '', kind: 'empty' },
      live.str('name', found?.entry.name),
      live.bool('starred', starred),
      live.str('fields.reviewed', found?.entry.fields?.reviewed),
      live.bool('trashed', found?.trashed ?? false),
    ];
  },
  useComments: ({ file }) => {
    const { comments, loading } = useComments(file);
    return [
      live.num('comments.length', comments.length),
      live.str('comments[0].text', comments[0]?.text),
      live.bool('comments[0].resolved', Boolean(comments[0]?.resolved)),
      live.bool('loading', loading),
      live.call('add'),
      live.call('resolve'),
    ];
  },
  useNotifications: () => {
    const { notifications, unseen, loading } = useNotifications();
    return [
      live.num('notifications.length', notifications.length),
      live.str('notifications[0].kind', notifications[0]?.kind),
      live.num('unseen', unseen),
      live.bool('loading', loading),
      live.call('saw'),
    ];
  },
  useRequests: () => {
    const { requests, loading } = useRequests();
    return [
      live.list(
        'requests',
        requests.map((r) => r.folder.name),
      ),
      live.str('requests[0].link.uploads', requests[0]?.link.uploads),
      live.bool('loading', loading),
      live.call('remind'),
    ];
  },
  usePeople: ({ query }) => {
    const { people, loading } = usePeople(query);
    return [live.list('people', names(people)), live.bool('loading', loading)];
  },
  useExpiring: ({ days }) => {
    const { files, loading } = useExpiring(days);
    return [
      live.list(
        'files',
        files.map((f) => f.entry.name),
      ),
      live.num('files[0].days', files[0]?.days ?? 0),
      live.str('files[0].expires', files[0]?.expires),
      live.bool('loading', loading),
    ];
  },
  useWithField: ({ client }) => {
    const { entries, loading } = useWithField('client', client);
    return [live.list('entries', names(entries)), live.bool('loading', loading)];
  },
  useSettings: () => {
    const { mine, drive, canConfigure } = useSettings();
    return [live.str('mine.language', mine?.language), live.num('drive.trashDays', drive?.trashDays ?? 0), live.bool('canConfigure', canConfigure), live.call('save'), live.call('saveMine')];
  },
  useDrive: () => {
    const { revision, locale, language } = useDrive();
    return [live.call('client'), live.num('revision', revision), live.call('changed'), live.str('locale', locale), live.str('language', language), live.call('t')];
  },
};

/** Each hook's demo, given what it takes from the stage. */
const DEMOS: Record<string, ComponentType<{ given: Given; set: (change: Partial<Given>) => void; onValues: (values: LiveValue[]) => void }>> = {
  useEntries: ({ given, set }) => <Entries folder={given.folder} onOpen={(folder) => set({ folder })} />,
  useEntry: ({ given }) => <Entry id={given.file} />,
  useTextSearch: ({ given }) => <TextSearch query={given.query} />,
  useActivity: ({ given }) => <Activity id={given.file} />,
  useActions: ({ given }) => <Actions id={given.file} />,
  // The queue is one call of the hook's, shown by the demo and read here: a second call would be a queue of its own.
  useUploads: ({ given, onValues }) => {
    const queue = useUploads();
    const last = queue.uploads.at(-1);
    useEmit(onValues, [
      live.num('uploads.length', queue.uploads.length),
      live.str('uploads.at(-1).state', last?.state),
      live.num('uploads.at(-1).sent', last?.sent ?? 0),
      live.num('summary.remaining', Math.round(queue.summary.remaining ?? 0)),
      live.call('upload'),
      live.call('stop'),
    ]);
    return <UploadsPanel queue={queue} folder={given.folder} />;
  },
  useComments: ({ given }) => <Comments id={given.file} />,
  useNotifications: () => <Notifications />,
  useRequests: () => <Requests />,
  usePeople: ({ given, set }) => <People query={given.query} onPick={(id) => set({ query: DIRECTORY.find((person) => person.id === id)?.name ?? '' })} />,
  useExpiring: ({ given }) => <Expiring days={given.days} />,
  useWithField: ({ given }) => <WithField client={given.client} />,
  useSettings: () => <Settings />,
  useDrive: () => <Drive />,
};

/** What each demo lets be chosen above it. */
const CONTROLS: Record<string, ('query' | 'days' | 'client')[]> = {
  useTextSearch: ['query'],
  usePeople: ['query'],
  useExpiring: ['days'],
  useWithField: ['client'],
};
const FIRST_QUERY: Record<string, string> = { useTextSearch: 'indemnity', usePeople: 'ruiz' };

function Probe({ probe, given, onValues }: { probe: (given: Given) => LiveValue[]; given: Given; onValues: (values: LiveValue[]) => void }) {
  useEmit(onValues, probe(given));
  return null;
}

export default function Stage({ name, onValues }: { name: string; onValues: (values: LiveValue[]) => void }) {
  const [made, setMade] = useState<Made | null>(null);
  const [given, setGiven] = useState<Given | null>(null);
  const { locale } = useLocale();
  const t = useT();

  useEffect(() => {
    let on = true;
    theDrive().then((drive) => {
      if (!on) return;
      setMade(drive);
      setGiven({ folder: null, file: drive.contract, query: FIRST_QUERY[name] ?? '', days: 30, client: 'carla' });
    });
    return () => {
      on = false;
    };
  }, [name]);

  if (!made || !given)
    return <p className="m-0 grid h-[220px] place-items-center text-sm text-muted">{t({ en: 'Making a drive in the page…', es: 'Creando un drive en la página…', zh: '正在页面中创建网盘…' })}</p>;
  const set = (change: Partial<Given>) => setGiven((was) => (was ? { ...was, ...change } : was));
  const Demo = DEMOS[name];
  return (
    <DriveProvider client={made.client} language={locale}>
      {CONTROLS[name] && (
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#f0eee9] pb-3 text-[13px] text-muted">
          {CONTROLS[name].includes('query') && (
            <label className="flex items-center gap-2">
              <code className="font-code">query</code>
              <input className={field} value={given.query} onChange={(event) => set({ query: event.target.value })} />
            </label>
          )}
          {CONTROLS[name].includes('days') && (
            <label className="flex items-center gap-2">
              <code className="font-code">days</code>
              <select className={field} value={given.days} onChange={(event) => set({ days: Number(event.target.value) })}>
                {[7, 15, 30, 60].map((days) => (
                  <option key={days} value={days}>
                    {days}
                  </option>
                ))}
              </select>
            </label>
          )}
          {CONTROLS[name].includes('client') && (
            <label className="flex items-center gap-2">
              <code className="font-code">value</code>
              <select className={field} value={given.client} onChange={(event) => set({ client: event.target.value })}>
                <option value="carla">carla</option>
                <option value="diego">diego</option>
              </select>
            </label>
          )}
        </div>
      )}
      <div className="hook-demo text-sm">
        <Demo given={given} set={set} onValues={onValues} />
      </div>
      {PROBES[name] && <Probe probe={PROBES[name]} given={given} onValues={onValues} />}
    </DriveProvider>
  );
}
