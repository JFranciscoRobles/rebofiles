'use client';

// A drive of another look, made of the hooks of @rebofiles/react and nothing
// of <FileDrive>: a creative app's "Your files", with a rail on the left, big
// cards with the first page or the picture of each file, chips to filter by
// kind, a panel of properties on the right and the uploads in a corner.
// Acme's files of the demo, kept in the page.

import { FOLDER_COLORS, type Activity, type Entry, type EntryId, type FileEntry, type FolderColor, type Role } from '@rebofiles/core';
import { downloadZip } from '@rebofiles/drive';
import { DriveProvider, type Kind, type MemoryClient, type View, createMemoryClient, formatSize, kindOf, useActions, useDrive, useEntries, useEntry, useUploads } from '@rebofiles/react';
import { pictureOfDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { YOU, seed } from '../../../demo/src/seed';

type Place = 'home' | 'files' | 'shared' | 'trash';
type Filter = 'all' | 'folder' | 'image' | 'document' | 'pdf' | 'sheet' | 'media';
type Order = 'modified' | 'name' | 'size' | 'kind';
type Tell = (text: string) => void;
type PanelTab = 'info' | 'versions' | 'activity' | 'share';

const PLACES: { id: Place; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1Z" /> },
  { id: 'files', label: 'Your files', icon: <path d="M3 6a1.5 1.5 0 0 1 1.5-1.5h3.3l1.7 2h6A1.5 1.5 0 0 1 17 8v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15Z" /> },
  { id: 'shared', label: 'Shared with you', icon: <path d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 7c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M13.5 9a2 2 0 1 0 0-4M14 11.6c1.9.4 3.5 2.1 3.5 4.4" /> },
  { id: 'trash', label: 'Deleted', icon: <path d="M4 6h12M8 6V4.5h4V6m-6.5 0 .8 10a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10" /> },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'folder', label: 'Folders' },
  { id: 'image', label: 'Images' },
  { id: 'document', label: 'Documents' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'sheet', label: 'Spreadsheets' },
  { id: 'media', label: 'Video & audio' },
];

const matches = (filter: Filter, kind: Kind) =>
  filter === 'all' || (filter === 'document' ? kind === 'docx' || kind === 'text' : filter === 'media' ? kind === 'video' || kind === 'audio' : kind === filter);

/** The colour of a kind and its letters, as a creative app marks its files. */
const TILES: Record<Kind, [string, string, string]> = {
  folder: ['var(--st-folder-bg)', '#3b63fb', ''],
  docx: ['var(--st-doc-bg)', '#1d5bd6', 'DOC'],
  pdf: ['var(--st-pdf-bg)', '#d7373f', 'PDF'],
  sheet: ['var(--st-sheet-bg)', '#12805c', 'CSV'],
  image: ['var(--st-img-bg)', '#8c4bd6', 'IMG'],
  video: ['var(--st-vid-bg)', '#c45a00', 'VID'],
  audio: ['var(--st-aud-bg)', '#0d7b8c', 'AUD'],
  text: ['var(--st-txt-bg)', '#6e6e6e', 'TXT'],
  other: ['var(--st-txt-bg)', '#6e6e6e', 'FILE'],
};

const COLORS: Record<FolderColor, string> = {
  red: '#e34850',
  orange: '#e68619',
  yellow: '#dfbf00',
  green: '#2d9d78',
  teal: '#0d9aa4',
  blue: '#3b63fb',
  purple: '#9256d9',
  pink: '#d83790',
  gray: '#8e8e8e',
};

const PEOPLE = ['Ana', 'Luis', 'Bea'];

const DONE: Record<Activity['action'], string> = {
  created: 'created it',
  uploaded: 'uploaded it',
  version: 'uploaded a new version',
  renamed: 'renamed it',
  moved: 'moved it',
  trashed: 'deleted it',
  restored: 'restored it',
  deleted: 'deleted it for good',
  shared: 'shared it',
  unshared: 'stopped sharing it',
  linked: 'made a link to it',
  unlinked: 'removed a link to it',
  colored: 'changed its colour',
};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const say = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (minutes < 60) return say.format(-minutes, 'minute');
  if (minutes < 60 * 24) return say.format(-Math.round(minutes / 60), 'hour');
  return say.format(-Math.round(minutes / 60 / 24), 'day');
};
const sizeOf = (entry: Entry) => (entry.kind === 'file' ? entry.versions[0].size : 0);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const DRAGGED = 'application/x-studio-entries';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([type=hidden]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * A dialog or a menu as the keyboard wants it: the focus put in it, kept in it with Tab, Escape to close, and given
 * back on closing to where it was.
 */
function useDialog(box: { current: HTMLElement | null }, onClose: () => void, first = true) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const element = box.current;
    if (first) (element?.querySelector<HTMLElement>(FOCUSABLE) ?? element)?.focus();
    else element?.focus();
    const keep = (event: globalThis.KeyboardEvent) => {
      if (!element) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return close.current();
      }
      if (event.key !== 'Tab') return;
      const all = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === document.activeElement);
      if (!all.length) return event.preventDefault();
      const at = all.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && at <= 0) event.preventDefault(), all[all.length - 1].focus();
      else if (!event.shiftKey && at === all.length - 1) event.preventDefault(), all[0].focus();
    };
    element?.addEventListener('keydown', keep);
    return () => {
      element?.removeEventListener('keydown', keep);
      // Back to where it was, when that is still in the page.
      if (before?.isConnected) before.focus();
    };
  }, [box, first]);
}

const SHORTCUTS: [string, string][] = [
  ['Tab', 'Into the cards, and on to the panel'],
  ['← → ↑ ↓', 'From card to card'],
  ['Shift + arrows', 'Select as you go'],
  ['Space', 'Select or unselect'],
  ['⌘/Ctrl + click, Shift + click', 'Select more'],
  ['⌘/Ctrl + A', 'Select all'],
  ['Enter', 'Open'],
  ['F2', 'Rename'],
  ['Delete', 'Move to Deleted'],
  ['Shift + F10, or the menu key', 'The menu of a card'],
  ['Escape', 'Clear the selection, or close'],
  ['/', 'Search'],
  ['U', 'Upload'],
  ['N', 'New folder'],
  ['← →, in the viewer', 'The file before, the one after'],
  ['?', 'These shortcuts'],
];

export function StudioDrive() {
  const [client, setClient] = useState<MemoryClient | null>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let live = true;
    seed().then(({ drive, blobs }) => live && setClient(createMemoryClient({ drive, blobs, user: YOU, label: 's3://acme-files', top: 'everyone' })));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="studio" data-theme={dark ? 'dark' : 'light'}>
      <style>{CSS}</style>
      {client ? (
        <DriveProvider client={client} language="en">
          <Studio dark={dark} setDark={setDark} />
        </DriveProvider>
      ) : (
        <div className="st-app" />
      )}
    </div>
  );
}

