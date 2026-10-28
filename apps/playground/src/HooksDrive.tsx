// A whole drive built from the hooks of @rebofiles/react and nothing else of
// its interface: its own markup and its own look. The site's guide to the
// hooks shows this file as it is, and a test in Chrome goes through it.

import type { EntryId, FileEntry } from '@rebofiles/core';
import { DriveProvider, type View, formatDate, formatSize, useActions, useActivity, useDrive, useEntries, useEntry, useUploads } from '@rebofiles/react';
import { type FormEvent, useState } from 'react';

type Section = 'files' | 'starred' | 'shared' | 'recent' | 'trash';

export function HooksDrive({ user }: { user?: string }) {
  return (
    <DriveProvider base="/api/files" headers={(): Record<string, string> => (user ? { 'x-user': user } : {})}>
      <Screen />
    </DriveProvider>
  );
}

function Screen() {
  const { t, locale } = useDrive();
  const actions = useActions();
  const { uploads, upload } = useUploads();
  const [section, setSection] = useState<Section>('files');
  const [folder, setFolder] = useState<EntryId | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EntryId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // What to show: a search, a folder, or one of the sections. The hook asks again after every change.
  const view: View = query ? { section: 'search', query } : section === 'files' ? { section: 'files', folder } : { section };
  const { entries, path, loading, error } = useEntries(view);

  const go = (next: Section, to: EntryId | null = null) => {
    setSection(next);
    setFolder(to);
    setSelected(null);
    setQuery('');
  };
  // Every action of useActions is a promise: a refusal of the server is a RequestError with its message.
  const attempt = (work: () => Promise<unknown>) =>
    work().then(
      () => setProblem(null),
      (e: Error) => setProblem(e.message),
    );
  const newFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem('name') as HTMLInputElement;
    if (field.value.trim()) void attempt(() => actions.createFolder(field.value.trim(), folder));
    field.value = '';
  };
  const sending = uploads.find((u) => u.state === 'sending');
  const sections: Record<Section, string> = { files: t('myFiles'), starred: t('starred'), shared: t('sharedWithMe'), recent: t('recent'), trash: t('trash') };

  return (
    <div className="hd">
      <style>{STYLE}</style>
      <header>
        <strong>Mini drive</strong>
        <input type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </header>

      <nav aria-label="Sections">
        {(Object.keys(sections) as Section[]).map((s) => (
          <button key={s} type="button" aria-current={section === s && !query} onClick={() => go(s)}>
            {sections[s]}
          </button>
        ))}
      </nav>

      <main>
        <ol className="hd-path" aria-label="Where">
          <li>
            <button type="button" onClick={() => go('files')}>
              {t('myFiles')}
            </button>
          </li>
          {path.map((step) => (
            <li key={step.id}>
              <button type="button" onClick={() => go('files', step.id)}>
                {step.name}
              </button>
            </li>
          ))}
        </ol>

        {section === 'files' && !query && (
          <div className="hd-tools">
            <form onSubmit={newFolder}>
              <input name="name" aria-label={t('folderName')} placeholder={t('folderName')} />
              <button type="submit">{t('newFolder')}</button>
            </form>
            <label className="hd-upload">
              {t('uploadFiles')}
              <input type="file" multiple onChange={(e) => e.target.files && upload(e.target.files, folder)} />
            </label>
            {sending && <progress aria-label={sending.name} value={sending.sent} max={sending.size} />}
          </div>
        )}
        {section === 'trash' && entries.length > 0 && (
          <button type="button" onClick={() => attempt(actions.emptyTrash)}>
            {t('emptyTrash')}
          </button>
        )}

        {problem && <p role="alert">{problem}</p>}
        {error ? (
          <p role="alert">{error.message}</p>
        ) : (
          <table aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">{t('name')}</th>
                <th scope="col">{t('modified')}</th>
                <th scope="col">{t('size')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={entry.id === selected ? 'hd-on' : undefined}>
                  <td>
                    <button type="button" onClick={() => (entry.kind === 'folder' && section !== 'trash' ? go('files', entry.id) : setSelected(entry.id))}>
                      {entry.kind === 'folder' ? '📁 ' : ''}
                      {entry.name}
                    </button>
                  </td>
                  <td>{formatDate(entry.modified, locale)}</td>
                  <td>{entry.kind === 'file' ? formatSize(entry.versions[0].size, locale) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && entries.length === 0 && <p>{t('emptyFolder')}</p>}
      </main>

      {/* One for each entry, so what was typed for one is not kept for the next. */}
      {selected && <Details key={selected} id={selected} inTrash={section === 'trash'} attempt={attempt} onGone={() => setSelected(null)} />}
    </div>
  );
}

/** One entry as the server says it is now, with what may be done to it. */
function Details({ id, inTrash, attempt, onGone }: { id: EntryId; inTrash: boolean; attempt: (work: () => Promise<unknown>) => void; onGone: () => void }) {
  const { t, locale } = useDrive();
  const actions = useActions();
  const found = useEntry(id);
  // Whether it is starred: the list of the starred, which asks again after a star like every other hook.
  const starred = useEntries({ section: 'starred' }).entries.some((entry) => entry.id === id);
  const { activity } = useActivity(id, 10);
  const [name, setName] = useState<string | null>(null);
  if (!found) return null;
  const { entry, path } = found;
  const file: FileEntry | null = entry.kind === 'file' ? entry : null;
  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (name?.trim()) attempt(() => actions.rename(entry.id, name.trim()).then(() => setName(null)));
  };
  return (
    <aside aria-label={t('details')}>
      <h2>{entry.name}</h2>
      <p>
        {entry.owner} · {path.map((step) => step.name).join(' / ') || t('top')}
      </p>
      {inTrash ? (
        <button type="button" onClick={() => attempt(() => actions.restore(entry.id).then(onGone))}>
          {t('restore')}
        </button>
      ) : (
        <>
          <form onSubmit={rename}>
            <input aria-label={t('newName')} value={name ?? entry.name} onChange={(e) => setName(e.target.value)} />
            <button type="submit">{t('rename')}</button>
          </form>
          <button type="button" aria-pressed={starred} onClick={() => attempt(() => actions.star(entry.id, !starred))}>
            {starred ? t('unstar') : t('star')}
          </button>
          {file && (
            <>
              <button type="button" onClick={() => actions.url(file.id).then((url) => window.open(url, '_blank'))}>
                {t('download')}
              </button>
              <button type="button" onClick={() => attempt(() => actions.copy(file.id))}>
                {t('makeCopy')}
              </button>
            </>
          )}
          <button type="button" onClick={() => attempt(() => actions.moveToTrash(entry.id).then(onGone))}>
            {t('moveToTrash')}
          </button>
        </>
      )}
      {file && (
        <>
          <h3>{t('versions')}</h3>
          <ul>
            {file.versions.map((version, i) => (
              <li key={version.id}>
                {formatDate(version.at, locale)} · {formatSize(version.size, locale)}{' '}
                {i === 0 ? (
                  `(${t('current')})`
                ) : (
                  <button type="button" onClick={() => attempt(() => actions.restoreVersion(file.id, version.id))}>
                    {t('restore')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{t('activity')}</h3>
      {activity.length ? (
        <ul aria-label={t('activity')}>
          {activity.map((done) => (
            <li key={`${done.at}-${done.action}`}>
              {done.by} · {done.action} · {formatDate(done.at, locale)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('noActivity')}</p>
      )}
    </aside>
  );
}

const STYLE = `
.hd { font: 15px/1.5 Georgia, 'Times New Roman', serif; color: #1d2433; display: grid; grid-template: auto 1fr / 180px 1fr auto; gap: 0 24px; height: 100%; padding: 16px; box-sizing: border-box; background: #fbfaf7; }
.hd header { grid-column: 1 / -1; display: flex; gap: 16px; align-items: center; padding-bottom: 16px; border-bottom: 2px solid #1d2433; margin-bottom: 16px; }
.hd header input { flex: 1; max-width: 360px; }
.hd nav { display: flex; flex-direction: column; gap: 4px; }
.hd nav button[aria-current='true'] { font-weight: 700; text-decoration: underline; }
.hd button, .hd input { font: inherit; color: inherit; }
.hd button { background: none; border: 1px solid #1d2433; padding: 4px 10px; cursor: pointer; text-align: left; }
.hd td button { border: 0; padding: 0; text-decoration: underline; }
.hd-path { display: flex; gap: 8px; list-style: none; padding: 0; margin: 0 0 12px; }
.hd-path li + li::before { content: '›'; margin-right: 8px; }
.hd-path button { border: 0; padding: 0; }
.hd-tools { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.hd-upload input { margin-left: 8px; }
.hd table { width: 100%; border-collapse: collapse; }
.hd th, .hd td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #d9d4c7; }
.hd tr.hd-on { background: #f1ead8; }
.hd aside { width: 260px; border-left: 2px solid #1d2433; padding-left: 16px; }
.hd aside form { display: flex; gap: 6px; margin: 8px 0; }
.hd aside > button { display: block; margin: 4px 0; }
.hd aside input { min-width: 0; flex: 1; }
.hd [role='alert'] { color: #9b1c1c; }
`;
