// The whole drive: a bar with the search, the sections beside, the list or
// the grid of a folder, the details of what is selected, and a bar of status.
// It is built from the hooks of `headless.tsx` and nothing else, so a screen
// of your own can do what this one does.

import { EVERYONE, type Entry, type EntryId, type FileEntry, type FolderEntry, type Role, versionNumber } from '@rebofiles/core';
import { type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { RequestError } from './client';
import { DriveProvider, type DriveProviderProps, type View, useActions, useDrive, useEntries, useEntry, useOuterDrive, useUploads } from './headless';
import { formatDate, formatSize } from './i18n';
import { Icon, Logo } from './icons';
import { badgeOf, kindOf } from './kinds';
import { CSS } from './styles';

export interface FileDriveProps extends Omit<DriveProviderProps, 'children'> {
  /** The name over the drive: the application's, or "Files". */
  title?: string;
  /** What goes before the title; ReboFiles' mark unless given. */
  logo?: ReactNode;
  defaultView?: 'list' | 'grid';
  /** A file opened with a double click or Enter. Unless given, it opens in a new tab, as the browser shows it. */
  onOpen?: (file: FileEntry, url: string) => void;
  /** Gives Word documents an "Open in Rebodocs" button, which calls this with an address to read the file from. */
  onOpenDocument?: (file: FileEntry, url: string) => void;
  /** Reads a Word document for its preview: `previewDocx` of `@rebofiles/react/rebodocs`, or one of your own. */
  previewDocument?: (bytes: Uint8Array) => DocumentPreview | Promise<DocumentPreview>;
  /** Light (the default), dark, or as the system is (`'auto'`). Its colours are custom properties either way. */
  theme?: 'light' | 'dark' | 'auto';
  /** The address a link of the drive is given: where your page that reads it with `<SharedLink>` is. This page with `?link=` unless given. */
  linkAddress?: (token: string) => string;
  className?: string;
}

/** What the preview of a document shows: its title and its first paragraphs. */
export interface DocumentPreview {
  title: string;
  paragraphs: string[];
}

/** Larger documents are not read for a preview: they would cost more than a glance is worth. */
const PREVIEW_LIMIT = 20 * 1024 * 1024;

export function FileDrive({ base, client, headers, language, texts, ...props }: FileDriveProps) {
  // Inside a provider of the application's, the drive is that one's, and so are its client and its language.
  if (useOuterDrive() && !base && !client) return <Screen {...props} />;
  return (
    <DriveProvider base={base} client={client} headers={headers} language={language} texts={texts}>
      <Screen {...props} />
    </DriveProvider>
  );
}

type Section = 'files' | 'recent' | 'shared' | 'trash';
type Dialog = { kind: 'folder' } | { kind: 'rename'; entry: Entry } | { kind: 'move'; entry: Entry } | { kind: 'share'; entry: Entry } | { kind: 'delete'; entry: Entry } | { kind: 'empty' } | null;

/** The type of what is dragged from the drive itself, apart from files dragged in from the computer. */
const DRAGGED = 'application/x-rebofiles-entry';

function Screen({
  title = 'Files',
  logo,
  defaultView = 'list',
  onOpen,
  onOpenDocument,
  previewDocument,
  linkAddress,
  theme = 'light',
  className,
}: Omit<FileDriveProps, keyof Omit<DriveProviderProps, 'children'>>) {
  const { t, client } = useDrive();
  const actions = useActions();
  const { uploads, upload } = useUploads();
  const [section, setSection] = useState<Section>('files');
  const [folder, setFolder] = useState<EntryId | null>(null);
  // Where a folder was opened from: My files, or Shared with me, whose crumb then leads back there.
  const [from, setFrom] = useState<'files' | 'shared'>('files');
  const [selected, setSelected] = useState<EntryId | null>(null);
  const [layout, setLayout] = useState(defaultView);
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [storage, setStorage] = useState('');
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 200);
    return () => clearTimeout(timer);
  }, [typed]);
  useEffect(() => {
    client.info().then(
      (info) => setStorage(info.storage),
      () => setStorage(''),
    );
  }, [client]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const view: View = query ? { section: 'search', query, trashed: section === 'trash' } : section === 'files' ? { section: 'files', folder } : { section };
  const { entries, path, loading, error } = useEntries(view);
  const selectedEntry = entries.find((entry) => entry.id === selected) ?? null;

  const go = (next: Section, to: EntryId | null = null) => {
    if (next === 'shared' || (next === 'files' && to === null)) setFrom(next === 'shared' ? 'shared' : 'files');
    setSection(next);
    setFolder(to);
    setSelected(null);
    setTyped('');
    setQuery('');
  };

  /** Does it, and says what went wrong in the toast rather than in the console. */
  const attempt = useCallback(async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) setToast(done);
    } catch (error) {
      setToast(error instanceof RequestError ? error.message : String(error));
    }
  }, []);

  const open = async (entry: Entry) => {
    if (entry.kind === 'folder') {
      if (section === 'trash') return;
      return go('files', entry.id);
    }
    // A window opened before the address is known, so the browser takes it as the click's.
    const tab = onOpen ? null : window.open('about:blank', '_blank');
    try {
      const url = await actions.url(entry.id, { inline: true });
      if (onOpen) onOpen(entry, url);
      else if (tab) tab.location.href = url;
    } catch (error) {
      tab?.close();
      setToast((error as Error).message);
    }
  };

  const uploadInto = (files: Iterable<File>, parent: EntryId | null) => {
    upload(files, parent, (entry) => {
      setToast(t('uploaded', { name: entry.name }));
      setSelected(entry.id);
    });
  };

  /** What a folder, a crumb or a section does with what is dropped on it: files from the computer go up into it, entries of the drive move into it. */
  const dropTarget = (target: EntryId | null) => ({
    onDragOver: (event: DragEvent) => {
      if (section === 'trash' && target === null) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).classList.add('rf-drop');
    },
    onDragLeave: (event: DragEvent) => (event.currentTarget as HTMLElement).classList.remove('rf-drop'),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).classList.remove('rf-drop');
      setDropping(false);
      const moved = event.dataTransfer.getData(DRAGGED);
      if (moved && moved !== target) void attempt(() => actions.move(moved, target));
      else if (event.dataTransfer.files.length) uploadInto(event.dataTransfer.files, target);
    },
  });

  const sending = uploads.find((u) => u.state === 'sending' || u.state === 'waiting');
  const failed = uploads.find((u) => u.state === 'failed');
  const heading = query ? t('resultsFor', { q: query }) : section === 'recent' ? t('recent') : section === 'shared' ? t('sharedWithMe') : section === 'trash' ? t('trash') : null;

  return (
    <div className={`rf-drive${className ? ` ${className}` : ''}`} data-theme={theme}>
      <style>{CSS}</style>
      <div className="rf-top">
        <div className="rf-title">
          {logo ?? <Logo />}
          <span>{title}</span>
        </div>
        <label className="rf-search">
          <Icon name="search" />
          <span className="rf-sr">{t('search')}</span>
          <input type="search" value={typed} placeholder={t('search')} onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setTyped('')} />
          {typed && (
            <button type="button" aria-label={t('cancel')} onClick={() => setTyped('')}>
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
      </div>

      <div className="rf-body">
        <nav className="rf-side" aria-label={title}>
          <NewMenu onFolder={() => setDialog({ kind: 'folder' })} onUpload={() => fileInput.current?.click()} disabled={section !== 'files' || Boolean(query)} />
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) uploadInto(event.target.files, folder);
              event.target.value = '';
            }}
          />
          <button type="button" className="rf-nav" aria-current={section === 'files' && from === 'files' && !query} onClick={() => go('files')} {...dropTarget(null)}>
            <Icon name="drive" />
            {t('myFiles')}
          </button>
          <button type="button" className="rf-nav" aria-current={(section === 'shared' || (section === 'files' && from === 'shared')) && !query} onClick={() => go('shared')}>
            <Icon name="users" />
            {t('sharedWithMe')}
          </button>
          <button type="button" className="rf-nav" aria-current={section === 'recent' && !query} onClick={() => go('recent')}>
            <Icon name="clock" />
            {t('recent')}
          </button>
          <button
            type="button"
            className="rf-nav"
            aria-current={section === 'trash' && !query}
            onClick={() => go('trash')}
            onDragOver={(event) => event.dataTransfer.types.includes(DRAGGED) && (event.preventDefault(), event.currentTarget.classList.add('rf-drop'))}
            onDragLeave={(event) => event.currentTarget.classList.remove('rf-drop')}
            onDrop={(event) => {
              event.preventDefault();
              event.currentTarget.classList.remove('rf-drop');
              const id = event.dataTransfer.getData(DRAGGED);
              if (id) void attempt(() => actions.moveToTrash(id));
            }}
          >
            <Icon name="trash" />
            {t('trash')}
          </button>
          {storage && (
            <div className="rf-storage">
              {t('location')}
              <code>{storage}</code>
            </div>
          )}
        </nav>

        <main
          className="rf-main"
          onDragOver={(event) => {
            if (section !== 'files' || query || !event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            if (section === 'files' && !query && event.dataTransfer.files.length) uploadInto(event.dataTransfer.files, folder);
          }}
        >
          <div className="rf-head">
            <div className="rf-crumbs">
              {heading ? (
                <h2 className="rf-crumb" style={{ margin: 0 }}>
                  {heading}
                </h2>
              ) : (
                <>
                  {from === 'shared' ? (
                    <button type="button" className="rf-crumb" onClick={() => go('shared')}>
                      {t('sharedWithMe')}
                    </button>
                  ) : (
                    <button type="button" className="rf-crumb" onClick={() => go('files')} {...dropTarget(null)}>
                      {t('myFiles')}
                    </button>
                  )}
                  {path.map((step) => (
                    <span key={step.id} style={{ display: 'contents' }}>
                      <Icon name="chevron" size={16} />
                      <button type="button" className="rf-crumb" aria-current={step.id === folder ? 'page' : undefined} onClick={() => go('files', step.id)} {...dropTarget(step.id)}>
                        {step.name}
                      </button>
                    </span>
                  ))}
                </>
              )}
            </div>
            {section === 'trash' && entries.length > 0 && !query && (
              <button type="button" className="rf-btn rf-danger" onClick={() => setDialog({ kind: 'empty' })}>
                {t('emptyTrash')}
              </button>
            )}
            {/* biome-ignore lint/a11y/useSemanticElements: two buttons that switch one setting, which a fieldset would not say better */}
            <div className="rf-seg" role="group" aria-label={`${t('list')} / ${t('grid')}`}>
              <button type="button" aria-pressed={layout === 'list'} aria-label={t('list')} title={t('list')} onClick={() => setLayout('list')}>
                <Icon name="list" />
              </button>
              <button type="button" aria-pressed={layout === 'grid'} aria-label={t('grid')} title={t('grid')} onClick={() => setLayout('grid')}>
                <Icon name="grid" />
              </button>
            </div>
          </div>

          <Items
            entries={entries}
            layout={layout}
            loading={loading}
            error={error}
            empty={query ? t('noResults') : section === 'trash' ? t('trashIsEmpty') : section === 'recent' ? t('noRecent') : section === 'shared' ? t('noShared') : t('emptyFolder')}
            selected={selected}
            onSelect={setSelected}
            onOpen={open}
            onTrash={(entry) => section !== 'trash' && attempt(() => actions.moveToTrash(entry.id), t('movedToTrash', { name: entry.name }))}
            onRename={(entry) => section !== 'trash' && setDialog({ kind: 'rename', entry })}
            dropTarget={section === 'files' ? dropTarget : undefined}
            draggable={section !== 'trash'}
          />
          {dropping && <div className="rf-dropzone">{t('dropHere')}</div>}
        </main>

        <Details
          entry={selectedEntry}
          inTrash={section === 'trash'}
          onOpen={open}
          onOpenDocument={onOpenDocument}
          previewDocument={previewDocument}
          onDialog={setDialog}
          attempt={attempt}
          onGone={() => setSelected(null)}
        />
      </div>

      {/* Said once a view has loaded: where one is and how much is there. Not the progress of an upload, which would be read out at every step. */}
      <span className="rf-sr" aria-live="polite">
        {loading ? '' : `${heading ?? path.at(-1)?.name ?? t('myFiles')} · ${entries.length === 1 ? t('item') : t('items', { n: entries.length })}`}
      </span>
      <div className="rf-status">
        <span className="rf-grow">
          {entries.length === 1 ? t('item') : t('items', { n: entries.length })}
          {storage && <span className="rf-where"> · {storage}</span>}
        </span>
        {sending ? (
          <>
            <span>{t('uploading', { name: sending.name, pct: Math.round((sending.sent / Math.max(1, sending.size)) * 100) })}</span>
            <span className="rf-bar" role="progressbar" aria-label={sending.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((sending.sent / Math.max(1, sending.size)) * 100)}>
              <span style={{ width: `${(sending.sent / Math.max(1, sending.size)) * 100}%` }} />
            </span>
          </>
        ) : failed ? (
          <span className="rf-error" role="alert">
            {failed.name}: {failed.error}
          </span>
        ) : null}
      </div>

      {toast && (
        <div className="rf-toast" role="status">
          {toast}
        </div>
      )}

      {dialog?.kind === 'folder' && (
        <NameDialog
          title={t('newFolder')}
          label={t('folderName')}
          initial=""
          action={t('create')}
          onClose={() => setDialog(null)}
          onSubmit={(name) => attempt(() => actions.createFolder(name, folder).then((made) => setSelected(made.id)))}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          title={t('rename')}
          label={t('newName')}
          initial={dialog.entry.name}
          action={t('save')}
          onClose={() => setDialog(null)}
          onSubmit={(name) => attempt(() => actions.rename(dialog.entry.id, name))}
        />
      )}
      {dialog?.kind === 'move' && <MoveDialog entry={dialog.entry} onClose={() => setDialog(null)} onMove={(to) => attempt(() => actions.move(dialog.entry.id, to))} />}
      {dialog?.kind === 'share' && <ShareDialog id={dialog.entry.id} name={dialog.entry.name} linkAddress={linkAddress} attempt={attempt} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          text={t('confirmDelete', { name: dialog.entry.name })}
          action={t('deleteForever')}
          onClose={() => setDialog(null)}
          onConfirm={() => attempt(() => actions.deleteForever(dialog.entry.id).then(() => setSelected(null)), t('deleted'))}
        />
      )}
      {dialog?.kind === 'empty' && (
        <ConfirmDialog
          text={t('confirmEmpty')}
          action={t('emptyTrash')}
          onClose={() => setDialog(null)}
          onConfirm={() => attempt(() => actions.emptyTrash().then(() => setSelected(null)), t('deleted'))}
        />
      )}
    </div>
  );
}