function Studio({ dark, setDark }: { dark: boolean; setDark: (dark: boolean) => void }) {
  const { client } = useDrive();
  const [place, setPlace] = useState<Place>('files');
  const [folder, setFolder] = useState<EntryId | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [order, setOrder] = useState<Order>('modified');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<EntryId[]>([]);
  const [anchor, setAnchor] = useState<EntryId | null>(null);
  const [viewing, setViewing] = useState<EntryId | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null);
  const [moving, setMoving] = useState<EntryId[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [help, setHelp] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const actions = useActions();
  const uploads = useUploads();

  const searching = query.trim() !== '';
  const view: View = searching
    ? { section: 'search', query: query.trim() }
    : place === 'home'
      ? { section: 'recent' }
      : place === 'shared'
        ? { section: 'shared' }
        : place === 'trash'
          ? { section: 'trash' }
          : { section: 'files', folder };
  const { entries, path, loading } = useEntries(view);
  const shown = useMemo(() => {
    const kept = entries.filter((entry) => matches(filter, kindOf(entry)));
    const by =
      order === 'name'
        ? (a: Entry, b: Entry) => a.name.localeCompare(b.name)
        : order === 'size'
          ? (a: Entry, b: Entry) => sizeOf(b) - sizeOf(a)
          : order === 'kind'
            ? (a: Entry, b: Entry) => kindOf(a).localeCompare(kindOf(b)) || a.name.localeCompare(b.name)
            : (a: Entry, b: Entry) => b.modified.localeCompare(a.modified);
    return kept.sort((a, b) => (a.kind === b.kind ? by(a, b) : a.kind === 'folder' ? -1 : 1));
  }, [entries, filter, order]);
  const inTrash = place === 'trash' && !searching;
  const files = shown.filter((entry): entry is FileEntry => entry.kind === 'file');
  // What was selected and is no longer shown is no longer selected.
  const picked = selected.filter((id) => shown.some((entry) => entry.id === id));

  const tell: Tell = (text) => {
    setSaid(text);
    setTimeout(() => setSaid((now) => (now === text ? '' : now)), 3500);
  };
  const go = (to: Place) => {
    setPlace(to);
    setFolder(null);
    setQuery('');
    setSelected([]);
  };
  const into = (id: EntryId | null) => {
    setPlace('files');
    setQuery('');
    setFolder(id);
    setSelected([]);
  };
  const open = (entry: Entry) => {
    if (inTrash) return setSelected([entry.id]);
    if (entry.kind === 'folder') into(entry.id);
    else setViewing(entry.id);
  };
  const pick = (event: MouseEvent | KeyboardEvent, entry: Entry) => {
    if (event.shiftKey && anchor) {
      const from = shown.findIndex((e) => e.id === anchor);
      const to = shown.findIndex((e) => e.id === entry.id);
      const range = shown.slice(Math.min(from, to), Math.max(from, to) + 1).map((e) => e.id);
      return setSelected(range);
    }
    setAnchor(entry.id);
    if (event.metaKey || event.ctrlKey) setSelected(picked.includes(entry.id) ? picked.filter((id) => id !== entry.id) : [...picked, entry.id]);
    else setSelected([entry.id]);
  };
  const send = (list: FileList | null) => {
    if (!list?.length) return;
    const where = place === 'files' && !searching ? folder : null;
    uploads.upload(Array.from(list), where);
    if (place !== 'files' || searching) into(null);
  };
  const newFolder = async () => {
    const names = new Set(entries.map((entry) => entry.name));
    let name = 'Untitled folder';
    for (let n = 2; names.has(name); n++) name = `Untitled folder ${n}`;
    const made = await actions.createFolder(name, folder);
    setSelected([made.id]);
    tell(`Created “${made.name}”`);
    setTimeout(() => document.getElementById('st-name-field')?.focus(), 150);
  };
  const trash = async (ids: EntryId[]) => {
    for (const id of ids) await actions.moveToTrash(id);
    setSelected([]);
    tell(`${plural(ids.length, 'item')} moved to Deleted`);
  };
  const move = async (ids: EntryId[], to: EntryId | null) => {
    let moved = 0;
    for (const id of ids) {
      if (id === to) continue;
      try {
        await actions.move(id, to, 'keep-both');
        moved++;
      } catch (error) {
        tell((error as Error).message);
      }
    }
    if (moved) tell(`${plural(moved, 'item')} moved`);
    setSelected([]);
  };
  const zip = async (ids: EntryId[]) => {
    const name = ids.length === 1 ? (shown.find((e) => e.id === ids[0])?.name ?? 'files') : 'Acme files';
    tell('Making the .zip…');
    const done = await downloadZip(client, ids, { name: name.replace(/\.[^.]+$/, '') });
    tell(`Downloaded ${plural(done.files, 'file')} as a .zip`);
  };
  const download = async (entry: Entry) => {
    if (entry.kind === 'folder') return zip([entry.id]);
    const link = document.createElement('a');
    link.href = await actions.url(entry.id);
    link.download = entry.name;
    link.click();
  };

  // Between the cards with the arrows, as in a grid: up and down by a row.
  const step = (event: KeyboardEvent, entry: Entry) => {
    const cards = [...(app.current?.querySelectorAll<HTMLElement>('.st-card') ?? [])];
    const at = cards.indexOf(event.currentTarget as HTMLElement);
    const columns = Math.max(1, cards.filter((card) => card.offsetTop === cards[0].offsetTop).length);
    const by = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: layout === 'grid' ? columns : 1, ArrowUp: layout === 'grid' ? -columns : -1 }[event.key];
    if (by !== undefined) {
      event.preventDefault();
      const next = cards[Math.min(cards.length - 1, Math.max(0, at + by))];
      next?.focus();
      const id = next?.dataset.id;
      if (id) {
        setAnchor(id);
        setSelected(event.shiftKey ? [...new Set([...picked, id])] : [id]);
      }
      return;
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      const card = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const box = app.current?.getBoundingClientRect();
      if (!picked.includes(entry.id)) setSelected([entry.id]);
      setMenu({ x: card.left + 24 - (box?.left ?? 0), y: card.top + 40 - (box?.top ?? 0), entry });
    } else if (event.key === 'Enter') open(entry);
    else if (event.key === ' ') {
      event.preventDefault();
      pick(event, entry);
    } else if (event.key === 'F2' && !inTrash) {
      event.preventDefault();
      setSelected([entry.id]);
      setTimeout(() => document.getElementById('st-name-field')?.focus(), 100);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !inTrash) {
      event.preventDefault();
      trash(picked.includes(entry.id) ? picked : [entry.id]);
    } else if (event.key === 'a' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setSelected(shown.map((e) => e.id));
    } else if (event.key === 'Escape' && picked.length) {
      event.stopPropagation();
      setSelected([]);
    }
  };
  // The keys of the whole app, where the focus is in it or nowhere; but not where something is being written.
  const onAppKey = (event: globalThis.KeyboardEvent) => {
    const at = event.target as HTMLElement;
    if (at !== document.body && !app.current?.contains(at)) return;
    if (at.closest('input, select, textarea, [role=dialog], [role=menu]') || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === '/') {
      event.preventDefault();
      search.current?.focus();
    } else if (event.key === '?') setHelp(true);
    else if (event.key.toLowerCase() === 'u') picker.current?.click();
    else if (event.key.toLowerCase() === 'n' && place === 'files' && !searching) newFolder();
  };
  const appKey = useRef(onAppKey);
  appKey.current = onAppKey;
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => appKey.current(event);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);
  // The card the Tab key comes to: the last one gone to, else the first.
  const tabStop = shown.some((e) => e.id === anchor) ? anchor : shown[0]?.id;
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    if (event.dataTransfer.types.includes(DRAGGED)) return;
    send(event.dataTransfer.files);
  };
  /** A folder, or a step of the path, that cards may be dropped on to move them there. */
  const target = (to: EntryId | null) => ({
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAGGED)) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).dataset.over = '';
    },
    onDragLeave: (event: DragEvent) => delete (event.currentTarget as HTMLElement).dataset.over,
    onDrop: (event: DragEvent) => {
      const ids = event.dataTransfer.getData(DRAGGED);
      delete (event.currentTarget as HTMLElement).dataset.over;
      if (!ids) return;
      event.preventDefault();
      event.stopPropagation();
      move(JSON.parse(ids), to);
    },
  });
  const onMenu = (event: MouseEvent, entry: Entry) => {
    event.preventDefault();
    const box = app.current?.getBoundingClientRect();
    if (!picked.includes(entry.id)) setSelected([entry.id]);
    setMenu({ x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0), entry });
  };

  const heading = searching ? `Results for “${query.trim()}”` : place === 'files' ? (path.at(-1)?.name ?? 'Your files') : place === 'home' ? 'Recent' : PLACES.find((p) => p.id === place)?.label;
  const one = picked.length === 1 ? picked[0] : null;

  return (
    <div className="st-app" ref={app}>
      <header className="st-top">
        <span className="st-brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect width="26" height="26" rx="6" fill="#3b63fb" />
            <path d="M7 9.5A1.5 1.5 0 0 1 8.5 8h3l1.5 1.7h4.5A1.5 1.5 0 0 1 19 11.2v5.3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 16.5Z" fill="#fff" />
          </svg>
          Studio
        </span>
        <label className="st-search">
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="st-hidden">Search your files, by name and by what is written in them</span>
          <input ref={search} type="search" placeholder="Search by name, or by what is written inside" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="st-icon" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" aria-haspopup="dialog" onClick={() => setHelp(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="16" height="10" rx="2" />
            <path d="M5 8h1M8 8h1M11 8h1M14 8h1M6 12h8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="st-icon" aria-pressed={dark} aria-label="Dark theme" title="Dark theme" onClick={() => setDark(!dark)}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="st-avatar" title="You">
          Y
        </span>
      </header>

      <nav className="st-rail" aria-label="Places">
        <button type="button" className="st-create" onClick={() => picker.current?.click()}>
          <span aria-hidden="true">+</span> Upload
        </button>
        {PLACES.map((p) => (
          <button key={p.id} type="button" className="st-place" aria-current={place === p.id && !searching ? 'page' : undefined} onClick={() => go(p.id)} {...(p.id === 'files' ? target(null) : {})}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
              {p.icon}
            </svg>
            {p.label}
          </button>
        ))}
        <Usage />
      </nav>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: a click on the empty space clears the selection; Escape does from the keyboard */}
      <section
        className={`st-main${dropping ? ' st-dropping' : ''}`}
        aria-label="Files"
        onDragOver={(e) => {
          e.preventDefault();
          if (!e.dataTransfer.types.includes(DRAGGED)) setDropping(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDropping(false)}
        onDrop={onDrop}
        onClick={(e) => e.target === e.currentTarget && setSelected([])}
      >
        <div className="st-head">
          <div>
            {place === 'files' && !searching && path.length > 0 && (
              <nav aria-label="Path" className="st-path">
                <button type="button" onClick={() => into(null)} {...target(null)}>
                  Your files
                </button>
                {path.slice(0, -1).map((f) => (
                  <span key={f.id}>
                    <span aria-hidden="true"> › </span>
                    <button type="button" onClick={() => into(f.id)} {...target(f.id)}>
                      {f.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            <h2>{heading}</h2>
          </div>
          <div className="st-tools">
            {inTrash ? (
              <button type="button" className="st-button" disabled={!entries.length} onClick={() => actions.emptyTrash().then(() => tell('Deleted for good'))}>
                Empty
              </button>
            ) : (
              place === 'files' &&
              !searching && (
                <button type="button" className="st-button" onClick={newFolder}>
                  New folder
                </button>
              )
            )}
            <label className="st-select">
              <span className="st-hidden">Sort by</span>
              <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
                <option value="modified">Last modified</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="kind">Kind</option>
              </select>
            </label>
            <fieldset className="st-toggle">
              <legend className="st-hidden">Layout</legend>
              <button type="button" aria-pressed={layout === 'grid'} aria-label="Grid" onClick={() => setLayout('grid')}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1.5" />
                  <rect x="9" y="1" width="6" height="6" rx="1.5" />
                  <rect x="1" y="9" width="6" height="6" rx="1.5" />
                  <rect x="9" y="9" width="6" height="6" rx="1.5" />
                </svg>
              </button>
              <button type="button" aria-pressed={layout === 'list'} aria-label="List" onClick={() => setLayout('list')}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                  <rect x="1" y="2" width="14" height="2.4" rx="1.2" />
                  <rect x="1" y="6.8" width="14" height="2.4" rx="1.2" />
                  <rect x="1" y="11.6" width="14" height="2.4" rx="1.2" />
                </svg>
              </button>
            </fieldset>
          </div>
        </div>

        {picked.length > 1 ? (
          <div className="st-bulk" role="toolbar" aria-label="Selected items">
            <strong>{plural(picked.length, 'item')} selected</strong>
            {inTrash ? (
              <button type="button" className="st-button" onClick={() => Promise.all(picked.map((id) => actions.restore(id))).then(() => (setSelected([]), tell('Restored')))}>
                Restore
              </button>
            ) : (
              <>
                <button type="button" className="st-button" onClick={() => zip(picked)}>
                  Download .zip
                </button>
                <button type="button" className="st-button" onClick={() => setMoving(picked)}>
                  Move to…
                </button>
                <button type="button" className="st-button st-danger" onClick={() => trash(picked)}>
                  Delete
                </button>
              </>
            )}
            <button type="button" className="st-link" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        ) : (
          <fieldset className="st-chips">
            <legend className="st-hidden">Show</legend>
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </fieldset>
        )}

        {!loading && !shown.length ? (
          <div className="st-empty">
            <p>{inTrash ? 'Nothing deleted.' : searching ? 'No file of that name.' : 'Nothing here yet.'}</p>
            {!inTrash && !searching && <p>Drop files here, or use Upload.</p>}
          </div>
        ) : (
          <ul className={layout === 'grid' ? 'st-grid' : 'st-list'} aria-label={heading} aria-busy={loading}>
            {shown.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="st-card"
                  data-id={entry.id}
                  tabIndex={entry.id === tabStop ? 0 : -1}
                  aria-pressed={picked.includes(entry.id)}
                  draggable={!inTrash}
                  onDragStart={(e) => {
                    const ids = picked.includes(entry.id) ? picked : [entry.id];
                    e.dataTransfer.setData(DRAGGED, JSON.stringify(ids));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(e) => pick(e, entry)}
                  onDoubleClick={() => open(entry)}
                  onKeyDown={(e) => step(e, entry)}
                  onContextMenu={(e) => onMenu(e, entry)}
                  {...(entry.kind === 'folder' && !inTrash ? target(entry.id) : {})}
                >
                  <Thumb entry={entry} />
                  <span className="st-name" title={entry.name}>
                    {entry.name}
                  </span>
                  <span className="st-meta">
                    {entry.kind === 'folder' ? 'Folder' : formatSize(sizeOf(entry), 'en')} · {ago(entry.modified)}
                    {(entry.shares?.length || entry.links?.length) && (
                      <span className="st-shared" title="Shared">
                        {' '}
                        · Shared
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && <Inside query={query.trim()} onOpen={(file) => setViewing(file.id)} />}
        <p className="st-hint">
          Click to select, ⌘ or Shift to select more, double-click to open; drag cards onto a folder to move them, right-click for more. Press <kbd>?</kbd> for the keyboard.
        </p>
      </section>

      {picked.length > 1 ? (
        <aside className="st-props st-props-empty" aria-label="Properties">
          <p>
            {plural(picked.length, 'item')} selected
            <br />
            {formatSize(
              picked.reduce((sum, id) => sum + sizeOf(shown.find((e) => e.id === id) as Entry), 0),
              'en',
            )}
          </p>
        </aside>
      ) : (
        <Properties id={one} inTrash={inTrash} onOpen={open} onClose={() => setSelected([])} onMove={(id) => setMoving([id])} onDownload={download} tell={tell} />
      )}

      <input ref={picker} type="file" multiple hidden onChange={(e) => (send(e.target.files), (e.target.value = ''))} />
      <Uploads {...uploads} />
      {menu && (
        <Menu
          {...menu}
          inTrash={inTrash}
          many={picked.length > 1 ? picked : null}
          onClose={() => setMenu(null)}
          onOpen={open}
          onRename={() => setTimeout(() => document.getElementById('st-name-field')?.focus(), 100)}
          onMove={(ids) => setMoving(ids)}
          onDownload={(ids) => (ids.length > 1 ? zip(ids) : download(menu.entry))}
          onTrash={trash}
          tell={tell}
        />
      )}
      {moving && <MoveTo ids={moving} from={folder} onClose={() => setMoving(null)} onMove={(to) => (move(moving, to), setMoving(null))} />}
      {help && <Shortcuts onClose={() => setHelp(false)} />}
      {viewing && <Viewer files={files} id={viewing} onGo={setViewing} onClose={() => setViewing(null)} onDownload={download} />}
      <div className="st-toast" role="status">
        {said}
      </div>
    </div>
  );
}

/** What a search finds written inside the files, with the words around it. */
function Inside({ query, onOpen }: { query: string; onOpen: (file: FileEntry) => void }) {
  const { client, revision } = useDrive();
  const [found, setFound] = useState<{ entry: FileEntry; snippet: string }[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again after every change
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        client.searchText(query).then(
          (all) => live && setFound(all),
          () => live && setFound([]),
        ),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, query, revision]);
  if (!found.length) return null;
  return (
    <section className="st-inside" aria-label="Found inside files">
      <h3>Found inside files</h3>
      <ul>
        {found.map(({ entry, snippet }) => (
          <li key={entry.id}>
            <button type="button" onClick={() => onOpen(entry)}>
              <span className="st-name">{entry.name}</span>
              <span className="st-meta">…{snippet}…</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a card shows of a file: the picture, the first page of a document, the first lines of a text, a frame of a video. */
type Look = { picture: string } | { text: string; rows?: string[][] } | { video: string } | null;

const looks = new WeakMap<object, Map<string, Promise<Look>>>();

/** Made once for each version of a file, and kept while the page is open. */
function useLook(entry: Entry, size: number): Look {
  const { client } = useDrive();
  const [look, setLook] = useState<Look>(null);
  const kind = kindOf(entry);
  const version = entry.kind === 'file' ? entry.versions[0].id : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: made again for a new version, which `version` says
  useEffect(() => {
    if (entry.kind === 'folder' || entry.versions[0].size > 8 * 1024 * 1024) return setLook(null);
    let kept = looks.get(client);
    if (!kept) looks.set(client, (kept = new Map()));
    const key = `${entry.id}:${version}:${kind}:${size}`;
    let made = kept.get(key);
    if (!made) {
      made = (async (): Promise<Look> => {
        if (kind === 'image') return { picture: await client.url(entry.id, { inline: true, size }) };
        if (kind === 'video') return { video: `${await client.url(entry.id, { inline: true })}#t=0.5` };
        if (kind !== 'docx' && kind !== 'text' && kind !== 'sheet') return null;
        const bytes = await (await fetch(await client.url(entry.id, { inline: true }))).arrayBuffer();
        if (kind === 'docx') return { picture: URL.createObjectURL(await pictureOfDocx(new Uint8Array(bytes), size * 2, 'image/webp', 0.85)) };
        const text = new TextDecoder().decode(bytes.slice(0, 1500));
        if (kind === 'sheet' && /\.(csv|tsv)$/i.test(entry.name))
          return {
            text,
            rows: text
              .split('\n')
              .slice(0, 8)
              .map((line) => line.split(/[,\t]/).slice(0, 4)),
          };
        return kind === 'text' ? { text } : null;
      })().catch(() => null);
      kept.set(key, made);
    }
    let live = true;
    made.then((found) => live && setLook(found));
    return () => {
      live = false;
    };
  }, [client, entry.id, version, kind, size]);
  return look;
}

function Thumb({ entry, big }: { entry: Entry; big?: boolean }) {
  const kind = kindOf(entry);
  const look = useLook(entry, big ? 1024 : 480);
  const [bg, fg, letters] = TILES[kind];
  const className = `st-thumb${big ? ' st-big' : ''}`;
  if (entry.kind === 'folder') {
    const color = entry.color ? COLORS[entry.color] : fg;
    return (
      <span aria-hidden="true" className={className} style={{ background: bg }}>
        <svg width={big ? 84 : 64} height={big ? 66 : 50} viewBox="0 0 64 50" aria-hidden="true">
          <path d="M2 6a4 4 0 0 1 4-4h15l5 6h32a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" fill={color} />
          <path d="M2 14h60v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" fill="#fff" opacity=".25" />
        </svg>
      </span>
    );
  }
  const badge = (
    <span className="st-badge" style={{ background: fg }}>
      {letters}
    </span>
  );
  if (look && 'picture' in look) {
    const placeholder = entry.versions[0].placeholder;
    return (
      <span
        aria-hidden="true"
        className={`${className}${kind === 'docx' ? ' st-page' : ''}`}
        style={{ background: bg, ...(placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' } : {}) }}
      >
        {/* biome-ignore lint/performance/noImgElement: a blob: address of the page, which next/image cannot make smaller */}
        <img src={look.picture} alt="" />
        {kind !== 'image' && badge}
      </span>
    );
  }
  if (look && 'video' in look) {
    return (
      <span aria-hidden="true" className={className} style={{ background: '#111' }}>
        <video src={look.video} muted playsInline preload="metadata" tabIndex={-1} />
        <span className="st-play" aria-hidden="true">
          ▶
        </span>
      </span>
    );
  }
  if (look && 'text' in look) {
    return (
      <span aria-hidden="true" className={`${className} st-page`} style={{ background: bg }}>
        <span className="st-paper" aria-hidden="true">
          {look.rows ? (
            <table>
              <tbody>
                {look.rows.map((row, r) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the first rows of one file, as they are
                  <tr key={r}>
                    {row.map((cell, c) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the cells of one row
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            look.text
          )}
        </span>
        {badge}
      </span>
    );
  }
  if (kind === 'audio') {
    return (
      <span aria-hidden="true" className={className} style={{ background: bg }}>
        <svg width="96" height="40" viewBox="0 0 96 40" aria-hidden="true">
          {[10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 34, 20, 8, 26, 14, 22].map((h, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the bars of one fixed drawing
            <rect key={i} x={i * 6} y={(40 - h) / 2} width="3.5" height={h} rx="1.7" fill={fg} />
          ))}
        </svg>
      </span>
    );
  }
  // A page with lines on it, for a PDF and what has no picture.
  return (
    <span aria-hidden="true" className={`${className} st-page`} style={{ background: bg }}>
      <span className="st-paper st-lines" aria-hidden="true">
        <span style={{ width: '70%', background: fg }} />
        <span />
        <span />
        <span style={{ width: '84%' }} />
        <span />
        <span style={{ width: '60%' }} />
      </span>
      {badge}
    </span>
  );
}

/** The panel on the right: what is selected, and what may be done with it. */
function Properties({
  id,
  inTrash,
  onOpen,
  onClose,
  onMove,
  onDownload,
  tell,
}: {
  id: EntryId | null;
  inTrash: boolean;
  onOpen: (entry: Entry) => void;
  onClose: () => void;
  onMove: (id: EntryId) => void;
  onDownload: (entry: Entry) => void;
  tell: Tell;
}) {
  const found = useEntry(id);
  const actions = useActions();
  const { client, changed } = useDrive();
  const [name, setName] = useState('');
  const [tab, setTab] = useState<PanelTab>('info');
  const entry = found?.entry;
  useEffect(() => setName(entry?.name ?? ''), [entry?.name]);

  if (!entry) {
    return (
      <aside className="st-props st-props-empty" aria-label="Properties">
        <p>Select a file or a folder to see its properties.</p>
      </aside>
    );
  }
  const gone = inTrash || found.trashed;
  const rename = async () => {
    const wanted = name.trim();
    if (!wanted || wanted === entry.name) return setName(entry.name);
    try {
      await actions.rename(entry.id, wanted);
      tell(`Renamed to “${wanted}”`);
    } catch (error) {
      setName(entry.name);
      tell((error as Error).message);
    }
  };
  const paint = async (color: FolderColor | null) => {
    await client.setColor(entry.id, color);
    changed();
  };
  const rows: [string, ReactNode][] = [
    ['Kind', entry.kind === 'folder' ? 'Folder' : entry.type || 'File'],
    ...(entry.kind === 'file' ? ([['Size', formatSize(entry.versions[0].size, 'en')]] as [string, ReactNode][]) : []),
    ['Location', found.path.length ? found.path.map((f) => f.name).join(' / ') : 'Your files'],
    ['Owner', entry.owner],
    ['Modified', `${ago(entry.modified)} by ${entry.modifiedBy}`],
    ['Created', new Date(entry.created).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })],
    ...(entry.kind === 'file' && entry.versions[0].sha256 ? ([['SHA-256', <code key="sha">{entry.versions[0].sha256.slice(0, 16)}…</code>]] as [string, ReactNode][]) : []),
  ];
  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'info', label: 'Info' },
    ...(entry.kind === 'file' ? [{ id: 'versions' as const, label: `Versions (${entry.versions.length})` }] : []),
    { id: 'activity', label: 'Activity' },
    ...(gone ? [] : [{ id: 'share' as const, label: 'Share' }]),
  ];
  const shownTab = tabs.some((t) => t.id === tab) ? tab : 'info';
  return (
    <aside className="st-props" aria-label="Properties">
      <div className="st-props-head">
        <h3>Properties</h3>
        <button type="button" className="st-icon" aria-label="Close properties" onClick={onClose}>
          ×
        </button>
      </div>
      <Thumb entry={entry} big />
      {gone ? (
        <p className="st-title">{entry.name}</p>
      ) : (
        <label className="st-field">
          <span>Name</span>
          <input id="st-name-field" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        </label>
      )}
      <div className="st-tabs" role="tablist" aria-label="About it">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={shownTab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs.find((t) => t.id === shownTab)?.label}>
        {shownTab === 'info' && (
          <>
            <dl className="st-rows">
              {rows.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {entry.kind === 'folder' && !gone && (
              <fieldset className="st-colors">
                <legend>Colour</legend>
                <button type="button" aria-label="No colour" aria-pressed={!entry.color} onClick={() => paint(null)} style={{ background: '#3b63fb' }} />
                {FOLDER_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={color} aria-pressed={entry.color === color} onClick={() => paint(color)} style={{ background: COLORS[color] }} />
                ))}
              </fieldset>
            )}
          </>
        )}
        {shownTab === 'versions' && entry.kind === 'file' && <Versions file={entry} gone={gone} tell={tell} />}
        {shownTab === 'activity' && <History id={entry.id} />}
        {shownTab === 'share' && <Sharing entry={entry} tell={tell} />}
      </div>
      <div className="st-actions">
        {gone ? (
          <>
            <button type="button" className="st-button st-accent" onClick={() => actions.restore(entry.id).then(() => (onClose(), tell(`“${entry.name}” restored`)))}>
              Restore
            </button>
            <button type="button" className="st-button st-danger" onClick={() => actions.deleteForever(entry.id).then(() => (onClose(), tell('Deleted for good')))}>
              Delete forever
            </button>
          </>
        ) : (
          <>
            <button type="button" className="st-button st-accent" onClick={() => onOpen(entry)}>
              Open
            </button>
            <button type="button" className="st-button" onClick={() => onDownload(entry)}>
              {entry.kind === 'folder' ? 'Download .zip' : 'Download'}
            </button>
            <button type="button" className="st-button" onClick={() => onMove(entry.id)}>
              Move
            </button>
            <button type="button" className="st-button st-danger" onClick={() => actions.moveToTrash(entry.id).then(() => (onClose(), tell(`“${entry.name}” moved to Deleted`)))}>
              Delete
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** Every version of a file, the newest first: each to download or to bring back, and a new one to upload. */
function Versions({ file, gone, tell }: { file: FileEntry; gone: boolean; tell: Tell }) {
  const actions = useActions();
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<number | null>(null);
  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    setSending(0);
    try {
      await actions.upload(picked, { file: file.id, onProgress: (p) => setSending(p.sent / Math.max(1, p.size)) });
      tell('New version uploaded');
    } catch (error) {
      tell((error as Error).message);
    } finally {
      setSending(null);
    }
  };
  return (
    <div>
      <ol className="st-versions">
        {file.versions.map((version, i) => (
          <li key={version.id}>
            <span>
              <strong>{i === 0 ? 'Current' : `Version ${file.versions.length - i}`}</strong>
              <span className="st-meta">
                {ago(version.at)} by {version.by} · {formatSize(version.size, 'en')}
                {version.restoredFrom && ' · restored'}
              </span>
            </span>
            {i > 0 && !gone && (
              <button type="button" className="st-link" onClick={() => actions.restoreVersion(file.id, version.id).then(() => tell('Version restored, as a new one'))}>
                Restore
              </button>
            )}
          </li>
        ))}
      </ol>
      {!gone && (
        <>
          <button type="button" className="st-button" disabled={sending !== null} onClick={() => input.current?.click()}>
            {sending === null ? 'Upload a new version' : `Uploading… ${Math.round(sending * 100)}%`}
          </button>
          <input ref={input} type="file" hidden onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ''))} />
        </>
      )}
    </div>
  );
}

/** Who did what to it, and when. */
function History({ id }: { id: EntryId }) {
  const { client, revision } = useDrive();
  const [lines, setLines] = useState<Activity[] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again after every change
  useEffect(() => {
    let live = true;
    client.activity(id, 30).then(
      (found) => live && setLines(found),
      () => live && setLines([]),
    );
    return () => {
      live = false;
    };
  }, [client, id, revision]);
  if (!lines) return null;
  if (!lines.length) return <p className="st-meta st-note">Nothing done to it in this page yet: what is done from now on shows here.</p>;
  return (
    <ol className="st-activity">
      {lines.map((line) => (
        <li key={`${line.at}${line.action}${line.entry}`}>
          <span className="st-who" aria-hidden="true">
            {line.by[0]}
          </span>
          <span>
            <strong>{line.by === YOU ? 'You' : line.by}</strong> {DONE[line.action]}
            {line.action === 'renamed' && line.was ? ` from “${line.was}”` : ''}
            {line.entry !== id ? ` (${line.name})` : ''}
            <span className="st-meta">{ago(line.at)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Who else it is shared with, and its links. */
function Sharing({ entry, tell }: { entry: Entry; tell: Tell }) {
  const actions = useActions();
  const [person, setPerson] = useState(PEOPLE[0]);
  const [role, setRole] = useState<Role>('viewer');
  const [days, setDays] = useState(7);
  const [once, setOnce] = useState(false);
  const shares = entry.shares ?? [];
  const links = entry.links ?? [];
  return (
    <div className="st-share">
      <fieldset>
        <legend>People</legend>
        <div className="st-row">
          <label>
            <span className="st-hidden">Person</span>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {PEOPLE.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="st-hidden">May</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="viewer">Can view</option>
              <option value="commenter">Can comment</option>
              <option value="editor">Can edit</option>
            </select>
          </label>
          <button
            type="button"
            className="st-button st-accent"
            onClick={() =>
              actions.share(entry.id, person, role).then(
                () => tell(`Shared with ${person}`),
                (e: Error) => tell(e.message),
              )
            }
          >
            Share
          </button>
        </div>
        <ul>
          {shares.map((share) => (
            <li key={share.with}>
              <span className="st-who" aria-hidden="true">
                {share.with[0]}
              </span>
              <span>
                {share.with === '*' ? 'Everyone' : share.with}
                <span className="st-meta">{share.role === 'editor' ? 'Can edit' : share.role === 'commenter' ? 'Can comment' : 'Can view'}</span>
              </span>
              <button type="button" className="st-link" onClick={() => actions.unshare(entry.id, share.with).then(() => tell(`No longer shared with ${share.with}`))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset>
        <legend>Links</legend>
        <div className="st-row">
          <label>
            <span className="st-hidden">Good for</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <label className="st-check">
            <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} /> One download
          </label>
          <button
            type="button"
            className="st-button"
            onClick={() =>
              actions.createLink(entry.id, days, { once }).then(
                () => tell('Link made'),
                (e: Error) => tell(e.message),
              )
            }
          >
            Make a link
          </button>
        </div>
        <ul>
          {links.map((link) => (
            <li key={link.id}>
              <span className="st-who" aria-hidden="true">
                ⛓
              </span>
              <span>
                {link.uses === 1 ? 'One download' : 'Anyone with the link'}
                <span className="st-meta">Until {new Date(link.expires).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
              </span>
              <button type="button" className="st-link" onClick={() => actions.removeLink(entry.id, link.id).then(() => tell('Link removed'))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}

/** The menu of a card, where it was right-clicked. */
function Menu({
  x,
  y,
  entry,
  many,
  inTrash,
  onClose,
  onOpen,
  onRename,
  onMove,
  onDownload,
  onTrash,
  tell,
}: {
  x: number;
  y: number;
  entry: Entry;
  many: EntryId[] | null;
  inTrash: boolean;
  onClose: () => void;
  onOpen: (entry: Entry) => void;
  onRename: () => void;
  onMove: (ids: EntryId[]) => void;
  onDownload: (ids: EntryId[]) => void;
  onTrash: (ids: EntryId[]) => void;
  tell: Tell;
}) {
  const actions = useActions();
  const { client, changed } = useDrive();
  const box = useRef<HTMLDivElement>(null);
  const ids = many ?? [entry.id];
  useDialog(box, onClose);
  useEffect(() => {
    const away = (event: Event) => !box.current?.contains(event.target as Node) && onClose();
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [onClose]);
  const item = (label: string, run: () => void, danger?: boolean) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      className={danger ? 'st-danger' : undefined}
      onClick={() => {
        onClose();
        run();
      }}
    >
      {label}
    </button>
  );
  const items = inTrash
    ? [
        item('Restore', () => Promise.all(ids.map((id) => actions.restore(id))).then(() => tell('Restored'))),
        item('Delete forever', () => Promise.all(ids.map((id) => actions.deleteForever(id))).then(() => tell('Deleted for good')), true),
      ]
    : [
        ...(many ? [] : [item('Open', () => onOpen(entry)), item('Rename', onRename)]),
        item(many ? 'Download .zip' : entry.kind === 'folder' ? 'Download .zip' : 'Download', () => onDownload(ids)),
        item('Move to…', () => onMove(ids)),
        ...(!many && entry.kind === 'file' ? [item('Make a link (7 days)', () => actions.createLink(entry.id, 7).then(() => tell('Link made')))] : []),
        item('Delete', () => onTrash(ids), true),
      ];
  return (
    <div
      ref={box}
      className="st-menu"
      role="menu"
      aria-label={many ? `${ids.length} items` : entry.name}
      style={{ left: x, top: y }}
      tabIndex={-1}
      onKeyDown={(event) => {
        const all = [...(box.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])];
        const at = all.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'Tab') onClose();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          all[(at + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]?.focus();
        }
      }}
    >
      {items}
      {!many && !inTrash && entry.kind === 'folder' && (
        // biome-ignore lint/a11y/useSemanticElements: a group of a menu, which ARIA has as a group, not a fieldset
        <div className="st-menu-colors" role="group" aria-label="Colour">
          {FOLDER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="menuitemradio"
              aria-checked={entry.color === color}
              aria-label={color}
              style={{ background: COLORS[color] }}
              onClick={() => {
                onClose();
                client.setColor(entry.id, color).then(changed);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Where to move what is selected: the folders, gone into one at a time. */
function MoveTo({ ids, from, onClose, onMove }: { ids: EntryId[]; from: EntryId | null; onClose: () => void; onMove: (to: EntryId | null) => void }) {
  const [at, setAt] = useState<EntryId | null>(from);
  const { entries, path } = useEntries({ section: 'files', folder: at });
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);
  const folders = entries.filter((entry) => entry.kind === 'folder' && !ids.includes(entry.id));
  return (
    <div className="st-scrim">
      <div className="st-dialog" role="dialog" aria-modal="true" aria-labelledby="st-move-title" ref={box} tabIndex={-1}>
        <h3 id="st-move-title">Move {plural(ids.length, 'item')}</h3>
        <nav aria-label="Where" className="st-path">
          <button type="button" onClick={() => setAt(null)}>
            Your files
          </button>
          {path.map((f) => (
            <span key={f.id}>
              <span aria-hidden="true"> › </span>
              <button type="button" onClick={() => setAt(f.id)}>
                {f.name}
              </button>
            </span>
          ))}
        </nav>
        <ul className="st-folders">
          {folders.length ? (
            folders.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setAt(f.id)}>
                  <svg width="20" height="16" viewBox="0 0 64 50" aria-hidden="true">
                    <path d="M2 6a4 4 0 0 1 4-4h15l5 6h32a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" fill={f.kind === 'folder' && f.color ? COLORS[f.color] : '#3b63fb'} />
                  </svg>
                  {f.name}
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))
          ) : (
            <li className="st-meta st-note">No folders in here.</li>
          )}
        </ul>
        <div className="st-actions">
          <button type="button" className="st-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="st-button st-accent" onClick={() => onMove(at)}>
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

/** The keys of the app, all of them. */
function Shortcuts({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the scrim closes on a click; Escape closes it from the keyboard
    // biome-ignore lint/a11y/noStaticElementInteractions: the same: a click outside the dialog
    <div className="st-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="st-dialog" role="dialog" aria-modal="true" aria-labelledby="st-keys-title" ref={box} tabIndex={-1}>
        <div className="st-props-head">
          <h3 id="st-keys-title">Keyboard shortcuts</h3>
          <button type="button" className="st-icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <dl className="st-keys">
          {SHORTCUTS.map(([keys, does]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** How much of the drive is used, under the places. */
function Usage() {
  const { client, revision } = useDrive();
  const [used, setUsed] = useState<{ used: number; quota: number | null } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again after every change
  useEffect(() => {
    client.usage().then(setUsed, () => undefined);
  }, [client, revision]);
  if (!used) return null;
  const quota = used.quota ?? 2 * 1000 ** 3;
  return (
    <div className="st-usage">
      <div className="st-bar" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={used.used}>
        <span style={{ width: `${Math.max(2, (used.used / quota) * 100)}%` }} />
      </div>
      {formatSize(used.used, 'en')} of {formatSize(quota, 'en')} used
    </div>
  );
}

/** The uploads, in a card in the corner, each with its bar and the time it has left. */
function Uploads({ uploads, summary, clear, stop, retry, stopAll }: ReturnType<typeof useUploads>) {
  const [folded, setFolded] = useState(false);
  if (!uploads.length) return null;
  const going = summary.sending + summary.waiting;
  const left = summary.speed ? Math.ceil((summary.size - summary.sent) / summary.speed) : undefined;
  return (
    <section className="st-uploads" aria-label="Uploads">
      <div className="st-uploads-head">
        <strong>
          {going ? `Uploading ${plural(going, 'item')}` : `${summary.done} uploaded`}
          {going > 0 && left !== undefined && <span className="st-left"> · {left}s left</span>}
        </strong>
        {going > 0 && (
          <button type="button" className="st-link st-light" onClick={stopAll}>
            Stop all
          </button>
        )}
        <button type="button" className="st-icon" aria-expanded={!folded} aria-label={folded ? 'Show uploads' : 'Hide uploads'} onClick={() => setFolded(!folded)}>
          {folded ? '▴' : '▾'}
        </button>
        {!going && (
          <button type="button" className="st-icon" aria-label="Close uploads" onClick={clear}>
            ×
          </button>
        )}
      </div>
      {!folded && (
        <ul>
          {uploads.map((item) => (
            <li key={item.id}>
              <span className="st-name">{item.name}</span>
              <span className="st-meta">
                {item.state === 'done'
                  ? 'Done'
                  : item.state === 'failed'
                    ? (item.error ?? 'Failed')
                    : item.state === 'sending'
                      ? `${Math.round((item.sent / Math.max(1, item.size)) * 100)}%${item.remaining !== undefined ? ` · ${Math.ceil(item.remaining)}s left` : ''}`
                      : item.state === 'stopped'
                        ? 'Stopped'
                        : 'Waiting'}
              </span>
              <span className="st-bar" aria-hidden="true">
                <span style={{ width: `${(item.sent / Math.max(1, item.size)) * 100}%`, background: item.state === 'failed' ? '#d7373f' : undefined }} />
              </span>
              {item.state === 'sending' && (
                <button type="button" className="st-link" onClick={() => stop(item.id)}>
                  Stop
                </button>
              )}
              {(item.state === 'failed' || item.state === 'stopped') && (
                <button type="button" className="st-link" onClick={() => retry(item.id)}>
                  Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The rows of a CSV or a TSV, quotes and all, as many as are shown. */
function rowsOf(text: string, separator: string, limit = 500): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < limit; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === separator) row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

/**
 * A file opened over the app, as a creative suite opens one: a bar with what it is and what to do with it, the file
 * as large as it goes, the ones beside it an arrow away, and all of them in a strip below. A picture, a PDF, a Word
 * document in its pages by Rebodocs, a table, a text, a video or a sound.
 */
function Viewer({ files, id, onGo, onClose, onDownload }: { files: FileEntry[]; id: EntryId; onGo: (id: EntryId) => void; onClose: () => void; onDownload: (entry: Entry) => void }) {
  const { client } = useDrive();
  const file = files.find((f) => f.id === id);
  const at = files.findIndex((f) => f.id === id);
  const [url, setUrl] = useState<string>();
  const [text, setText] = useState<string>();
  const [zoomed, setZoomed] = useState(false);
  const [document_, setDocument] = useState<{ print?: () => void } | null>(null);
  const kind = file ? kindOf(file) : 'other';
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useDialog(box, onClose, false);
  const version = file?.versions[0].id;
  const table = file && kind === 'sheet' && /\.(csv|tsv)$/i.test(file.name) ? (/\.tsv$/i.test(file.name) ? '\t' : ',') : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new address for a new file or version
  useEffect(() => {
    if (!file) return;
    let live = true;
    let destroy: (() => void) | undefined;
    setUrl(undefined);
    setText(undefined);
    setZoomed(false);
    setDocument(null);
    client.url(file.id, { inline: true }).then(async (address) => {
      if (!live) return;
      setUrl(address);
      if (kind === 'text' || table) {
        const read = await (await fetch(address)).text();
        if (live) setText(read.slice(0, 200_000));
      }
      if (kind === 'docx' && page.current) {
        const bytes = new Uint8Array(await (await fetch(address)).arrayBuffer());
        if (!live || !page.current) return;
        const view = await viewDocx(page.current, bytes, { language: 'en' });
        if (live) {
          destroy = view.destroy;
          setDocument(view);
        } else view.destroy();
      }
    });
    // The one shown, in sight in the strip.
    strip.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return () => {
      live = false;
      destroy?.();
      if (page.current) page.current.innerHTML = '';
    };
  }, [client, id, version, kind]);
  if (!file) return null;
  const go = (by: number) => files.length > 1 && onGo(files[(at + by + files.length) % files.length].id);
  const [, fg, letters] = TILES[kind];
  const rows = table && text !== undefined ? rowsOf(text, table) : null;
  const tool = (label: string, path: ReactNode, run: () => void) => (
    <button type="button" className="st-icon st-light" aria-label={label} title={label} onClick={run}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </button>
  );
  return (
    <div
      className="st-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
      ref={box}
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('.st-docx, video, audio, .st-code, .st-table, iframe, .st-strip')) return;
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="st-viewer-head">
        {tool('Back to the files', <path d="m15 18-6-6 6-6" />, onClose)}
        <span className="st-kind" style={{ background: fg }} aria-hidden="true">
          {letters}
        </span>
        <span className="st-viewer-title">
          <strong>{file.name}</strong>
          <span>
            {formatSize(file.versions[0].size, 'en')} · {ago(file.modified)} by {file.modifiedBy}
          </span>
        </span>
        {files.length > 1 && (
          <span className="st-count" aria-live="polite">
            {at + 1} of {files.length}
          </span>
        )}
        {kind === 'docx' && document_?.print
          ? tool('Print', <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />, () => document_.print?.())
          : url && tool('Open in a new tab', <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />, () => window.open(url, '_blank', 'noopener'))}
        <button type="button" className="st-button st-accent" onClick={() => onDownload(file)}>
          Download
        </button>
        {tool('Close', <path d="M18 6 6 18M6 6l12 12" />, onClose)}
      </div>
      <div className="st-viewer-body">
        {files.length > 1 && (
          <button type="button" className="st-nav st-prev" aria-label="Previous file" title="Previous file (←)" onClick={() => go(-1)}>
            ‹
          </button>
        )}
        <div ref={page} className={kind === 'docx' ? 'st-docx' : 'st-hidden'} />
        {!url || kind === 'docx' ? (
          kind !== 'docx' && <p className="st-wait">Opening…</p>
        ) : kind === 'image' ? (
          <button
            type="button"
            className={`st-picture${zoomed ? ' st-zoomed' : ''}`}
            aria-label={zoomed ? 'Fit to the screen' : 'Show at full size'}
            aria-pressed={zoomed}
            onClick={() => setZoomed(!zoomed)}
            style={file.versions[0].placeholder ? { backgroundImage: `url(${file.versions[0].placeholder})` } : undefined}
          >
            {/* biome-ignore lint/performance/noImgElement: a blob: address of the page, which next/image cannot make smaller */}
            <img src={url} alt={file.name} />
          </button>
        ) : kind === 'pdf' ? (
          <iframe src={`${url}#view=FitH`} title={file.name} />
        ) : kind === 'video' ? (
          // biome-ignore lint/a11y/useMediaCaption: a file of the person's own, which comes with no captions
          <video src={url} controls autoPlay />
        ) : kind === 'audio' ? (
          <div className="st-sound">
            <Thumb entry={file} big />
            {/* biome-ignore lint/a11y/useMediaCaption: a file of the person's own, which comes with no captions */}
            <audio src={url} controls autoPlay />
          </div>
        ) : rows ? (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls, and a keyboard has to reach what is hidden (WCAG 2.1.1)
          <section className="st-table" tabIndex={0} aria-label={`${file.name}, as a table`}>
            <table>
              <thead>
                <tr>
                  {rows[0]?.map((cell, c) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the columns of one file, as they are
                    <th key={c}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, r) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the rows of one file, as they are
                  <tr key={r}>
                    {row.map((cell, c) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the cells of one row
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : text !== undefined ? (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls, and a keyboard has to reach what is hidden (WCAG 2.1.1)
          <section className="st-code" tabIndex={0} aria-label={file.name}>
            <pre>{text}</pre>
          </section>
        ) : kind === 'text' || table ? (
          <p className="st-wait">Opening…</p>
        ) : (
          <div className="st-sound">
            <Thumb entry={file} big />
            <p>
              There is no preview of {file.name}.{' '}
              <button type="button" className="st-link" onClick={() => onDownload(file)}>
                Download it
              </button>
            </p>
          </div>
        )}
        {files.length > 1 && (
          <button type="button" className="st-nav st-next" aria-label="Next file" title="Next file (→)" onClick={() => go(1)}>
            ›
          </button>
        )}
      </div>
      {files.length > 1 && (
        <div className="st-strip" ref={strip} role="toolbar" aria-label="Files in this folder" aria-orientation="horizontal">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              title={f.name}
              aria-current={f.id === id ? 'true' : undefined}
              tabIndex={f.id === id ? 0 : -1}
              onClick={() => onGo(f.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const next = files[(at + (e.key === 'ArrowRight' ? 1 : -1) + files.length) % files.length];
                onGo(next.id);
                requestAnimationFrame(() => strip.current?.querySelector<HTMLElement>('[aria-current]')?.focus());
              }}
            >
              <Thumb entry={f} />
              <span className="st-hidden">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Its own look, as a design system of a creative suite has it: greys, one blue, corners of 8px; and its dark theme.
const CSS = `
.studio{--st-bg:#f5f5f5;--st-panel:#fff;--st-line:#e1e1e1;--st-ink:#222;--st-soft:#6e6e6e;--st-hover:#f0f0f0;--st-field:#fff;--st-edge:#d0d0d0;--st-blue:#3b63fb;--st-blue-hover:#274dea;--st-fill:#3b63fb;--st-fill-hover:#274dea;--st-blue-tint:#e8eefc;--st-blue-ink:#1d3fbf;--st-red:#b40000;
  --st-folder-bg:#e8eefc;--st-doc-bg:#e5efff;--st-pdf-bg:#ffe9e6;--st-sheet-bg:#e3f6ea;--st-img-bg:#f3e9ff;--st-vid-bg:#fff0e0;--st-aud-bg:#e6f6f8;--st-txt-bg:#efefef;--st-paper:#fff;
  font:14px/1.45 "Source Sans 3",var(--font-inter),system-ui,sans-serif;color:var(--st-ink);height:100%}
.studio[data-theme=dark]{--st-bg:#1d1d1d;--st-panel:#252525;--st-line:#3a3a3a;--st-ink:#ebebeb;--st-soft:#a8a8a8;--st-hover:#323232;--st-field:#1d1d1d;--st-edge:#4a4a4a;--st-blue:#5b7dff;--st-blue-hover:#7a95ff;--st-blue-tint:#26335c;--st-blue-ink:#c4d1ff;--st-red:#ff8a80;
  --st-folder-bg:#26335c;--st-doc-bg:#1f2d47;--st-pdf-bg:#46262a;--st-sheet-bg:#1f3a2e;--st-img-bg:#382a4d;--st-vid-bg:#47331e;--st-aud-bg:#1d3c40;--st-txt-bg:#333;--st-paper:#f4f4f4;color-scheme:dark}
.studio *{box-sizing:border-box}
.st-app{position:relative;height:100%;display:grid;grid-template-columns:220px 1fr 300px;grid-template-rows:56px 1fr;background:var(--st-bg);border:1px solid var(--st-line);border-radius:14px;overflow:hidden}
.st-top{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--st-panel);border-bottom:1px solid var(--st-line)}
.st-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;width:188px}
.st-search{flex:1;max-width:560px;margin:0 auto;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:18px;background:var(--st-hover);color:var(--st-soft);border:1px solid transparent}
.st-search:focus-within{border-color:var(--st-blue);background:var(--st-field)}
.st-search input{flex:1;border:0;background:none;font:inherit;color:var(--st-ink);outline:none;min-width:0}
.st-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#ffd6a5;color:#7a3e00;font-weight:700}
.st-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.st-rail{display:flex;flex-direction:column;gap:2px;padding:16px 12px;background:var(--st-panel);border-right:1px solid var(--st-line)}
.st-create{display:flex;align-items:center;justify-content:center;gap:8px;height:40px;margin-bottom:14px;border:0;border-radius:20px;background:var(--st-fill);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.st-create:hover{background:var(--st-fill-hover)}
.st-create span{font-size:20px;line-height:1}
.st-place{display:flex;align-items:center;gap:12px;height:38px;padding:0 12px;border:0;border-radius:8px;background:none;color:var(--st-ink);font:inherit;text-align:left;cursor:pointer}
.st-place:hover{background:var(--st-hover)}
.st-place[aria-current]{background:var(--st-blue-tint);color:var(--st-blue-ink);font-weight:700}
.studio [data-over]{outline:2px solid var(--st-blue);outline-offset:-2px;background:var(--st-blue-tint)}
.st-usage{margin-top:auto;padding:12px;font-size:12.5px;color:var(--st-soft)}
.st-bar{display:block;height:4px;border-radius:2px;background:var(--st-line);overflow:hidden;margin-bottom:6px}
.st-bar>span{display:block;height:100%;background:var(--st-blue);border-radius:2px;transition:width .2s}
.st-main{position:relative;overflow:auto;padding:22px 26px 16px}
.st-dropping{outline:2px dashed var(--st-blue);outline-offset:-10px;background:var(--st-blue-tint)}
.st-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.st-head h2{margin:0;font-size:26px;font-weight:800;letter-spacing:-.01em}
.st-path{font-size:13px;color:var(--st-soft);margin-bottom:2px}
.st-path button{border:0;background:none;padding:2px 4px;margin:0 -4px;border-radius:4px;font:inherit;color:inherit;cursor:pointer}
.st-path button:hover{color:var(--st-blue);text-decoration:underline}
.st-tools{display:flex;align-items:center;gap:8px}
.st-button{height:32px;padding:0 14px;border:2px solid var(--st-edge);border-radius:16px;background:var(--st-panel);color:var(--st-ink);font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}
.st-button:hover:not(:disabled){border-color:var(--st-soft);background:var(--st-hover)}
.st-button:disabled{opacity:.45;cursor:default}
.st-accent{background:var(--st-fill);border-color:var(--st-fill);color:#fff}
.st-accent:hover:not(:disabled){background:var(--st-fill-hover);border-color:var(--st-fill-hover)}
.st-danger{color:var(--st-red)!important}
.st-dark{background:#333;border-color:#555;color:#fff}
.st-dark:hover:not(:disabled){background:#444;border-color:#777}
.studio select{height:32px;padding:0 10px;border:1px solid var(--st-edge);border-radius:8px;background:var(--st-field);font:inherit;color:var(--st-ink)}
.st-toggle{display:flex;margin:0;padding:0;border:1px solid var(--st-edge);border-radius:8px;overflow:hidden}
.st-toggle button{width:34px;height:30px;border:0;background:var(--st-field);color:var(--st-soft);cursor:pointer;display:grid;place-items:center}
.st-toggle button[aria-pressed=true]{background:var(--st-blue-tint);color:var(--st-blue-ink)}
.st-chips{border:0;padding:0;display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 18px}
.st-chips button{height:30px;padding:0 14px;border:1px solid var(--st-edge);border-radius:15px;background:var(--st-panel);font:inherit;color:var(--st-ink);cursor:pointer}
.st-chips button[aria-pressed=true]{background:var(--st-ink);border-color:var(--st-ink);color:var(--st-panel)}
.st-bulk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 18px;padding:6px 8px 6px 16px;min-height:44px;border-radius:22px;background:var(--st-blue-tint);color:var(--st-blue-ink)}
.st-bulk strong{margin-right:auto}
.st-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:16px}
.st-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.st-card{width:100%;display:grid;gap:2px;padding:8px 8px 10px;border:2px solid transparent;border-radius:10px;background:var(--st-panel);text-align:left;font:inherit;color:inherit;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.st-card:hover{box-shadow:0 4px 14px rgba(0,0,0,.14)}
.st-card[aria-pressed=true]{border-color:var(--st-blue);background:var(--st-blue-tint)}
.st-card[aria-pressed=true] .st-meta{color:var(--st-blue-ink)}
.studio button:focus-visible,.studio input:focus-visible,.studio select:focus-visible{outline:2px solid var(--st-blue);outline-offset:2px}
.st-list .st-card{grid-template-columns:44px 1fr auto;align-items:center;gap:12px;padding:6px 10px}
.st-list .st-thumb{height:36px;margin:0;border-radius:6px}
.st-list .st-thumb svg{width:26px;height:20px}
.st-list .st-badge,.st-list .st-play{display:none}
.st-list .st-paper{inset:4px 6px 0;font-size:3px;padding:2px}
.st-thumb{display:grid;place-items:center;height:124px;margin-bottom:8px;border-radius:7px;overflow:hidden;position:relative}
.st-thumb img,.st-thumb video{width:100%;height:100%;object-fit:cover;position:relative}
.st-page img{position:absolute;left:12%;top:12%;width:76%;height:auto;min-height:100%;object-fit:cover;object-position:top;border-radius:3px 3px 0 0;box-shadow:0 2px 8px rgba(0,0,0,.16)}
.st-paper{position:absolute;left:12%;right:12%;top:12%;bottom:0;padding:9px 10px;background:var(--st-paper);color:#333;border-radius:3px 3px 0 0;box-shadow:0 2px 8px rgba(0,0,0,.16);font:7px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow:hidden;text-align:left}
.st-paper table{border-collapse:collapse;width:100%;font:7px/1.3 system-ui,sans-serif}
.st-paper td{border:1px solid #d8d8d8;padding:2px 3px;white-space:nowrap;overflow:hidden;max-width:40px}
.st-paper tr:first-child td{background:#e3f6ea;font-weight:700}
.st-lines{display:grid;align-content:start;gap:7px;padding-top:14px}
.st-lines span{display:block;height:5px;width:100%;border-radius:3px;background:#e4e4e4}
.st-lines span:first-child{height:7px}
.st-big .st-paper{font-size:9px}
.st-badge{position:absolute;left:8px;bottom:8px;padding:2px 6px;border-radius:4px;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.05em}
.st-play{position:absolute;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.55);color:#fff;font-size:14px;padding-left:3px}
.st-big{height:180px;margin:4px 0 14px}
.st-name{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-meta{display:block;font-size:12.5px;color:var(--st-soft)}
.st-shared{color:var(--st-blue-ink)}
.st-note{margin:12px 0}
.st-empty{display:grid;place-items:center;align-content:center;min-height:240px;border:2px dashed var(--st-edge);border-radius:12px;color:var(--st-soft)}
.st-empty p{margin:2px}
.st-inside{margin-top:22px}
.st-inside h3{margin:0 0 8px;font-size:15px}
.st-inside ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.st-inside button{width:100%;text-align:left;padding:10px 12px;border:1px solid var(--st-line);border-radius:8px;background:var(--st-panel);font:inherit;color:inherit;cursor:pointer}
.st-inside button:hover{border-color:var(--st-blue)}
.st-hint{margin:18px 0 0;font-size:12.5px;color:var(--st-soft)}
.st-props{overflow:auto;padding:16px 18px;background:var(--st-panel);border-left:1px solid var(--st-line)}
.st-props-empty{display:grid;place-items:center;text-align:center;color:var(--st-soft)}
.st-props-head{display:flex;align-items:center;justify-content:space-between}
.st-props-head h3{margin:0;font-size:15px}
.st-icon{width:30px;height:30px;flex:none;border:0;border-radius:6px;background:none;color:var(--st-soft);font-size:20px;line-height:1;cursor:pointer;display:grid;place-items:center}
.st-icon:hover,.st-icon[aria-pressed=true]{background:var(--st-hover);color:var(--st-ink)}
.st-title{margin:0 0 8px;font-weight:700;word-break:break-word}
.st-field{display:grid;gap:4px;font-size:12.5px;color:var(--st-soft)}
.st-field input{height:34px;padding:0 10px;border:1px solid var(--st-edge);border-radius:6px;background:var(--st-field);font:inherit;font-size:14px;color:var(--st-ink)}
.st-field input:focus{outline:none;border-color:var(--st-blue);box-shadow:0 0 0 1px var(--st-blue)}
.st-tabs{display:flex;gap:2px;margin:14px 0 4px;border-bottom:1px solid var(--st-line)}
.st-tabs button{padding:7px 8px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;font:inherit;font-size:13px;color:var(--st-soft);cursor:pointer;white-space:nowrap}
.st-tabs button[aria-selected=true]{color:var(--st-ink);border-color:var(--st-ink);font-weight:700}
.st-rows{margin:12px 0 0;display:grid;gap:8px}
.st-rows div{display:grid;grid-template-columns:78px 1fr;gap:8px;font-size:13px}
.st-rows dt{color:var(--st-soft)}
.st-rows dd{margin:0;word-break:break-word}
.st-rows code{font-size:11.5px}
.st-colors{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0;border:0}
.st-colors legend{font-size:12.5px;color:var(--st-soft);margin-bottom:6px;padding:0}
.st-colors button,.st-menu-colors button{width:22px;height:22px;border-radius:50%;border:2px solid var(--st-panel);box-shadow:0 0 0 1px var(--st-edge);cursor:pointer;padding:0}
.st-colors button[aria-pressed=true],.st-menu-colors button[aria-checked=true]{box-shadow:0 0 0 2px var(--st-ink)}
.st-versions,.st-activity,.st-share ul,.st-folders{list-style:none;margin:12px 0;padding:0;display:grid;gap:10px}
.st-versions li,.st-share li{display:flex;align-items:center;gap:10px;justify-content:space-between;font-size:13px}
.st-activity li{display:flex;gap:10px;font-size:13px}
.st-who{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--st-blue-tint);color:var(--st-blue-ink);font-weight:700;font-size:12px}
.st-share li>span:nth-child(2){flex:1}
.st-share fieldset{border:0;padding:0;margin:12px 0 0}
.st-share legend{font-size:12.5px;color:var(--st-soft);padding:0;margin-bottom:6px}
.st-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.st-check{display:flex;align-items:center;gap:4px;font-size:13px}
.st-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.st-link{border:0;background:none;color:var(--st-blue);font:inherit;font-weight:700;cursor:pointer;padding:2px 4px}
.st-menu{position:absolute;z-index:9;min-width:200px;padding:6px;border-radius:10px;background:var(--st-panel);border:1px solid var(--st-line);box-shadow:0 12px 32px rgba(0,0,0,.2);display:grid;outline:none}
.st-menu [role=menuitem]{text-align:left;height:32px;padding:0 12px;border:0;border-radius:6px;background:none;font:inherit;color:var(--st-ink);cursor:pointer}
.st-menu [role=menuitem]:hover,.st-menu [role=menuitem]:focus-visible{background:var(--st-hover);outline:none}
.st-menu-colors{display:flex;gap:5px;padding:8px 10px 4px;border-top:1px solid var(--st-line);margin-top:4px}
.st-menu-colors button{width:18px;height:18px}
.st-scrim{position:absolute;inset:0;z-index:9;display:grid;place-items:center;background:rgba(0,0,0,.35)}
.st-dialog{width:420px;max-width:calc(100% - 32px);padding:20px 22px;border-radius:12px;background:var(--st-panel);box-shadow:0 20px 50px rgba(0,0,0,.3);outline:none}
.st-dialog h3{margin:0 0 10px;font-size:18px}
.st-folders{max-height:240px;overflow:auto;gap:2px;border:1px solid var(--st-line);border-radius:8px;padding:4px}
.st-folders button{width:100%;display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border:0;border-radius:6px;background:none;font:inherit;color:var(--st-ink);cursor:pointer;text-align:left}
.st-folders button span{margin-left:auto;color:var(--st-soft)}
.st-folders button:hover{background:var(--st-hover)}
.st-folders .st-note{padding:8px 10px;margin:0}
.st-dialog .st-actions{justify-content:flex-end}
.st-uploads{position:absolute;right:16px;bottom:16px;z-index:5;width:330px;background:var(--st-panel);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);overflow:hidden}
.st-uploads-head{display:flex;align-items:center;gap:4px;padding:8px 8px 8px 14px;background:#2c2c2c;color:#fff}
.st-uploads-head strong{flex:1}
.st-left{font-weight:400;color:#ccc}
.st-uploads-head .st-icon{color:#ddd}
.st-uploads-head .st-icon:hover{background:#444;color:#fff}
.st-uploads ul{list-style:none;margin:0;padding:8px 14px;max-height:200px;overflow:auto;display:grid;gap:10px}
.st-uploads li{display:grid;grid-template-columns:1fr auto;column-gap:8px}
.st-uploads li .st-bar{grid-column:1/-1;margin:4px 0 0}
.st-uploads li .st-link{grid-column:2;grid-row:1}
.st-light{color:#ddd!important}
.st-viewer{position:absolute;inset:0;z-index:8;display:grid;grid-template-rows:60px minmax(0,1fr) auto;background:#161616;color:#fff;outline:none}
.st-viewer-head{display:flex;align-items:center;gap:10px;padding:0 12px;background:#1f1f1f;border-bottom:1px solid #2e2e2e}
.st-kind{flex:none;padding:3px 7px;border-radius:5px;color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em}
.st-viewer-title{flex:1;min-width:0;display:grid}
.st-viewer-title strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-viewer-title span{font-size:12.5px;color:#a8a8a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-count{font-size:13px;color:#a8a8a8;white-space:nowrap;margin-right:6px}
.st-viewer .st-icon{color:#ddd}
.st-viewer .st-icon:hover{background:#333;color:#fff}
.st-light{color:#ddd!important}
.st-viewer-body{position:relative;display:grid;place-items:center;padding:20px 76px;min-height:0;overflow:hidden}
.st-viewer-body>*{grid-area:1/1}
.st-wait{color:#a8a8a8}
.st-picture{width:100%;height:100%;padding:0;border:0;background:transparent center/contain no-repeat;cursor:zoom-in;display:grid;place-items:center;overflow:hidden}
.st-picture img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 10px 30px rgba(0,0,0,.5))}
.st-picture.st-zoomed{cursor:zoom-out;overflow:auto;place-items:start center;background-image:none!important}
.st-picture.st-zoomed img{max-width:none;max-height:none}
.st-viewer-body video{max-width:100%;max-height:100%;border-radius:6px;background:#000}
.st-viewer-body iframe{width:min(920px,100%);height:100%;border:0;border-radius:6px;background:#fff}
.st-docx{width:min(960px,100%);height:100%;overflow:auto;border-radius:6px;background:#2a2a2a;position:relative}
/* Rebodocs' bar of the zoom, floating over the pages, as the included drive has it. */
.rf-doc-zoom { position: sticky; bottom: 14px; z-index: 3; display: flex; justify-content: center; pointer-events: none; margin-top: -52px; height: 52px; align-items: center; }
.rf-doc-zoom .dx-sb { background: none; border: 0; box-shadow: none; }
.st-docx .dx-caret { display: none !important; }
.st-code{width:min(980px,100%);height:100%;overflow:auto;padding:18px 22px;border:1px solid #333;border-radius:10px;background:#1f1f1f;color:#ececec}
.st-code pre{margin:0;font:13px/1.65 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
.st-table{max-width:100%;max-height:100%;overflow:auto;border-radius:8px;background:#fff}
.st-table table{border-collapse:collapse;color:#222;font-size:13px}
.st-table th,.st-table td{padding:7px 12px;border:1px solid #e6e6e6;text-align:left;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
.st-table th{position:sticky;top:0;background:#f1f1f1;font-weight:700}
.st-sound{display:grid;justify-items:center;gap:18px;width:min(420px,100%);color:#a8a8a8;text-align:center}
.st-sound .st-thumb{width:220px;margin:0}
.st-sound audio{width:100%}
.st-viewer-body .st-link{color:#9fb4ff}
.st-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:1;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:28px;line-height:1;cursor:pointer}
.st-nav:hover,.st-nav:focus-visible{background:rgba(255,255,255,.22)}
.st-prev{left:16px}
.st-next{right:16px}
.st-strip{display:flex;gap:8px;padding:10px 16px 12px;overflow-x:auto;background:#1f1f1f;border-top:1px solid #2e2e2e}
.st-strip button{flex:none;width:76px;padding:0;border:2px solid transparent;border-radius:8px;background:none;cursor:pointer;opacity:.65}
.st-strip button:hover{opacity:1}
.st-strip button[aria-current]{border-color:var(--st-blue);opacity:1}
.st-strip .st-thumb{height:56px;margin:0;border-radius:6px}
.st-strip .st-thumb svg{width:34px;height:28px}
.st-strip .st-badge,.st-strip .st-play{display:none}
.st-strip .st-paper{font-size:3px;padding:3px}
.st-keys{margin:8px 0 0;display:grid;gap:7px}
.st-keys div{display:grid;grid-template-columns:170px 1fr;gap:10px;align-items:center;font-size:13px}
.st-keys dd{margin:0;color:var(--st-soft)}
.studio kbd{display:inline-block;padding:1px 6px;border:1px solid var(--st-edge);border-bottom-width:2px;border-radius:5px;background:var(--st-field);font:600 12px/1.5 ui-monospace,Menlo,monospace;color:var(--st-ink)}
.st-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:10;pointer-events:none}
.st-toast:not(:empty){padding:9px 16px;border-radius:8px;background:#2c2c2c;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.2)}
`;