function NewMenu({ onFolder, onUpload, disabled }: { onFolder: () => void; onUpload: () => void; disabled: boolean }) {
  const { t } = useDrive();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  /** The arrows go round the items, as a menu's do; Escape gives the focus back to the button, Tab goes on from it. */
  const onKeyDown = (event: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus();
    const close = (event: MouseEvent) => !menu.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const pick = (what: () => void) => () => {
    setOpen(false);
    what();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="rf-new"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => event.key === 'ArrowDown' && (event.preventDefault(), setOpen(true))}
      >
        <Icon name="plus" size={20} />
        {t('upload')}
      </button>
      {open && (
        <div ref={menu} className="rf-menu" role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
          <button type="button" role="menuitem" tabIndex={-1} onClick={pick(onUpload)}>
            <Icon name="upload" />
            {t('uploadFiles')}
          </button>
          <button type="button" role="menuitem" tabIndex={-1} onClick={pick(onFolder)}>
            <Icon name="folderPlus" />
            {t('newFolder')}
          </button>
        </div>
      )}
    </>
  );
}

function Tile({ entry }: { entry: Entry }) {
  const kind = kindOf(entry);
  return (
    <span className={`rf-tile rf-k-${kind}`} aria-hidden="true">
      {kind === 'folder' ? <Icon name="folder" size={16} /> : badgeOf(entry)}
    </span>
  );
}

interface ItemsProps {
  entries: Entry[];
  layout: 'list' | 'grid';
  loading: boolean;
  error: Error | null;
  empty: string;
  selected: EntryId | null;
  onSelect: (id: EntryId | null) => void;
  onOpen: (entry: Entry) => void;
  onTrash: (entry: Entry) => void;
  onRename: (entry: Entry) => void;
  dropTarget?: (target: EntryId | null) => object;
  draggable: boolean;
}

/** The list or the grid: one stop for Tab, the arrows within, Enter to open, Delete for the trash, F2 to rename. */
function Items({ entries, layout, loading, error, empty, selected, onSelect, onOpen, onTrash, onRename, dropTarget, draggable }: ItemsProps) {
  const { t, locale } = useDrive();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const index = entries.findIndex((entry) => entry.id === selected);

  useEffect(() => {
    if (selected) box.current?.querySelector(`[data-id="${CSS_ESCAPE(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent) => {
    const columns = layout === 'grid' ? Math.max(1, Math.floor((box.current?.clientWidth ?? 600) / 162)) : 1;
    const step: Record<string, number> = { ArrowDown: columns, ArrowUp: -columns, ...(layout === 'grid' ? { ArrowRight: 1, ArrowLeft: -1 } : {}) };
    const current = entries[index];
    if (event.key in step) {
      event.preventDefault();
      const next = index < 0 ? 0 : Math.min(entries.length - 1, Math.max(0, index + step[event.key]));
      if (entries[next]) onSelect(entries[next].id);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? entries[0] : entries[entries.length - 1];
      if (next) onSelect(next.id);
    } else if (event.key === 'Enter' && current) {
      event.preventDefault();
      onOpen(current);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && current) {
      event.preventDefault();
      onTrash(current);
    } else if (event.key === 'F2' && current) {
      event.preventDefault();
      onRename(current);
    } else if (event.key === 'Escape') onSelect(null);
  };

  if (error)
    return (
      <div className="rf-empty rf-error" role="alert">
        {error.message}
      </div>
    );
  if (!loading && entries.length === 0)
    return (
      <div className="rf-empty">
        <div>
          <Icon name="folder" size={40} />
          <div>{empty}</div>
        </div>
      </div>
    );

  const item = (entry: Entry) => ({
    key: entry.id,
    id: `${id}-${entry.id}`,
    'data-id': entry.id,
    role: 'option',
    'aria-selected': entry.id === selected,
    onClick: () => onSelect(entry.id),
    onDoubleClick: () => onOpen(entry),
    draggable,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(DRAGGED, entry.id);
      event.dataTransfer.effectAllowed = 'move';
    },
    ...(entry.kind === 'folder' && dropTarget ? dropTarget(entry.id) : {}),
  });

  return (
    <div
      ref={box}
      className="rf-items"
      role="listbox"
      aria-label={t('name')}
      tabIndex={0}
      aria-activedescendant={selected && index >= 0 ? `${id}-${selected}` : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => index < 0 && entries[0] && onSelect(entries[0].id)}
    >
      {layout === 'list' ? (
        <>
          <div className="rf-cols" aria-hidden="true">
            <span>{t('name')}</span>
            <span>{t('owner')}</span>
            <span>{t('modified')}</span>
            <span>{t('size')}</span>
          </div>
          {entries.map((entry) => {
            const { key, ...rest } = item(entry);
            return (
              <div key={key} className="rf-row" {...rest}>
                <span className="rf-name">
                  <Tile entry={entry} />
                  <span>{entry.name}</span>
                </span>
                <span>{entry.owner}</span>
                <span>{formatDate(entry.modified, locale)}</span>
                <span>{entry.kind === 'file' ? formatSize(entry.versions[0].size, locale) : '—'}</span>
              </div>
            );
          })}
        </>
      ) : (
        <div className="rf-grid">
          {entries.map((entry) => {
            const { key, ...rest } = item(entry);
            return (
              <div key={key} className="rf-card" {...rest}>
                <div className={`rf-thumb rf-k-${kindOf(entry)}`}>
                  {kindOf(entry) === 'image' ? <Thumbnail file={entry as FileEntry} /> : <Icon name={entry.kind === 'folder' ? 'folder' : 'doc'} size={34} />}
                </div>
                <div className="rf-name">
                  <Tile entry={entry} />
                  <span>{entry.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A type as a person says it, "Word document"; its media type for a kind the drive does not name. */
const typeName = (file: FileEntry, t: ReturnType<typeof useDrive>['t']): string => {
  const kind = kindOf(file);
  if (kind === 'docx') return t('kindDocx');
  if (kind === 'pdf') return t('kindPdf');
  if (kind === 'sheet') return t('kindSheet');
  if (kind === 'image') return `${t('kindImage')} · ${badgeOf(file)}`;
  if (kind === 'text') return `${t('kindText')} · ${badgeOf(file)}`;
  return file.type;
};

/** An id inside a selector's quotes. */
const CSS_ESCAPE = (text: string) => text.replace(/["\\]/g, '\\$&');

/** An address to show a file in the page, asked once per version. */
function useInlineUrl(file: FileEntry | null) {
  const actions = useActions();
  const [url, setUrl] = useState<string | null>(null);
  const version = file?.versions[0].id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new address only for another file or another version
  useEffect(() => {
    setUrl(null);
    if (!file) return;
    let live = true;
    actions.url(file.id, { inline: true }).then(
      (made) => live && setUrl(made),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [file?.id, version]);
  return url;
}

function Thumbnail({ file }: { file: FileEntry }) {
  const url = useInlineUrl(file);
  return url ? <img src={url} alt="" loading="lazy" /> : <Icon name="doc" size={34} />;
}

function Preview({ file, previewDocument }: { file: FileEntry; previewDocument?: FileDriveProps['previewDocument'] }) {
  const { t } = useDrive();
  const kind = kindOf(file);
  const reads = kind === 'text' || (kind === 'docx' && previewDocument && file.versions[0].size <= PREVIEW_LIMIT);
  const url = useInlineUrl(kind === 'image' || kind === 'pdf' || reads ? file : null);
  const [text, setText] = useState<string | null>(null);
  const [page, setPage] = useState<DocumentPreview | null>(null);
  useEffect(() => {
    setText(null);
    setPage(null);
    if (!url || !reads) return;
    let live = true;
    if (kind === 'docx' && previewDocument) {
      fetch(url)
        .then((answer) => answer.arrayBuffer())
        .then((bytes) => previewDocument(new Uint8Array(bytes)))
        .then(
          (read) => live && setPage(read),
          () => undefined,
        );
    } else {
      // Only the beginning: the first piece that arrives, and the rest is not asked for.
      fetch(url)
        .then(async (answer) => {
          const reader = answer.body?.getReader();
          const first = await reader?.read();
          await reader?.cancel();
          return new TextDecoder().decode(first?.value ?? new Uint8Array()).slice(0, 4096);
        })
        .then(
          (read) => live && setText(read),
          () => undefined,
        );
    }
    return () => {
      live = false;
    };
  }, [kind, url, reads, previewDocument]);
  return (
    <div className="rf-preview">
      {kind === 'image' && url ? (
        <img src={url} alt={file.name} />
      ) : kind === 'pdf' && url ? (
        <iframe src={`${url}#toolbar=0&view=FitH`} title={file.name} />
      ) : kind === 'text' && text !== null ? (
        <pre>{text}</pre>
      ) : page ? (
        <div className="rf-page">
          {page.title && <strong>{page.title}</strong>}
          {page.paragraphs.map((paragraph, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one reading, never put in another order
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <span title={kind === 'other' ? t('noPreview') : undefined}>
          <Tile entry={file} />
        </span>
      )}
    </div>
  );
}

interface DetailsProps {
  entry: Entry | null;
  inTrash: boolean;
  onOpen: (entry: Entry) => void;
  onOpenDocument?: (file: FileEntry, url: string) => void;
  previewDocument?: FileDriveProps['previewDocument'];
  onDialog: (dialog: Dialog) => void;
  attempt: (work: () => Promise<unknown>, done?: string) => Promise<void>;
  onGone: () => void;
}

function Details({ entry: listed, inTrash, onOpen, onOpenDocument, previewDocument, onDialog, attempt, onGone }: DetailsProps) {
  const { t, locale } = useDrive();
  const actions = useActions();
  const found = useEntry(listed?.id ?? null);
  // The entry as the server says it is now, once it has said; as the list had it until then.
  const entry = found && listed && found.entry.id === listed.id ? found.entry : listed;
  const [tab, setTab] = useState<'details' | 'versions'>('details');
  useEffect(() => {
    if (entry?.kind === 'folder') setTab('details');
  }, [entry?.kind]);

  if (!entry)
    return (
      <aside className="rf-details" aria-label={t('details')}>
        <p className="rf-none">{t('nothingSelected')}</p>
      </aside>
    );

  const file = entry.kind === 'file' ? entry : null;
  const where = found && found.entry.id === entry.id ? found.path.map((step) => step.name).join(' / ') || t('top') : '';
  const download = async () => {
    const url = await actions.url(entry.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = entry.name;
    link.click();
  };

  return (
    <aside className="rf-details" aria-label={t('details')}>
      <div className="rf-details-in">
        <h2>{entry.name}</h2>
        {file ? (
          <Preview file={file} previewDocument={previewDocument} />
        ) : (
          <div className="rf-preview">
            <Tile entry={entry} />
          </div>
        )}

        <div className="rf-actions">
          {inTrash ? (
            <>
              <button type="button" className="rf-btn rf-primary" onClick={() => attempt(() => actions.restore(entry.id).then(onGone), t('restored', { name: entry.name }))}>
                <Icon name="restore" size={16} />
                {t('restore')}
              </button>
              <button type="button" className="rf-btn rf-text rf-danger" onClick={() => onDialog({ kind: 'delete', entry })}>
                {t('deleteForever')}
              </button>
            </>
          ) : (
            <>
              {file && onOpenDocument && kindOf(file) === 'docx' && (
                <button type="button" className="rf-btn rf-docs rf-wide" onClick={() => attempt(async () => onOpenDocument(file, await actions.url(file.id, { inline: true })))}>
                  <Icon name="doc" size={16} />
                  {t('openInRebodocs')}
                </button>
              )}
              {file && (
                <button type="button" className="rf-btn" onClick={() => attempt(download)}>
                  <Icon name="download" size={16} />
                  {t('download')}
                </button>
              )}
              <button type="button" className="rf-btn" onClick={() => onOpen(entry)}>
                <Icon name="external" size={16} />
                {t('open')}
              </button>
              <button type="button" className="rf-btn" onClick={() => onDialog({ kind: 'rename', entry })}>
                <Icon name="pencil" size={16} />
                {t('rename')}
              </button>
              <button type="button" className="rf-btn" onClick={() => onDialog({ kind: 'move', entry })}>
                <Icon name="move" size={16} />
                {t('move')}
              </button>
              <button type="button" className="rf-btn" onClick={() => onDialog({ kind: 'share', entry })}>
                <Icon name="users" size={16} />
                {t('share')}
              </button>
              <button type="button" className="rf-btn rf-text rf-danger" onClick={() => attempt(() => actions.moveToTrash(entry.id).then(onGone), t('movedToTrash', { name: entry.name }))}>
                <Icon name="trash" size={16} />
                {t('moveToTrash')}
              </button>
            </>
          )}
        </div>

        {file && (
          <div className="rf-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>
              {t('details')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'versions'} onClick={() => setTab('versions')}>
              {t('versions')} · {file.versions.length}
            </button>
          </div>
        )}

        {tab === 'versions' && file ? (
          <ul className="rf-versions">
            {file.versions.map((version, i) => (
              <li key={version.id} className={i === 0 ? 'rf-now' : undefined}>
                <span className="rf-v">
                  {t('version', { n: versionNumber(file, version.id) })}
                  <small>
                    {formatDate(version.at, locale)} · {version.by} · {formatSize(version.size, locale)}
                    {version.restoredFrom ? ` · ${t('restoredFrom', { n: versionNumber(file, version.restoredFrom) })}` : ''}
                  </small>
                </span>
                {i === 0 ? (
                  <span className="rf-chip">{t('current')}</span>
                ) : (
                  !inTrash && (
                    <button type="button" className="rf-link" onClick={() => attempt(() => actions.restoreVersion(file.id, version.id), t('versionRestored', { n: versionNumber(file, version.id) }))}>
                      {t('restore')}
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        ) : (
          <dl className="rf-props">
            <dt>{t('type')}</dt>
            <dd title={file?.type}>{file ? typeName(file, t) : t('folder')}</dd>
            {file && (
              <>
                <dt>{t('size')}</dt>
                <dd>{formatSize(file.versions[0].size, locale)}</dd>
              </>
            )}
            <dt>{t('owner')}</dt>
            <dd>{entry.owner}</dd>
            {entry.shares?.length ? (
              <>
                <dt>{t('sharedWith')}</dt>
                <dd>{entry.shares.map((s) => `${s.with === EVERYONE ? t('everyone') : s.with} · ${roleName(s.role, t)}`).join(', ')}</dd>
              </>
            ) : null}
            <dt>{t('modified')}</dt>
            <dd>
              {formatDate(entry.modified, locale)} · {entry.modifiedBy}
            </dd>
            {where && (
              <>
                <dt>{t('location')}</dt>
                <dd>{where}</dd>
              </>
            )}
            {file && (
              <>
                <dt>{t('key')}</dt>
                <dd>
                  <code>{file.versions[0].key}</code>
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
    </aside>
  );
}

/** A modal of the browser's own: it keeps the focus inside, Escape closes it, and the focus goes back where it was. */
function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Not closed when the effect is undone: closing says "close", which would take the dialog away when
    // React only runs the effect twice to try it. Taking the element out of the page closes it anyway.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a click on the backdrop closes it, as Escape does from the keyboard
    <dialog ref={ref} className="rf-dialog" aria-label={label} onClose={onClose} onClick={(event) => event.target === ref.current && onClose()}>
      {children}
    </dialog>
  );
}

function NameDialog({ title, label, initial, action, onClose, onSubmit }: { title: string; label: string; initial: string; action: string; onClose: () => void; onSubmit: (name: string) => void }) {
  const { t } = useDrive();
  const [name, setName] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.focus();
    // The name without its extension, as a person most often changes only that.
    const dot = initial.lastIndexOf('.');
    field.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
    onClose();
  };
  return (
    <Modal label={title} onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{title}</h2>
        <input ref={input} type="text" aria-label={label} value={name} onChange={(event) => setName(event.target.value)} />
        <div className="rf-row-end">
          <button type="button" className="rf-btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="rf-btn rf-primary" disabled={!name.trim() || name.trim() === initial}>
            {action}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDialog({ text, action, onClose, onConfirm }: { text: string; action: string; onClose: () => void; onConfirm: () => void }) {
  const { t } = useDrive();
  return (
    <Modal label={action} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
          onClose();
        }}
      >
        <h2>{action}</h2>
        <p style={{ margin: 0 }}>{text}</p>
        <div className="rf-row-end">
          <button type="button" className="rf-btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="rf-btn rf-primary" style={{ background: 'var(--rf-danger)', borderColor: 'var(--rf-danger)' }}>
            {action}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ROLES: Role[] = ['viewer', 'commenter', 'editor'];
const roleName = (role: Role, t: ReturnType<typeof useDrive>['t']) => t(role === 'viewer' ? 'roleViewer' : role === 'commenter' ? 'roleCommenter' : 'roleEditor');
const defaultAddress = (token: string) => `${location.origin}${location.pathname}?link=${encodeURIComponent(token)}`;

/** Who an entry is shared with and as what, and its links: each change made at once, the dialog staying open. */
function ShareDialog({
  id,
  name,
  linkAddress = defaultAddress,
  attempt,
  onClose,
}: {
  id: EntryId;
  name: string;
  linkAddress?: (token: string) => string;
  attempt: (work: () => Promise<unknown>, done?: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t, locale } = useDrive();
  const actions = useActions();
  const found = useEntry(id);
  const entry = found?.entry;
  const [who, setWho] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const label = t('shareTitle', { name });
  const copy = async (token: string) => {
    await navigator.clipboard.writeText(linkAddress(token));
  };
  // Emptied once shared, unless the next one was typed meanwhile.
  const add = (user: string) =>
    attempt(() => actions.share(id, user, role).then(() => setWho((typed) => (typed.trim() === user ? '' : typed))), t('shared', { who: user === EVERYONE ? t('everyone') : user }));
  const roles = (value: Role, onChange: (role: Role) => void, labelled: string) => (
    <select className="rf-select" aria-label={labelled} value={value} onChange={(event) => onChange(event.target.value as Role)}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {roleName(r, t)}
        </option>
      ))}
    </select>
  );
  return (
    <Modal label={label} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (who.trim()) void add(who.trim());
        }}
      >
        <h2>{label}</h2>
        <h3 className="rf-sub">{t('people')}</h3>
        {entry?.shares?.length ? (
          <ul className="rf-shares">
            {entry.shares.map((s) => {
              const person = s.with === EVERYONE ? t('everyone') : s.with;
              return (
                <li key={s.with}>
                  <span className="rf-grow">{person}</span>
                  {roles(s.role, (next) => void attempt(() => actions.share(id, s.with, next)), `${t('role')} · ${person}`)}
                  <button type="button" className="rf-link" aria-label={`${t('remove')} · ${person}`} onClick={() => attempt(() => actions.unshare(id, s.with))}>
                    {t('remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rf-hint">{t('onlyOwner')}</p>
        )}
        <div className="rf-share-add">
          <input type="text" aria-label={t('addPerson')} placeholder={t('addPerson')} value={who} onChange={(event) => setWho(event.target.value)} />
          {roles(role, setRole, t('role'))}
          <button type="submit" className="rf-btn rf-primary" disabled={!who.trim()}>
            {t('share')}
          </button>
        </div>
        {!entry?.shares?.some((s) => s.with === EVERYONE) && (
          <button type="button" className="rf-link" onClick={() => add(EVERYONE)}>
            + {t('everyone')} · {roleName(role, t)}
          </button>
        )}

        <h3 className="rf-sub">{t('links')}</h3>
        {entry?.links?.length ? (
          <ul className="rf-shares">
            {entry.links.map((link) => {
              const until = t('linkUntil', { date: formatDate(link.expires, locale) });
              return (
                <li key={link.id}>
                  <Icon name="link" size={16} />
                  <span className="rf-grow">{until}</span>
                  <button type="button" className="rf-link" aria-label={`${t('copyLink')} · ${until}`} onClick={() => attempt(async () => copy(await actions.linkToken(id, link.id)), t('linkCopied'))}>
                    {t('copyLink')}
                  </button>
                  <button type="button" className="rf-link" aria-label={`${t('remove')} · ${until}`} onClick={() => attempt(() => actions.removeLink(id, link.id))}>
                    {t('remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rf-hint">{t('noLinks')}</p>
        )}
        <button type="button" className="rf-btn" onClick={() => attempt(async () => copy((await actions.createLink(id, 7)).token), t('linkCopied'))}>
          <Icon name="link" size={16} />
          {t('createLink', { n: 7 })}
        </button>

        <div className="rf-row-end">
          <button type="button" className="rf-btn rf-primary" onClick={onClose}>
            {t('done')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Folders to move into, one level at a time, from the top. */
function MoveDialog({ entry, onClose, onMove }: { entry: Entry; onClose: () => void; onMove: (to: EntryId | null) => void }) {
  const { t } = useDrive();
  const [at, setAt] = useState<EntryId | null>(null);
  const { entries, path, loading } = useEntries({ section: 'files', folder: at });
  const folders = useMemo(() => entries.filter((e): e is FolderEntry => e.kind === 'folder'), [entries]);
  const label = t('moveTo', { name: entry.name });
  const list = useRef<HTMLUListElement>(null);
  const here = useRef<HTMLButtonElement>(null);
  const went = useRef(false);
  const goTo = (id: EntryId | null) => {
    went.current = true;
    setAt(id);
  };
  // Gone into a folder, the button pressed is gone too: the focus goes to its first folder, or to "Move here".
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again when the folder shown changes and has loaded, which `at` and `loading` say
  useEffect(() => {
    if (!went.current || loading) return;
    (list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? here.current)?.focus();
  }, [at, loading]);
  return (
    <Modal label={label} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onMove(at);
          onClose();
        }}
      >
        <h2>{label}</h2>
        <div className="rf-crumbs" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="rf-crumb" style={{ fontSize: 14 }} onClick={() => goTo(null)}>
            {t('myFiles')}
          </button>
          {path.map((step) => (
            <span key={step.id} style={{ display: 'contents' }}>
              <Icon name="chevron" size={14} />
              <button type="button" className="rf-crumb" style={{ fontSize: 14 }} onClick={() => goTo(step.id)}>
                {step.name}
              </button>
            </span>
          ))}
        </div>
        <ul ref={list} className="rf-folders">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button type="button" disabled={folder.id === entry.id} onClick={() => goTo(folder.id)}>
                <span className="rf-tile rf-k-folder" aria-hidden="true">
                  <Icon name="folder" size={16} />
                </span>
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="rf-row-end">
          <button type="button" className="rf-btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button ref={here} type="submit" className="rf-btn rf-primary" disabled={at === entry.parent}>
            {t('moveHere')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
