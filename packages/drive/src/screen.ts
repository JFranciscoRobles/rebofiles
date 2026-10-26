// The whole drive, without a framework: a bar with the search, the sections
// beside, the list or the grid of a folder, the details of what is selected,
// and a bar of status. Mounted on an element, it renders itself again after
// each change, and `morph` changes only what differs, so the focus, a
// selection and what is scrolled stay where they were.
//
//   const drive = mountDrive(document.getElementById('files')!, { base: '/api/files' });
//   drive.destroy();

import { type DriveSettings, EVERYONE, type Entry, type EntryId, type FileEntry, type FolderEntry, type PersonalSettings, type Role, versionNumber } from '@rebofiles/core';
import { type DriveClient, RequestError, type SettingsAnswer, createDriveClient } from './client';
import { brandStyle, contrastOnWhite } from './brand';
import { type Child, first, h, morph } from './dom';
import { TEXTS, type Texts, type Translate, formatDate, formatSize, translator } from './i18n';
import { type IconName, icon, logo as mark } from './icons';
import { type DocumentPreview, badgeOf, kindOf } from './kinds';
import { markdown, rowsOf } from './markdown';
import { CSS } from './styles';

export interface DriveOptions {
  /** Where the routes of @rebofiles/server are: `/api/files` unless said. */
  base?: string;
  /** A client of your own, instead of `base`: the drive kept in the page, or one shared with the rest of the page. */
  client?: DriveClient;
  /** Headers for every request to the server, such as a token of the session. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Over the drive's settings, under each person's own; the drive's (English) unless given. */
  language?: 'en' | 'es';
  /** Texts of another language, with the keys of the English ones. */
  texts?: Texts;
  /** The name over the drive: the application's, or "Files". */
  title?: string;
  /** What goes before the title; ReboFiles' mark unless given. */
  logo?: Node;
  defaultView?: 'list' | 'grid';
  /** A file opened with a double click or Enter. Unless given, it is shown in the drive's own viewer. */
  onOpen?: (file: FileEntry, url: string) => void;
  /** Gives Word documents an "Open in Rebodocs" button, which calls this with an address to read the file from. */
  onOpenDocument?: (file: FileEntry, url: string) => void;
  /**
   * Shows a Word document's pages in the viewer, in `element`, and gives what takes them down: `viewDocx` of
   * `@rebofiles/drive/rebodocs`, by Rebodocs' engine. Without it, the viewer shows what `previewDocument` reads.
   */
  viewDocument?: (element: HTMLElement, bytes: Uint8Array) => ShownDocument | Promise<ShownDocument>;
  /** The first page of a Word document, drawn, for its thumbnail in the grid and the details: `thumbDocx` of `@rebofiles/drive/rebodocs`. */
  thumbDocument?: (bytes: Uint8Array) => Promise<HTMLElement>;
  /** Reads a Word document for its preview: `previewDocx` of `@rebofiles/drive/rebodocs`, or one of your own. */
  previewDocument?: (bytes: Uint8Array) => DocumentPreview | Promise<DocumentPreview>;
  /** The address a link of the drive is given: your page that shows it with `mountSharedLink`. This page with `?link=` unless given. */
  linkAddress?: (token: string) => string;
  /** Light, dark, or as the system is (`'auto'`): over the drive's settings, under each person's own. The drive's (light) unless given. */
  theme?: 'light' | 'dark' | 'auto';
  /** False to leave out the settings of the server, and the button that changes them. */
  settings?: boolean;
  className?: string;
  /** Called after every change made from the drive, for what else in the page shows it to ask again. */
  onChange?: () => void;
}

/** A document shown in the viewer's element: what takes it down, or more of it, as `viewDocx` gives. */
export type ShownDocument = (() => void) | { destroy(): void; pages?: number; layout?(mode: 'all' | 'pages'): void } | undefined;

export interface MountedDrive {
  readonly client: DriveClient;
  /** Other options, as a framework gives them again. */
  update(options: Partial<DriveOptions>): void;
  /** Asks the server again, after a change made elsewhere. */
  refresh(): void;
  destroy(): void;
}

type Section = 'files' | 'recent' | 'shared' | 'trash';
type Dialog =
  | { kind: 'folder'; name: string }
  | { kind: 'rename'; entry: Entry; name: string }
  | { kind: 'move'; entries: Entry[]; at: EntryId | null }
  | { kind: 'share'; entry: Entry; who: string; role: Role }
  | { kind: 'delete'; entries: Entry[] }
  | { kind: 'empty' }
  | null;

interface Upload {
  id: number;
  name: string;
  size: number;
  sent: number;
  state: 'waiting' | 'sending' | 'done' | 'failed';
  error?: string;
  /** Sent again from where it was cut. */
  retry?: () => void;
}

/** The type of what is dragged from the drive itself, apart from files dragged in from the computer. */
const DRAGGED = 'application/x-rebofiles-entry';
/** Larger documents are not read for a preview: they would cost more than a glance is worth. */
const PREVIEW_LIMIT = 20 * 1024 * 1024;
/** How much of a text the viewer reads: enough for any file a person reads, not a log of a year. */
const VIEW_LIMIT = 2 * 1024 * 1024;
const ROLES: Role[] = ['viewer', 'commenter', 'editor'];
const defaultAddress = (token: string) => `${location.origin}${location.pathname}?link=${encodeURIComponent(token)}`;
/** An id inside a selector's quotes. */
const quoted = (text: string) => text.replace(/["\\]/g, '\\$&');

let mounts = 0;

export function mountDrive(element: HTMLElement, given: DriveOptions = {}): MountedDrive {
  let options = given;
  const client = options.client ?? createDriveClient({ base: options.base ?? '/api/files', headers: () => options.headers?.() ?? {} });
  const prefix = `rf${++mounts}`;
  // The settings of the server, once they come: a person's own first, then what the application said, then the drive's.
  let settings: SettingsAnswer | null = null;
  const languageNow = (): 'en' | 'es' => settings?.mine.language ?? options.language ?? settings?.drive.language ?? 'en';
  const themeNow = () => settings?.mine.theme ?? options.theme ?? settings?.drive.theme ?? 'light';
  let t: Translate = translator(options.texts ?? TEXTS[languageNow()]);
  let locale = languageNow();
  const retranslate = () => {
    t = translator(options.texts ?? TEXTS[languageNow()]);
    locale = languageNow();
  };
  const loadSettings = () =>
    options.settings === false
      ? Promise.resolve()
      : client.settings().then(
          (answer) => {
            settings = answer;
            retranslate();
            render();
          },
          // A server without them: the drive as the options say.
          () => undefined,
        );

  // What is shown, as the hooks of @rebofiles/react keep it.
  let section: Section = 'files';
  let folder: EntryId | null = null;
  let from: 'files' | 'shared' = 'files';
  /** The one the keyboard is on, and whose details are shown when it is the only one picked. */
  let selected: EntryId | null = null;
  /** What is picked, for an action on all of it: the one selected, and those added with Ctrl, ⌘ or Shift. */
  let picked = new Set<EntryId>();
  /** Where a range picked with Shift starts. */
  let anchor: EntryId | null = null;
  let layout: 'list' | 'grid' = options.defaultView ?? 'list';
  let typed = '';
  let query = '';
  let dialog: Dialog = null;
  let toast: string | null = null;
  let storage = '';
  let dropping = false;
  let menuOpen = false;
  let tab: 'details' | 'versions' = 'details';
  let uploads: Upload[] = [];
  let revision = 0;
  let alive = true;

  // ---- What is asked of the server, once for each thing and each revision ----

  interface Loaded<T> {
    value: T | undefined;
    loading: boolean;
    error: Error | null;
    /** Whether the value is of the key asked for, not the last one's. */
    current: boolean;
  }
  function resource<T>(load: (key: string) => Promise<T>) {
    let key: string | undefined;
    let at = -1;
    let asked = 0;
    let of: string | undefined;
    let value: T | undefined;
    let error: Error | null = null;
    let loading = false;
    return (wanted: string): Loaded<T> => {
      if (wanted !== key || at !== revision) {
        key = wanted;
        at = revision;
        loading = true;
        const n = ++asked;
        load(wanted).then(
          (found) => n === asked && ((value = found), (of = wanted), (error = null), (loading = false), render()),
          (failed: Error) => n === asked && ((value = undefined), (of = wanted), (error = failed), (loading = false), render()),
        );
      }
      return { value, loading: loading || of !== wanted, error: of === wanted ? error : null, current: of === wanted };
    };
  }

  type View = { section: 'files'; folder: EntryId | null } | { section: 'recent' | 'shared' | 'trash' } | { section: 'search'; query: string; trashed: boolean };
  const viewOf = (): View => (query ? { section: 'search', query, trashed: section === 'trash' } : section === 'files' ? { section, folder } : { section });
  const listing = resource((key) => {
    const view = JSON.parse(key) as View;
    if (view.section === 'files') return client.list(view.folder);
    const asked =
      view.section === 'search' ? client.search(view.query, { trashed: view.trashed }) : view.section === 'recent' ? client.recent() : view.section === 'shared' ? client.shared() : client.trash();
    return asked.then((entries) => ({ folder: null, entries, path: [] as FolderEntry[] }));
  });
  const detail = resource((id) => client.entry(id));
  const moving = resource((key) => client.list(JSON.parse(key) as EntryId | null));
  // Addresses to show a file in the page, one for each version, kept while the drive is mounted.
  const inline = new Map<string, string | null>();
  /** With `size`, of a picture: the smaller one made of it that shows it at that size, once there is one. */
  const urlOf = (file: FileEntry, size?: number): string | null => {
    const key = `${file.id}:${file.versions[0].id}:${size ?? ''}:${file.versions[0].renditions?.length ?? 0}`;
    if (!inline.has(key)) {
      inline.set(key, null);
      client.url(file.id, { inline: true, size }).then(
        (url) => (inline.set(key, url), render()),
        () => undefined,
      );
    }
    return inline.get(key) ?? null;
  };
  const texts = new Map<string, string | null>();
  const pages = new Map<string, DocumentPreview | null>();
  /** The first page of each Word document as its engine draws it, for thumbnails: null while it is made, an Error when it could not be. */
  const thumbs = new Map<string, HTMLElement | null | Error>();
  /** The first page of a document, small, made once for each version; undefined where there is no way to make it. */
  const docThumb = (file: FileEntry, fit: 'page' | 'width'): Child | undefined => {
    const make = options.thumbDocument;
    if (!make || kindOf(file) !== 'docx' || file.versions[0].size > PREVIEW_LIMIT) return undefined;
    const key = `${file.id}:${file.versions[0].id}`;
    const url = urlOf(file);
    if (url && !thumbs.has(key)) {
      thumbs.set(key, null);
      fetch(url)
        .then((answer) => answer.arrayBuffer())
        .then((bytes) => make(new Uint8Array(bytes)))
        .then(
          (page) => (thumbs.set(key, page), render()),
          (error: Error) => (thumbs.set(key, error), render()),
        );
    }
    const page = thumbs.get(key);
    if (page instanceof Error) return undefined;
    // Its own element once the page is there, which the drive does not draw again: a copy of the page, made smaller to fit.
    return h('div', {
      key: `thumb:${key}:${fit}:${page ? 'on' : 'wait'}`,
      class: `rf-doc-thumb rf-fit-${fit}`,
      'aria-hidden': 'true',
      'data-own': true,
      mount: (box: HTMLElement) => {
        if (!page) return;
        const copy = page.cloneNode(true) as HTMLElement;
        const width = Number(page.dataset.width) || 816;
        const height = Number(page.dataset.height) || 1056;
        // Its top, the side margins left out so the text is as large as it can be; or the whole page.
        const SHOWN = 0.8;
        const scale = fit === 'width' ? box.clientWidth / (width * SHOWN) : Math.min(box.clientWidth / width, box.clientHeight / height);
        const left = fit === 'width' ? -(width * scale - box.clientWidth) / 2 : Math.max(0, (box.clientWidth - width * scale) / 2);
        const top = fit === 'width' ? -height * scale * 0.04 : Math.max(0, (box.clientHeight - height * scale) / 2);
        copy.style.cssText = `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:top left;position:absolute;left:${left}px;top:${top}px`;
        box.appendChild(copy);
      },
    });
  };

  // ---- Changes, each telling what else shows the drive, and the toast ----

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string | null) => {
    toast = text;
    clearTimeout(toastTimer);
    if (text) toastTimer = setTimeout(() => ((toast = null), render()), 2800);
    render();
  };
  const changed = () => {
    revision++;
    options.onChange?.();
    render();
  };
  /** Does it, says what went wrong in the toast rather than in the console, and asks everything again. */
  const attempt = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) say(done);
    } catch (error) {
      say(error instanceof RequestError ? error.message : String(error));
    } finally {
      changed();
    }
  };

  const go = (next: Section, to: EntryId | null = null) => {
    if (next === 'shared' || (next === 'files' && to === null)) from = next === 'shared' ? 'shared' : 'files';
    section = next;
    folder = to;
    selected = null;
    picked = new Set();
    anchor = null;
    typed = '';
    query = '';
    clearTimeout(searchTimer);
    render();
  };
  // The search asks once the typing pauses.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const setTyped = (value: string) => {
    typed = value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = typed.trim();
      render();
    }, 200);
    render();
  };
  /** The one picked, alone; null for none. */
  const select = (id: EntryId | null) => {
    if (id !== selected) tab = 'details';
    selected = id;
    anchor = id;
    picked = new Set(id ? [id] : []);
    render();
  };
  /** One added to what is picked, or taken out of it. */
  const toggle = (id: EntryId) => {
    picked = new Set(picked);
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    selected = id;
    anchor = id;
    render();
  };
  /** Everything from where the range started to `id`, in the order shown; with `adding`, besides what was picked. */
  const pickRange = (entries: Entry[], id: EntryId, adding = false) => {
    const from = Math.max(
      0,
      entries.findIndex((entry) => entry.id === (anchor ?? id)),
    );
    const to = entries.findIndex((entry) => entry.id === id);
    const range = entries.slice(Math.min(from, to), Math.max(from, to) + 1).map((entry) => entry.id);
    picked = new Set([...(adding ? picked : []), ...range]);
    selected = id;
    render();
  };
  /** What the view shows now, for what is dragged to find its entries. */
  let shownEntries: Entry[] = [];
  /** The entries dragged from the drive itself: one, or all that was picked. */
  const dragged = (event: DragEvent): Entry[] =>
    (event.dataTransfer?.getData(DRAGGED) ?? '')
      .split('\n')
      .filter(Boolean)
      .map((id) => shownEntries.find((entry) => entry.id === id) ?? ({ id, name: id } as Entry));
  /** One action on each of what is picked, one after another: said once, with how many it could not do and why. */
  const each = async (entries: Entry[], work: (entry: Entry) => Promise<unknown>, done: 'movedMany' | 'trashedMany' | 'restoredMany' | 'deletedMany') => {
    let failed = 0;
    let why = '';
    for (const entry of entries) {
      try {
        await work(entry);
      } catch (error) {
        failed++;
        why = error instanceof Error ? error.message : String(error);
      }
    }
    if (done !== 'movedMany') picked = new Set();
    if (done !== 'movedMany') selected = null;
    say(
      failed
        ? t('notAll', { done: entries.length - failed, n: entries.length, why })
        : entries.length === 1 && done === 'trashedMany'
          ? t('movedToTrash', { name: entries[0].name })
          : t(done, { n: entries.length }),
    );
    changed();
  };

  const open = async (entry: Entry) => {
    if (entry.kind === 'folder') {
      if (section === 'trash') return;
      return go('files', entry.id);
    }
    // Shown in the drive itself, unless the application opens files its own way.
    if (!options.onOpen) return view(entry.id);
    try {
      options.onOpen(entry, await client.url(entry.id, { inline: true }));
    } catch (error) {
      say((error as Error).message);
    }
  };
  /** In a tab of its own, as the browser shows it: from the viewer, for what it cannot show or to keep beside. */
  const openInTab = async (file: FileEntry) => {
    // A window opened before the address is known, so the browser takes it as the click's.
    const opened = window.open('about:blank', '_blank');
    try {
      const url = await client.url(file.id, { inline: true });
      if (opened) opened.location.href = url;
    } catch (error) {
      opened?.close();
      say((error as Error).message);
    }
  };

  let queue = Promise.resolve();
  let uploadCount = 0;
  const set = (id: number, change: Partial<Upload>) => {
    uploads = uploads.map((u) => (u.id === id ? { ...u, ...change } : u));
    render();
  };
  /** Files sent one after another, each in parts; what has gone of each, for the bar. */
  const uploadInto = (files: Iterable<File>, parent: EntryId | null) => {
    for (const file of files) {
      const id = ++uploadCount;
      uploads = [...uploads.filter((u) => u.state !== 'done'), { id, name: file.name, size: file.size, sent: 0, state: 'waiting' }];
      // Tried again, the client goes on from what arrived.
      const send = () => {
        queue = queue.then(async () => {
          set(id, { state: 'sending', error: undefined, retry: undefined });
          const before = selected;
          try {
            const entry = await client.upload(file, { parent, onProgress: ({ sent }) => set(id, { sent }), images: settings?.settings.images });
            set(id, { state: 'done', sent: file.size });
            // Shown once it is up, unless the person picked something else meanwhile.
            if (selected === before && picked.size <= 1 && !viewing) select(entry.id);
            say(t('uploaded', { name: entry.name }));
          } catch (error) {
            set(id, { state: 'failed', error: (error as Error).message, retry: send });
          }
          changed();
        });
      };
      send();
    }
    render();
  };

  /** What a folder, a crumb or a section does with what is dropped on it: files from the computer go up into it, entries of the drive move into it. */
  const dropTarget = (target: EntryId | null) => ({
    onDragover: (event: DragEvent) => {
      if (section === 'trash' && target === null) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).classList.add('rf-drop');
    },
    onDragleave: (event: DragEvent) => (event.currentTarget as HTMLElement).classList.remove('rf-drop'),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).classList.remove('rf-drop');
      dropping = false;
      const moved = dragged(event).filter((entry) => entry.id !== target);
      if (moved.length) void each(moved, (entry) => client.move(entry.id, target), 'movedMany');
      else if (event.dataTransfer?.files.length) uploadInto(event.dataTransfer.files, target);
    },
  });

  // ---- The pieces of the screen ----

  const tile = (entry: Entry) => h('span', { class: `rf-tile rf-k-${kindOf(entry)}`, 'aria-hidden': 'true' }, entry.kind === 'folder' ? icon('folder', 16) : badgeOf(entry));
  const roleName = (role: Role) => t(role === 'viewer' ? 'roleViewer' : role === 'commenter' ? 'roleCommenter' : 'roleEditor');
  const typeName = (file: FileEntry): string => {
    const kind = kindOf(file);
    if (kind === 'docx') return t('kindDocx');
    if (kind === 'pdf') return t('kindPdf');
    if (kind === 'sheet') return t('kindSheet');
    if (kind === 'image') return `${t('kindImage')} · ${badgeOf(file)}`;
    if (kind === 'text') return `${t('kindText')} · ${badgeOf(file)}`;
    return file.type;
  };
  const button = (label: Child, onClick: (event: Event) => void, props: Record<string, unknown> = {}) => h('button', { type: 'button', ...props, onClick }, label);
  const withIcon = (name: IconName, text: string, size = 16) => [icon(name, size), text];

  function newMenu(disabled: boolean) {
    const items = () => [...element.querySelectorAll<HTMLButtonElement>('.rf-menu [role="menuitem"]')];
    const pick = (what: () => void) => () => {
      menuOpen = false;
      render();
      what();
    };
    return [
      h(
        'button',
        {
          type: 'button',
          class: 'rf-new',
          'aria-haspopup': 'menu',
          'aria-expanded': menuOpen,
          disabled,
          onClick: () => ((menuOpen = !menuOpen), render()),
          onKeydown: (event: KeyboardEvent) => event.key === 'ArrowDown' && (event.preventDefault(), (menuOpen = true), render()),
        },
        icon('plus', 20),
        t('upload'),
      ),
      menuOpen &&
        h(
          'div',
          {
            class: 'rf-menu',
            role: 'menu',
            tabindex: '-1',
            mount: (menu: HTMLElement) => menu.querySelector<HTMLButtonElement>('button')?.focus(),
            // The arrows go round the items, as a menu's do; Escape gives the focus back to the button, Tab goes on from it.
            onKeydown: (event: KeyboardEvent) => {
              const all = items();
              const at = all.indexOf(document.activeElement as HTMLButtonElement);
              const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key];
              if (to !== undefined) {
                event.preventDefault();
                all[(to + all.length) % all.length]?.focus();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                menuOpen = false;
                render();
                element.querySelector<HTMLButtonElement>('.rf-new')?.focus();
              } else if (event.key === 'Tab') {
                menuOpen = false;
                render();
              }
            },
          },
          button(
            withIcon('upload', t('uploadFiles'), 18),
            pick(() => element.querySelector<HTMLInputElement>('.rf-file')?.click()),
            { role: 'menuitem', tabindex: '-1' },
          ),
          button(
            withIcon('folderPlus', t('newFolder'), 18),
            pick(() => ((dialog = { kind: 'folder', name: '' }), render())),
            { role: 'menuitem', tabindex: '-1' },
          ),
        ),
    ];
  }

  function items(entries: Entry[], loading: boolean, error: Error | null, empty: string) {
    if (error) return h('div', { class: 'rf-empty rf-error', role: 'alert' }, error.message);
    if (!loading && entries.length === 0) return h('div', { class: 'rf-empty' }, h('div', null, icon('folder', 40), h('div', null, empty)));
    const index = entries.findIndex((entry) => entry.id === selected);
    const draggable = section !== 'trash';
    const onKeydown = (event: KeyboardEvent) => {
      const box = element.querySelector('.rf-items');
      const columns = layout === 'grid' ? Math.max(1, Math.floor((box?.clientWidth ?? 600) / 162)) : 1;
      const step: Record<string, number> = { ArrowDown: columns, ArrowUp: -columns, ...(layout === 'grid' ? { ArrowRight: 1, ArrowLeft: -1 } : {}) };
      const current = entries[index];
      const many = entries.filter((entry) => picked.has(entry.id));
      // With Shift, the arrows and Home and End pick everything on the way; with Ctrl or ⌘, they only move, and Space picks.
      const goTo = (next: Entry | undefined) => {
        if (!next) return;
        if (event.shiftKey) pickRange(entries, next.id);
        else if (event.ctrlKey || event.metaKey) (selected = next.id), render();
        else select(next.id);
      };
      if (event.key in step) {
        event.preventDefault();
        goTo(entries[index < 0 ? 0 : Math.min(entries.length - 1, Math.max(0, index + step[event.key]))]);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        goTo(event.key === 'Home' ? entries[0] : entries[entries.length - 1]);
      } else if (event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        picked = new Set(entries.map((entry) => entry.id));
        render();
      } else if (event.key === ' ' && current) {
        event.preventDefault();
        toggle(current.id);
      } else if (event.key === 'Enter' && current) {
        event.preventDefault();
        void open(current);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && many.length) {
        event.preventDefault();
        if (section !== 'trash') void each(many, (entry) => client.moveToTrash(entry.id), 'trashedMany');
      } else if (event.key === 'F2' && current) {
        event.preventDefault();
        if (section !== 'trash') (dialog = { kind: 'rename', entry: current, name: current.name }), render();
      } else if (event.key === 'Escape') select(null);
    };
    /** A box to tick, for a mouse: the keyboard picks with Space, and a screen reader is told by aria-selected. */
    const tick = (entry: Entry) =>
      h(
        'span',
        {
          class: 'rf-tick',
          'aria-hidden': 'true',
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            toggle(entry.id);
          },
          onDblclick: (event: MouseEvent) => event.stopPropagation(),
        },
        icon('check', 14),
      );
    const item = (entry: Entry, className: string, ...children: Child[]) =>
      h(
        'div',
        {
          key: entry.id,
          class: className,
          id: `${prefix}-${entry.id}`,
          'data-id': entry.id,
          role: 'option',
          'aria-selected': picked.has(entry.id),
          'data-current': entry.id === selected,
          draggable: draggable ? 'true' : 'false',
          onClick: (event: MouseEvent) => (event.shiftKey ? pickRange(entries, entry.id, event.ctrlKey || event.metaKey) : event.ctrlKey || event.metaKey ? toggle(entry.id) : select(entry.id)),
          onDblclick: () => void open(entry),
          onDragstart: (event: DragEvent) => {
            // What is picked goes together, when the one dragged is among it.
            const dragged = picked.has(entry.id) && picked.size > 1 ? entries.filter((e) => picked.has(e.id)).map((e) => e.id) : [entry.id];
            event.dataTransfer?.setData(DRAGGED, dragged.join('\n'));
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          },
          ...(entry.kind === 'folder' && section === 'files' ? dropTarget(entry.id) : {}),
        },
        ...children,
      );
    return h(
      'div',
      {
        // Keyed: the bar of what is picked comes and goes before it, and the list must stay the same element, with the focus.
        key: 'items',
        class: 'rf-items',
        role: 'listbox',
        'aria-label': t('name'),
        'aria-multiselectable': 'true',
        'data-picking': picked.size > 1,
        tabindex: '0',
        'aria-activedescendant': selected && index >= 0 ? `${prefix}-${selected}` : undefined,
        onKeydown,
        onFocus: () => index < 0 && entries[0] && select(entries[0].id),
      },
      layout === 'list'
        ? [
            h('div', { class: 'rf-cols', 'aria-hidden': 'true' }, h('span', null, t('name')), h('span', null, t('owner')), h('span', null, t('modified')), h('span', null, t('size'))),
            entries.map((entry) =>
              item(
                entry,
                'rf-row',
                h('span', { class: 'rf-name' }, tick(entry), tile(entry), h('span', null, entry.name)),
                h('span', null, entry.owner),
                h('span', null, formatDate(entry.modified, locale)),
                h('span', null, entry.kind === 'file' ? formatSize(entry.versions[0].size, locale) : '—'),
              ),
            ),
          ]
        : h(
            'div',
            { class: 'rf-grid' },
            entries.map((entry) => {
              const kind = kindOf(entry);
              const url = kind === 'image' ? urlOf(entry as FileEntry, 320) : null;
              return item(
                entry,
                'rf-card',
                h(
                  'div',
                  { class: `rf-thumb rf-k-${kind}` },
                  tick(entry),
                  url ? h('img', { src: url, alt: '', loading: 'lazy' }) : (entry.kind === 'file' && docThumb(entry, 'width')) || icon(entry.kind === 'folder' ? 'folder' : 'doc', 34),
                ),
                h('div', { class: 'rf-name' }, tile(entry), h('span', null, entry.name)),
              );
            }),
          ),
    );
  }

  function preview(file: FileEntry) {
    // The top of its first page, as wide as the box: large enough to read, the rest in the viewer.
    const thumb = docThumb(file, 'width');
    if (thumb) return h('div', { class: 'rf-preview rf-preview-doc' }, thumb);
    const kind = kindOf(file);
    const reads = kind === 'text' || (kind === 'docx' && options.previewDocument && file.versions[0].size <= PREVIEW_LIMIT);
    const url = kind === 'image' ? urlOf(file, 640) : kind === 'pdf' || reads ? urlOf(file) : null;
    const key = `${file.id}:${file.versions[0].id}`;
    if (url && kind === 'text' && !texts.has(key)) {
      texts.set(key, null);
      // Only the beginning: the first piece that arrives, and the rest is not asked for.
      fetch(url)
        .then(async (answer) => {
          const reader = answer.body?.getReader();
          const piece = await reader?.read();
          await reader?.cancel();
          return new TextDecoder().decode(piece?.value ?? new Uint8Array()).slice(0, 4096);
        })
        .then(
          (read) => (texts.set(key, read), render()),
          () => undefined,
        );
    }
    if (url && kind === 'docx' && reads && options.previewDocument && !pages.has(key)) {
      pages.set(key, null);
      const read = options.previewDocument;
      fetch(url)
        .then((answer) => answer.arrayBuffer())
        .then((bytes) => read(new Uint8Array(bytes)))
        .then(
          (page) => (pages.set(key, page), render()),
          () => undefined,
        );
    }
    const text = texts.get(key);
    const page = pages.get(key);
    return h(
      'div',
      { class: 'rf-preview' },
      kind === 'image' && url
        ? h('img', { src: url, alt: file.name })
        : kind === 'pdf' && url
          ? h('iframe', { src: `${url}#toolbar=0&view=FitH`, title: file.name })
          : kind === 'text' && typeof text === 'string'
            ? h('pre', null, text)
            : page
              ? h(
                  'div',
                  { class: 'rf-page' },
                  page.title && h('strong', null, page.title),
                  page.paragraphs.map((p) => h('p', null, p)),
                )
              : h('span', { title: kind === 'other' ? t('noPreview') : undefined }, tile(file)),
    );
  }

  /** Each file downloaded, one after another: a browser asks once whether a page may download several. */
  const downloadEach = async (files: Entry[]) => {
    for (const file of files.filter((entry): entry is FileEntry => entry.kind === 'file')) {
      const link = document.createElement('a');
      link.href = await client.url(file.id);
      link.download = file.name;
      link.click();
      await new Promise((done) => setTimeout(done, 250));
    }
  };
  /** What can be done to all that is picked at once. */
  const pickedActions = (many: Entry[], wide = false): Child[] => {
    const cls = (extra = '') => `rf-btn${wide ? '' : ' rf-small'}${extra}`;
    // In the bar, the words go on a narrow screen and the icons stay, the words still their names.
    const labelled = (name: IconName, text: string): Child => (wide ? withIcon(name, text) : [icon(name, 16), h('span', { class: 'rf-btn-text' }, text)]);
    const files = many.filter((entry) => entry.kind === 'file');
    return section === 'trash'
      ? [
          button(labelled('restore', t('restore')), () => void each(many, (entry) => client.restore(entry.id), 'restoredMany'), { class: cls(' rf-primary'), title: t('restore') }),
          button(labelled('trash', t('deleteForever')), () => ((dialog = { kind: 'delete', entries: many }), render()), { class: cls(' rf-text rf-danger'), title: t('deleteForever') }),
        ]
      : [
          files.length > 0 &&
            button(labelled('download', files.length === many.length ? t('download') : t('downloadFiles', { n: files.length })), () => void attempt(() => downloadEach(files)), {
              class: cls(),
              title: t('download'),
            }),
          button(labelled('move', t('move')), () => ((dialog = { kind: 'move', entries: many, at: null }), (movedInto = false), render()), { class: cls(), title: t('move') }),
          button(labelled('trash', t('moveToTrash')), () => void each(many, (entry) => client.moveToTrash(entry.id), 'trashedMany'), { class: cls(' rf-text rf-danger'), title: t('moveToTrash') }),
        ];
  };
  function pickedBar(many: Entry[]) {
    return h(
      'div',
      { key: 'picked', class: 'rf-head rf-picking', role: 'toolbar', 'aria-label': t('pickedN', { n: many.length }) },
      button(icon('close', 16), () => select(null), { class: 'rf-btn rf-small rf-icon', 'aria-label': t('clearPicked'), title: t('clearPicked') }),
      h('strong', { class: 'rf-picked-count' }, t('pickedN', { n: many.length })),
      h('span', { class: 'rf-grow' }),
      ...pickedActions(many),
    );
  }
  function pickedDetails(many: Entry[]) {
    const size = many.reduce((sum, entry) => sum + (entry.kind === 'file' ? entry.versions[0].size : 0), 0);
    const folders = many.filter((entry) => entry.kind === 'folder').length;
    const SHOWN = 8;
    return h(
      'aside',
      { class: 'rf-details', 'aria-label': t('details') },
      h(
        'div',
        { class: 'rf-details-in' },
        h('h2', null, t('pickedN', { n: many.length })),
        h(
          'div',
          { class: 'rf-preview rf-stack', 'aria-hidden': 'true' },
          many.slice(0, 3).map((entry, i) => h('span', { key: entry.id, class: 'rf-stack-card', style: `--rf-i: ${i}` }, tile(entry))),
        ),
        h('div', { class: 'rf-actions' }, ...pickedActions(many, true)),
        h('dl', { class: 'rf-props' }, h('dt', null, t('size')), h('dd', null, formatSize(size, locale)), folders > 0 && [h('dt', null, t('folders')), h('dd', null, String(folders))]),
        h(
          'ul',
          { class: 'rf-picked-list' },
          many.slice(0, SHOWN).map((entry) => h('li', { key: entry.id }, tile(entry), h('span', null, entry.name))),
          many.length > SHOWN && h('li', { key: 'more', class: 'rf-hint' }, t('andMore', { n: many.length - SHOWN })),
        ),
      ),
    );
  }

  function details(listed: Entry | null) {
    const found = listed ? detail(listed.id) : null;
    // The entry as the server says it is now, once it has said; as the list had it until then.
    const entry = found?.current && found.value && listed && found.value.entry.id === listed.id ? found.value.entry : listed;
    if (!entry) return h('aside', { class: 'rf-details', 'aria-label': t('details') }, h('p', { class: 'rf-none' }, t('nothingSelected')));
    const inTrash = section === 'trash';
    const file = entry.kind === 'file' ? entry : null;
    const where = found?.current && found.value && found.value.entry.id === entry.id ? found.value.path.map((step) => step.name).join(' / ') || t('top') : '';
    const gone = () => ((selected = null), render());
    const download = async () => {
      const url = await client.url(entry.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = entry.name;
      link.click();
    };
    const shown = file ? tab : 'details';
    const row = (term: string, value: Child, title?: string) => [h('dt', null, term), h('dd', { title }, value)];
    return h(
      'aside',
      { class: 'rf-details', 'aria-label': t('details') },
      h(
        'div',
        { class: 'rf-details-in' },
        h('h2', null, entry.name),
        file ? preview(file) : h('div', { class: 'rf-preview' }, tile(entry)),
        h(
          'div',
          { class: 'rf-actions' },
          inTrash
            ? [
                button(withIcon('restore', t('restore')), () => void attempt(() => client.restore(entry.id).then(gone), t('restored', { name: entry.name })), { class: 'rf-btn rf-primary' }),
                button(t('deleteForever'), () => ((dialog = { kind: 'delete', entries: [entry] }), render()), { class: 'rf-btn rf-text rf-danger' }),
              ]
            : [
                file &&
                  options.onOpenDocument &&
                  kindOf(file) === 'docx' &&
                  button(withIcon('doc', t('openInRebodocs')), () => void attempt(async () => options.onOpenDocument?.(file, await client.url(file.id, { inline: true }))), {
                    class: 'rf-btn rf-docs rf-wide',
                  }),
                file && button(withIcon('download', t('download')), () => void attempt(download), { class: 'rf-btn' }),
                button(withIcon(file ? 'eye' : 'external', t('open')), () => void open(entry), { class: 'rf-btn' }),
                button(withIcon('pencil', t('rename')), () => ((dialog = { kind: 'rename', entry, name: entry.name }), render()), { class: 'rf-btn' }),
                button(withIcon('move', t('move')), () => ((dialog = { kind: 'move', entries: [entry], at: null }), (movedInto = false), render()), { class: 'rf-btn' }),
                button(withIcon('users', t('share')), () => ((dialog = { kind: 'share', entry, who: '', role: 'viewer' }), render()), { class: 'rf-btn' }),
                button(withIcon('trash', t('moveToTrash')), () => void attempt(() => client.moveToTrash(entry.id).then(gone), t('movedToTrash', { name: entry.name })), {
                  class: 'rf-btn rf-text rf-danger',
                }),
              ],
        ),
        file &&
          h(
            'div',
            { class: 'rf-tabs', role: 'tablist' },
            button(t('details'), () => ((tab = 'details'), render()), { role: 'tab', 'aria-selected': shown === 'details' }),
            button(`${t('versions')} · ${file.versions.length}`, () => ((tab = 'versions'), render()), { role: 'tab', 'aria-selected': shown === 'versions' }),
          ),
        shown === 'versions' && file
          ? h(
              'ul',
              { class: 'rf-versions' },
              file.versions.map((version, i) =>
                h(
                  'li',
                  { key: version.id, class: i === 0 ? 'rf-now' : undefined },
                  h(
                    'span',
                    { class: 'rf-v' },
                    t('version', { n: versionNumber(file, version.id) }),
                    h(
                      'small',
                      null,
                      `${formatDate(version.at, locale)} · ${version.by} · ${formatSize(version.size, locale)}${version.restoredFrom ? ` · ${t('restoredFrom', { n: versionNumber(file, version.restoredFrom) })}` : ''}`,
                    ),
                  ),
                  i === 0
                    ? h('span', { class: 'rf-chip' }, t('current'))
                    : !inTrash &&
                        button(t('restore'), () => void attempt(() => client.restoreVersion(file.id, version.id), t('versionRestored', { n: versionNumber(file, version.id) })), { class: 'rf-link' }),
                ),
              ),
            )
          : h(
              'dl',
              { class: 'rf-props' },
              row(t('type'), file ? typeName(file) : t('folder'), file?.type),
              file && row(t('size'), formatSize(file.versions[0].size, locale)),
              row(t('owner'), entry.owner),
              entry.shares?.length ? row(t('sharedWith'), entry.shares.map((s) => `${s.with === EVERYONE ? t('everyone') : s.with} · ${roleName(s.role)}`).join(', ')) : null,
              row(t('modified'), `${formatDate(entry.modified, locale)} · ${entry.modifiedBy}`),
              where && row(t('location'), where),
              file && row(t('key'), h('code', null, file.versions[0].key)),
            ),
      ),
    );
  }

  // ---- Dialogs: the browser's own, which keep the focus inside and give it back when they close ----

  const closeDialog = () => {
    if (!dialog) return;
    dialog = null;
    // Closed before it goes, so the browser gives the focus back to where it was.
    const open = element.querySelector<HTMLDialogElement>('dialog[open]');
    open?.close();
    render();
  };
  const modal = (label: string, ...children: Child[]) =>
    h(
      'dialog',
      {
        key: label,
        class: 'rf-dialog',
        'aria-label': label,
        mount: (d: HTMLElement) => !(d as HTMLDialogElement).open && (d as HTMLDialogElement).showModal(),
        onClose: closeDialog,
        // A click on the backdrop closes it, as Escape does from the keyboard.
        onClick: (event: Event) => event.target === event.currentTarget && closeDialog(),
      },
      ...children,
    );
  const actionsRow = (...children: Child[]) => h('div', { class: 'rf-row-end' }, ...children);
  const cancel = () => button(t('cancel'), closeDialog, { class: 'rf-btn' });

  function nameDialog(title: string, label: string, initial: string, action: string, name: string, onSubmit: (name: string) => void) {
    return modal(
      title,
      h(
        'form',
        {
          onSubmit: (event: Event) => {
            event.preventDefault();
            const chosen = name.trim();
            closeDialog();
            if (chosen) onSubmit(chosen);
          },
        },
        h('h2', null, title),
        h('input', {
          type: 'text',
          'aria-label': label,
          value: name,
          onInput: (event: Event) => {
            if (dialog && 'name' in dialog) dialog.name = (event.target as HTMLInputElement).value;
            render();
          },
          mount: (field: HTMLElement) => {
            const input = field as HTMLInputElement;
            input.focus();
            // The name without its extension, as a person most often changes only that.
            const dot = initial.lastIndexOf('.');
            input.setSelectionRange(0, dot > 0 ? dot : initial.length);
          },
        }),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: !name.trim() || name.trim() === initial }, action)),
      ),
    );
  }

  function confirmDialog(text: string, action: string, onConfirm: () => void) {
    return modal(
      action,
      h(
        'form',
        {
          onSubmit: (event: Event) => {
            event.preventDefault();
            closeDialog();
            onConfirm();
          },
        },
        h('h2', null, action),
        h('p', { style: 'margin: 0' }, text),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', style: 'background: var(--rf-danger); border-color: var(--rf-danger)' }, action)),
      ),
    );
  }

  // Gone into a folder in the move dialog, the button pressed is gone too: the focus goes to its first folder, or to "Move here".
  let movedInto = false;
  function moveDialog(moved: Entry[], at: EntryId | null) {
    const listed = moving(JSON.stringify(at));
    const folders = (listed.value?.entries ?? []).filter((e): e is FolderEntry => e.kind === 'folder');
    const path = listed.value?.path ?? [];
    const label = moved.length === 1 ? t('moveTo', { name: moved[0].name }) : t('moveMany', { n: moved.length });
    const goTo = (id: EntryId | null) => {
      if (dialog?.kind === 'move') dialog.at = id;
      movedInto = true;
      render();
    };
    if (movedInto && !listed.loading) {
      movedInto = false;
      afterRender.push(() => (element.querySelector<HTMLButtonElement>('.rf-folders button:not(:disabled)') ?? element.querySelector<HTMLButtonElement>('.rf-dialog [type="submit"]'))?.focus());
    }
    return modal(
      label,
      h(
        'form',
        {
          onSubmit: (event: Event) => {
            event.preventDefault();
            closeDialog();
            void each(moved, (entry) => client.move(entry.id, at), 'movedMany');
          },
        },
        h('h2', null, label),
        h(
          'div',
          { class: 'rf-crumbs', style: 'flex-wrap: wrap' },
          button(t('myFiles'), () => goTo(null), { class: 'rf-crumb', style: 'font-size: 14px' }),
          path.map((step) =>
            h(
              'span',
              { key: step.id, style: 'display: contents' },
              icon('chevron', 14),
              button(step.name, () => goTo(step.id), { class: 'rf-crumb', style: 'font-size: 14px' }),
            ),
          ),
        ),
        h(
          'ul',
          { class: 'rf-folders' },
          folders.map((f) =>
            h(
              'li',
              { key: f.id },
              button([h('span', { class: 'rf-tile rf-k-folder', 'aria-hidden': 'true' }, icon('folder', 16)), f.name], () => goTo(f.id), { disabled: moved.some((entry) => entry.id === f.id) }),
            ),
          ),
        ),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: moved.every((entry) => entry.parent === at) }, t('moveHere'))),
      ),
    );
  }

  /** Who an entry is shared with and as what, and its links: each change made at once, the dialog staying open. */
  function shareDialog(of: Entry, who: string, role: Role) {
    const found = detail(of.id);
    const entry = found.current && found.value ? found.value.entry : of;
    const label = t('shareTitle', { name: of.name });
    const address = options.linkAddress ?? defaultAddress;
    const copy = async (token: string) => navigator.clipboard.writeText(address(token));
    const setShare = (change: Partial<{ who: string; role: Role }>) => {
      if (dialog?.kind === 'share') Object.assign(dialog, change);
      render();
    };
    // Emptied once shared, unless the next one was typed meanwhile.
    const add = (user: string) =>
      attempt(
        () => client.share(of.id, user, role).then(() => dialog?.kind === 'share' && dialog.who.trim() === user && setShare({ who: '' })),
        t('shared', { who: user === EVERYONE ? t('everyone') : user }),
      );
    const roles = (value: Role, onChange: (role: Role) => void, labelled: string) =>
      h(
        'select',
        { class: 'rf-select', 'aria-label': labelled, value, onChange: (event: Event) => onChange((event.target as HTMLSelectElement).value as Role) },
        ROLES.map((r) => h('option', { key: r, value: r }, roleName(r))),
      );
    return modal(
      label,
      h(
        'form',
        {
          onSubmit: (event: Event) => {
            event.preventDefault();
            if (who.trim()) void add(who.trim());
          },
        },
        h('h2', null, label),
        h('h3', { class: 'rf-sub' }, t('people')),
        entry.shares?.length
          ? h(
              'ul',
              { class: 'rf-shares' },
              entry.shares.map((s) => {
                const person = s.with === EVERYONE ? t('everyone') : s.with;
                return h(
                  'li',
                  { key: s.with },
                  h('span', { class: 'rf-grow' }, person),
                  roles(s.role, (next) => void attempt(() => client.share(of.id, s.with, next)), `${t('role')} · ${person}`),
                  button(t('remove'), () => void attempt(() => client.unshare(of.id, s.with)), { class: 'rf-link', 'aria-label': `${t('remove')} · ${person}` }),
                );
              }),
            )
          : h('p', { class: 'rf-hint' }, t('onlyOwner')),
        h(
          'div',
          { class: 'rf-share-add' },
          h('input', { type: 'text', 'aria-label': t('addPerson'), placeholder: t('addPerson'), value: who, onInput: (event: Event) => setShare({ who: (event.target as HTMLInputElement).value }) }),
          roles(role, (next) => setShare({ role: next }), t('role')),
          h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: !who.trim() }, t('share')),
        ),
        !entry.shares?.some((s) => s.with === EVERYONE) && button(`+ ${t('everyone')} · ${roleName(role)}`, () => void add(EVERYONE), { class: 'rf-link' }),
        h('h3', { class: 'rf-sub' }, t('links')),
        entry.links?.length
          ? h(
              'ul',
              { class: 'rf-shares' },
              entry.links.map((link) => {
                const until = t('linkUntil', { date: formatDate(link.expires, locale) });
                return h(
                  'li',
                  { key: link.id },
                  icon('link', 16),
                  h('span', { class: 'rf-grow' }, until),
                  button(t('copyLink'), () => void attempt(async () => copy(await client.linkToken(of.id, link.id)), t('linkCopied')), {
                    class: 'rf-link',
                    'aria-label': `${t('copyLink')} · ${until}`,
                  }),
                  button(t('remove'), () => void attempt(() => client.removeLink(of.id, link.id)), { class: 'rf-link', 'aria-label': `${t('remove')} · ${until}` }),
                );
              }),
            )
          : h('p', { class: 'rf-hint' }, t('noLinks')),
        button(withIcon('link', t('createLink', { n: 7 })), () => void attempt(async () => copy((await client.createLink(of.id, 7)).token), t('linkCopied')), { class: 'rf-btn' }),
        actionsRow(button(t('done'), closeDialog, { class: 'rf-btn rf-primary' })),
      ),
    );
  }

  // ---- The viewer: a file shown whole over the drive, and the others of the view before and after it ----

  let viewing: EntryId | null = null;
  let zoomed = false;
  /** The whole text of a file, up to VIEW_LIMIT: null while it comes, an Error when it could not. */
  const fullTexts = new Map<string, string | null | Error>();
  /** The document shown in pages, to take down before the next, and to set out. */
  let shownDocument: { destroy(): void; pages?: number; layout?(mode: 'all' | 'pages'): void } | undefined;
  let documentLayout: 'all' | 'pages' = 'all';
  const undoDocument = () => {
    shownDocument?.destroy();
    shownDocument = undefined;
  };

  const view = (id: EntryId) => {
    viewing = id;
    zoomed = false;
    if (picked.size <= 1) select(id);
    afterRender.push(() => element.querySelector<HTMLElement>('.rf-view')?.focus());
    render();
  };
  const closeView = () => {
    undoDocument();
    const back = viewing;
    viewing = null;
    if (back && picked.size <= 1) select(back);
    afterRender.push(() => element.querySelector<HTMLElement>('.rf-items')?.focus());
    render();
  };

  /** All of a text, once: the beginning is not enough to read a file. */
  const fullText = (file: FileEntry, url: string | null) => {
    const key = `${file.id}:${file.versions[0].id}`;
    if (url && !fullTexts.has(key)) {
      fullTexts.set(key, null);
      fetch(url)
        .then(async (answer) => {
          if (!answer.ok) throw new Error(`${answer.status}`);
          const bytes = new Uint8Array(await answer.arrayBuffer());
          return new TextDecoder().decode(bytes.length > VIEW_LIMIT ? bytes.slice(0, VIEW_LIMIT) : bytes);
        })
        .then(
          (text) => (fullTexts.set(key, text), render()),
          (error: Error) => (fullTexts.set(key, error), render()),
        );
    }
    return fullTexts.get(key);
  };

  function viewed(file: FileEntry): Child {
    const kind = kindOf(file);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const none = (why = t('noPreview')) =>
      h(
        'div',
        { class: 'rf-view-none' },
        h('span', { class: `rf-tile rf-k-${kind} rf-tile-big`, 'aria-hidden': 'true' }, badgeOf(file)),
        h('p', null, why),
        button(withIcon('download', t('download')), () => void attempt(() => downloadEach([file])), { class: 'rf-btn rf-primary' }),
      );
    if (kind === 'image') {
      const url = urlOf(file, 2048);
      return url
        ? h(
            'div',
            { class: `rf-view-image${zoomed ? ' rf-zoomed' : ''}` },
            h('img', { key: url, src: url, alt: file.name, onClick: () => ((zoomed = !zoomed), render()), title: zoomed ? t('fit') : t('zoom') }),
          )
        : h('div', { class: 'rf-view-wait' }, t('loading'));
    }
    if (kind === 'pdf' || kind === 'video' || kind === 'audio') {
      const url = urlOf(file);
      if (!url) return h('div', { class: 'rf-view-wait' }, t('loading'));
      if (kind === 'pdf') return h('iframe', { key: url, class: 'rf-view-pdf', src: url, title: file.name });
      if (kind === 'video') return h('video', { key: url, class: 'rf-view-video', src: url, controls: true, preload: 'metadata' });
      return h(
        'div',
        { class: 'rf-view-audio' },
        h('span', { class: 'rf-tile rf-k-audio rf-tile-big', 'aria-hidden': 'true' }, badgeOf(file)),
        h('audio', { key: url, src: url, controls: true, preload: 'metadata' }),
      );
    }
    const reads = kind === 'text' || ext === 'csv' || ext === 'tsv';
    if (reads && file.versions[0].size > VIEW_LIMIT * 5) return none(t('tooLargeToShow'));
    if (reads) {
      const text = fullText(file, urlOf(file));
      if (text === undefined || text === null) return h('div', { class: 'rf-view-wait' }, t('loading'));
      if (text instanceof Error) return none(t('couldNotRead'));
      const cut = file.versions[0].size > VIEW_LIMIT && h('p', { class: 'rf-view-cut' }, t('shownFirst', { size: formatSize(VIEW_LIMIT, locale) }));
      if (ext === 'md' || ext === 'markdown') return h('div', { class: 'rf-view-doc' }, h('article', { class: 'rf-view-sheet' }, markdown(text)), cut);
      if (ext === 'csv' || ext === 'tsv') {
        const rows = rowsOf(text, ext === 'tsv' ? '\t' : ',');
        const [first = [], ...rest] = rows;
        return h(
          'div',
          { class: 'rf-view-table' },
          h(
            'table',
            null,
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                first.map((cell) => h('th', { scope: 'col' }, cell)),
              ),
            ),
            h(
              'tbody',
              null,
              rest.map((row) =>
                h(
                  'tr',
                  null,
                  row.map((cell) => h('td', null, cell)),
                ),
              ),
            ),
          ),
          rows.length >= 1000 && h('p', { class: 'rf-view-cut' }, t('shownRows', { n: 1000 })),
        );
      }
      let shown = text;
      if (ext === 'json') {
        try {
          shown = JSON.stringify(JSON.parse(text), null, 2);
        } catch {}
      }
      return h('div', { class: 'rf-view-code' }, h('pre', null, shown), cut);
    }
    if (kind === 'docx' && (options.viewDocument || options.previewDocument)) {
      const url = urlOf(file);
      if (!url) return h('div', { class: 'rf-view-wait' }, t('loading'));
      if (options.viewDocument) {
        const show = options.viewDocument;
        // Its pages, by Rebodocs' engine, in an element of its own that the drive does not draw again.
        return h('div', {
          key: `doc:${url}`,
          class: 'rf-view-pages',
          'data-own': true,
          mount: (node: HTMLElement) => {
            undoDocument();
            fetch(url)
              .then((answer) => answer.arrayBuffer())
              .then((bytes) => show(node, new Uint8Array(bytes)))
              .then(
                (shown) => {
                  const handle = typeof shown === 'function' ? { destroy: shown } : shown;
                  if (viewing !== file.id) return handle?.destroy();
                  shownDocument = handle;
                  if (documentLayout !== 'all') handle?.layout?.(documentLayout);
                  render();
                },
                () => node.replaceChildren(h('p', { class: 'rf-view-cut' }, t('couldNotRead'))),
              );
          },
        });
      }
      preview(file);
      const page = pages.get(`${file.id}:${file.versions[0].id}`);
      return page
        ? h(
            'div',
            { class: 'rf-view-doc' },
            h(
              'article',
              { class: 'rf-view-sheet' },
              page.title && h('h1', null, page.title),
              page.paragraphs.map((p) => h('p', null, p)),
            ),
            h('p', { class: 'rf-view-cut' }, t('firstParagraphs')),
          )
        : h('div', { class: 'rf-view-wait' }, t('loading'));
    }
    return none();
  }

  function viewer(id: EntryId) {
    const files = shownEntries.filter((entry): entry is FileEntry => entry.kind === 'file');
    const at = files.findIndex((entry) => entry.id === id);
    const file = files[at];
    if (!file) {
      // Gone from the view, by a change made meanwhile.
      queueMicrotask(closeView);
      return null;
    }
    const step = (by: number) => {
      const next = files[(at + by + files.length) % files.length];
      if (next && next.id !== id) {
        undoDocument();
        view(next.id);
      }
    };
    const kind = kindOf(file);
    return h(
      'section',
      {
        key: 'viewer',
        class: 'rf-view',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': file.name,
        tabindex: '-1',
        onKeydown: (event: KeyboardEvent) => {
          const inside = (event.target as HTMLElement).closest('video, audio, input, select, textarea, .rf-view-pages');
          if (event.key === 'Escape') event.stopPropagation(), closeView();
          else if (!inside && event.key === 'ArrowRight') event.preventDefault(), step(1);
          else if (!inside && event.key === 'ArrowLeft') event.preventDefault(), step(-1);
        },
      },
      h(
        'div',
        { class: 'rf-view-bar' },
        button(icon('back', 18), closeView, { class: 'rf-btn rf-icon', 'aria-label': t('backToDrive'), title: t('backToDrive') }),
        h('span', { class: `rf-tile rf-k-${kind}`, 'aria-hidden': 'true' }, badgeOf(file)),
        h('div', { class: 'rf-view-title' }, h('strong', null, file.name), h('span', null, `${formatSize(file.versions[0].size, locale)} · ${formatDate(file.modified, locale)} · ${file.modifiedBy}`)),
        files.length > 1 && h('span', { class: 'rf-view-count', 'aria-live': 'polite' }, t('nOfM', { n: at + 1, m: files.length })),
        kind === 'docx' &&
          shownDocument?.layout && [
            shownDocument.pages !== undefined && h('span', { class: 'rf-view-count' }, shownDocument.pages === 1 ? t('onePage') : t('pagesN', { n: shownDocument.pages })),
            h(
              'div',
              { class: 'rf-view-seg', role: 'group', 'aria-label': t('pagesShown') },
              (
                [
                  ['all', t('allPages')],
                  ['pages', t('oneByOne')],
                ] as const
              ).map(([mode, label]) =>
                button(
                  label,
                  () => {
                    documentLayout = mode;
                    shownDocument?.layout?.(mode);
                    render();
                  },
                  { key: mode, 'aria-pressed': documentLayout === mode },
                ),
              ),
            ),
          ],
        options.onOpenDocument &&
          kind === 'docx' &&
          button(withIcon('doc', t('openInRebodocs')), () => void attempt(async () => options.onOpenDocument?.(file, await client.url(file.id, { inline: true }))), {
            class: 'rf-btn rf-docs rf-small',
          }),
        button(icon('download', 18), () => void attempt(() => downloadEach([file])), { class: 'rf-btn rf-icon', 'aria-label': t('download'), title: t('download') }),
        button(icon('external', 18), () => void openInTab(file), { class: 'rf-btn rf-icon', 'aria-label': t('openInTab'), title: t('openInTab') }),
        button(icon('close', 18), closeView, { class: 'rf-btn rf-icon', 'aria-label': t('close'), title: t('close') }),
      ),
      h(
        'div',
        { class: 'rf-view-stage' },
        files.length > 1 && button(icon('back', 22), () => step(-1), { class: 'rf-view-step rf-view-prev', 'aria-label': t('previous'), title: t('previous') }),
        h('div', { key: file.id, class: 'rf-view-content' }, viewed(file)),
        files.length > 1 && button(icon('chevron', 22), () => step(1), { class: 'rf-view-step rf-view-next', 'aria-label': t('next'), title: t('next') }),
      ),
    );
  }

  // ---- The settings: a screen of their own over the drive, as Rebodocs' menu is over a document ----

  type SettingsPart = 'language' | 'appearance' | 'pictures';
  let settingsPart: SettingsPart | null = null;
  let settingsNote: { text: string; error: boolean } | null = null;
  /** What is typed in the sizes, before it is saved. */
  let typedSizes: string[] = [];
  let gear: HTMLElement | null = null;

  const openSettings = () => {
    if (!settings) return;
    settingsPart = 'language';
    settingsNote = null;
    typedSizes = settings.drive.images.sizes.map(String);
    afterRender.push(() => element.querySelector<HTMLElement>('.rf-set-tab[aria-selected="true"]')?.focus());
    render();
  };
  const closeSettings = () => {
    settingsPart = null;
    afterRender.push(() => gear?.focus());
    render();
  };
  /** A change saved at once, as it is made: what the server says of it is said in the screen. */
  const saveSetting = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await loadSettings();
      settingsNote = { text: t('settingsSaved'), error: false };
      options.onChange?.();
    } catch (error) {
      settingsNote = { text: (error as Error).message, error: true };
    }
    render();
  };
  const saveMine = (change: PersonalSettings) => void saveSetting(() => client.saveMySettings({ ...settings!.mine, ...change }));
  const saveDrive = (change: Partial<Omit<DriveSettings, 'images'>> & { images?: Partial<DriveSettings['images']> }) => void saveSetting(() => client.saveSettings(change));

  /** Choices as buttons side by side, the one in use pressed. */
  const segmented = <T extends string>(label: string, value: T, choices: [T, string][], onChoose: (value: T) => void) =>
    h(
      'div',
      { class: 'rf-set-seg', role: 'group', 'aria-label': label },
      choices.map(([v, text]) => button(text, () => v !== value && onChoose(v), { key: v, 'aria-pressed': v === value })),
    );
  const field = (label: string, hint: string | null, ...content: Child[]) =>
    h('div', { class: 'rf-set-field' }, h('div', { class: 'rf-set-label' }, label), hint && h('p', { class: 'rf-set-hint' }, hint), ...content);

  const PRESETS = ['#0b57d0', '#7c3aed', '#c026d3', '#dc2626', '#ea580c', '#a16207', '#0f766e', '#334155'];

  function settingsScreen(part: SettingsPart) {
    const answer = settings!;
    const { mine, drive, canConfigure } = answer;
    const languages: ['en' | 'es', string][] = [
      ['en', 'English'],
      ['es', 'Español'],
    ];
    const themes: ['light' | 'dark' | 'auto', string][] = [
      ['light', t('themeLight')],
      ['dark', t('themeDark')],
      ['auto', t('themeAuto')],
    ];
    const parts: [SettingsPart, IconName, string][] = [
      ['language', 'globe', t('language')],
      ['appearance', 'contrast', t('appearance')],
      ...(canConfigure ? ([['pictures', 'image', t('pictures')]] as [SettingsPart, IconName, string][]) : []),
    ];
    const show = (next: SettingsPart) => {
      settingsPart = next;
      settingsNote = null;
      afterRender.push(() => element.querySelector<HTMLElement>('.rf-set-tab[aria-selected="true"]')?.focus());
      render();
    };
    const tabKeys = (event: KeyboardEvent) => {
      const at = parts.findIndex(([id]) => id === part);
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      show(parts[(at + step + parts.length) % parts.length][0]);
    };
    const forEveryone = (...content: Child[]) =>
      canConfigure &&
      h(
        'section',
        { class: 'rf-set-group', 'aria-labelledby': `${prefix}-everyone-${part}` },
        h('h3', { id: `${prefix}-everyone-${part}` }, t('forEveryone')),
        h('p', { class: 'rf-set-hint' }, t('forEveryoneHint')),
        ...content,
      );
    const forYou = (...content: Child[]) => h('section', { class: 'rf-set-group', 'aria-labelledby': `${prefix}-you-${part}` }, h('h3', { id: `${prefix}-you-${part}` }, t('forYou')), ...content);

    let body: Child;
    let intro = '';
    if (part === 'language') {
      intro = t('languageIntro');
      body = [
        forYou(
          field(
            t('language'),
            null,
            segmented(t('language'), mine.language ?? '', [['', t('driveDefault')], ...languages], (v) => saveMine({ language: v || undefined })),
          ),
        ),
        forEveryone(
          field(
            t('language'),
            null,
            segmented(`${t('language')} · ${t('forEveryone')}`, drive.language, languages, (v) => saveDrive({ language: v })),
          ),
        ),
      ];
    } else if (part === 'appearance') {
      intro = t('appearanceIntro');
      const low = drive.brand !== null && contrastOnWhite(drive.brand) < 4.5;
      body = [
        forYou(
          field(
            t('theme'),
            null,
            segmented(t('theme'), mine.theme ?? '', [['', t('driveDefault')], ...themes], (v) => saveMine({ theme: v || undefined })),
          ),
        ),
        forEveryone(
          field(
            t('theme'),
            null,
            segmented(`${t('theme')} · ${t('forEveryone')}`, drive.theme, themes, (v) => saveDrive({ theme: v })),
          ),
          field(
            t('brandColour'),
            t('brandHint'),
            h(
              'div',
              { class: 'rf-swatches', role: 'group', 'aria-label': t('brandColour') },
              button(h('span', { class: 'rf-swatch rf-swatch-own' }), () => drive.brand !== null && saveDrive({ brand: null }), {
                key: 'own',
                'aria-pressed': drive.brand === null,
                'aria-label': t('defaultColour'),
                title: t('defaultColour'),
              }),
              PRESETS.map((hex) =>
                button(h('span', { class: 'rf-swatch', style: `background: ${hex}` }), () => drive.brand !== hex && saveDrive({ brand: hex }), {
                  key: hex,
                  'aria-pressed': drive.brand === hex,
                  'aria-label': hex,
                  title: hex,
                }),
              ),
              h(
                'label',
                { class: 'rf-swatch-custom', title: t('customColour') },
                h('span', { class: 'rf-sr' }, t('customColour')),
                h('input', { type: 'color', value: drive.brand ?? '#0e7c52', onChange: (event: Event) => saveDrive({ brand: (event.target as HTMLInputElement).value }) }),
              ),
            ),
            low && h('p', { class: 'rf-set-hint rf-set-warn' }, t('lowContrast')),
          ),
        ),
      ];
    } else {
      intro = t('picturesIntro');
      const images = drive.images;
      const names = [t('sizeThumb'), t('sizeSmall'), t('sizeMedium'), t('sizeLarge')];
      const commitSizes = () => {
        const sizes = typedSizes.map(Number);
        if (sizes.join() !== images.sizes.join()) saveDrive({ images: { sizes } });
      };
      body = [
        h(
          'label',
          { class: 'rf-set-switch' },
          h('input', { type: 'checkbox', role: 'switch', checked: images.enabled, onChange: (event: Event) => saveDrive({ images: { enabled: (event.target as HTMLInputElement).checked } }) }),
          h('span', null, h('strong', null, t('makeSmaller')), h('small', null, t('originalKept'))),
        ),
        images.enabled && [
          field(
            t('sizes'),
            t('sizesHint'),
            h(
              'div',
              { class: 'rf-set-sizes' },
              names.map((name, i) =>
                h(
                  'label',
                  { key: `size${i}`, class: 'rf-set-size' },
                  h('span', { class: 'rf-set-frame', style: `--rf-frame: ${18 + i * 12}px`, 'aria-hidden': 'true' }),
                  h('span', null, name),
                  h(
                    'span',
                    { class: 'rf-set-px' },
                    h('input', {
                      type: 'number',
                      min: '16',
                      max: '8192',
                      'aria-label': `${name}, ${t('pixels')}`,
                      value: typedSizes[i] ?? '',
                      onInput: (event: Event) => (typedSizes[i] = (event.target as HTMLInputElement).value),
                      onChange: commitSizes,
                    }),
                    'px',
                  ),
                ),
              ),
            ),
          ),
          field(
            t('format'),
            null,
            h(
              'div',
              { class: 'rf-set-cards', role: 'group', 'aria-label': t('format') },
              button([h('strong', null, 'JPG'), h('small', null, t('asJpg'))], () => images.format !== 'jpeg' && saveDrive({ images: { format: 'jpeg' } }), {
                key: 'jpeg',
                'aria-pressed': images.format === 'jpeg',
              }),
              button([h('strong', null, t('original')), h('small', null, t('keepType'))], () => images.format !== 'original' && saveDrive({ images: { format: 'original' } }), {
                key: 'original',
                'aria-pressed': images.format === 'original',
              }),
            ),
          ),
          field(
            `${t('quality')} · ${Math.round(images.quality * 100)}%`,
            t('qualityHint'),
            h('input', {
              class: 'rf-set-range',
              type: 'range',
              min: '10',
              max: '100',
              step: '1',
              'aria-label': t('quality'),
              value: String(Math.round(images.quality * 100)),
              onChange: (event: Event) => saveDrive({ images: { quality: Number((event.target as HTMLInputElement).value) / 100 } }),
            }),
          ),
        ],
      ];
    }

    const current = parts.find(([id]) => id === part)!;
    return h(
      'section',
      {
        key: 'settings',
        class: 'rf-set',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('settings'),
        onKeydown: (event: KeyboardEvent) => event.key === 'Escape' && (event.stopPropagation(), closeSettings()),
      },
      h(
        'nav',
        { class: 'rf-set-nav', 'aria-label': t('settings') },
        button([icon('back', 18), h('span', null, t('backToDrive'))], closeSettings, { class: 'rf-set-back' }),
        h(
          'div',
          { class: 'rf-set-tabs', role: 'tablist', 'aria-orientation': 'vertical', onKeydown: tabKeys },
          parts.map(([id, iconName, label]) =>
            button([icon(iconName, 18), label], () => show(id), {
              key: id,
              class: 'rf-set-tab',
              role: 'tab',
              id: `${prefix}-set-${id}`,
              'aria-selected': id === part,
              'aria-controls': `${prefix}-set-pane`,
              tabindex: id === part ? '0' : '-1',
            }),
          ),
        ),
        h('div', { class: 'rf-set-card' }, h('strong', null, options.title ?? 'Files'), h('span', null, storage || ' ')),
      ),
      h(
        'div',
        { class: 'rf-set-main' },
        button(icon('close', 20), closeSettings, { class: 'rf-set-x', 'aria-label': t('close'), title: t('close') }),
        h(
          'div',
          { class: 'rf-set-pane', id: `${prefix}-set-pane`, role: 'tabpanel', 'aria-labelledby': `${prefix}-set-${current[0]}` },
          h('h2', null, current[2]),
          intro && h('p', { class: 'rf-set-intro' }, intro),
          body,
          h('p', { class: `rf-set-note${settingsNote?.error ? ' rf-set-warn' : ''}`, role: 'status' }, settingsNote?.text ?? ''),
        ),
      ),
    );
  }

  function dialogs() {
    if (!dialog) return null;
    switch (dialog.kind) {
      case 'folder': {
        const into = folder;
        return nameDialog(t('newFolder'), t('folderName'), '', t('create'), dialog.name, (name) => void attempt(() => client.createFolder(name, into).then((made) => (selected = made.id))));
      }
      case 'rename': {
        const { entry } = dialog;
        return nameDialog(t('rename'), t('newName'), entry.name, t('save'), dialog.name, (name) => void attempt(() => client.rename(entry.id, name)));
      }
      case 'move':
        return moveDialog(dialog.entries, dialog.at);
      case 'share':
        return shareDialog(dialog.entry, dialog.who, dialog.role);
      case 'delete': {
        const gone = dialog.entries;
        const text = gone.length === 1 ? t('confirmDelete', { name: gone[0].name }) : t('confirmDeleteMany', { n: gone.length });
        return confirmDialog(text, t('deleteForever'), () => void each(gone, (entry) => client.deleteForever(entry.id), 'deletedMany'));
      }
      case 'empty':
        return confirmDialog(t('confirmEmpty'), t('emptyTrash'), () => void attempt(() => client.emptyTrash().then(() => (selected = null)), t('deleted')));
    }
  }

  // ---- The screen, and rendering it ----

  let afterRender: (() => void)[] = [];
  let scrolledTo: EntryId | null = null;

  function screen() {
    const key = JSON.stringify(viewOf());
    const { value, loading, error } = listing(key);
    const entries = value?.entries ?? [];
    const path = value?.path ?? [];
    shownEntries = entries;
    const pickedEntries = entries.filter((entry) => picked.has(entry.id));
    const selectedEntry = pickedEntries.length > 1 ? null : (entries.find((entry) => entry.id === selected) ?? null);
    const sending = uploads.find((u) => u.state === 'sending' || u.state === 'waiting');
    const failed = uploads.find((u) => u.state === 'failed');
    const heading = query ? t('resultsFor', { q: query }) : section === 'recent' ? t('recent') : section === 'shared' ? t('sharedWithMe') : section === 'trash' ? t('trash') : null;
    const count = entries.length === 1 ? t('item') : t('items', { n: entries.length });
    const title = options.title ?? 'Files';
    const nav = (name: IconName, text: string, current: boolean, onClick: () => void, extra: Record<string, unknown> = {}) =>
      h('button', { type: 'button', class: 'rf-nav', 'aria-current': current, onClick, ...extra }, icon(name), text);
    if (selected !== scrolledTo) {
      scrolledTo = selected;
      if (selected) afterRender.push(() => element.querySelector(`[data-id="${quoted(selected!)}"]`)?.scrollIntoView({ block: 'nearest' }));
    }

    return h(
      'div',
      { class: `rf-drive${options.className ? ` ${options.className}` : ''}`, 'data-theme': themeNow(), 'data-rf': prefix },
      h('style', null, CSS),
      // Its own element for each colour: a stylesheet is not walked by morph, so another colour is another element.
      settings?.settings.brand ? h('style', { key: `brand${settings.settings.brand}` }, brandStyle(`.rf-drive[data-rf="${prefix}"]`, settings.settings.brand)) : null,
      h(
        'div',
        { class: 'rf-top', inert: Boolean(settingsPart || viewing) },
        h('div', { class: 'rf-title' }, options.logo ?? mark(), h('span', null, title)),
        h(
          'label',
          { class: 'rf-search' },
          icon('search'),
          h('span', { class: 'rf-sr' }, t('search')),
          h('input', {
            type: 'search',
            value: typed,
            placeholder: t('search'),
            onInput: (event: Event) => setTyped((event.target as HTMLInputElement).value),
            onKeydown: (event: KeyboardEvent) => event.key === 'Escape' && setTyped(''),
          }),
          typed && button(icon('close', 16), () => setTyped(''), { 'aria-label': t('cancel') }),
        ),
        settings &&
          button(icon('settings'), openSettings, { class: 'rf-gear', 'aria-label': t('settings'), title: t('settings'), 'aria-haspopup': 'dialog', mount: (node: HTMLElement) => (gear = node) }),
      ),
      h(
        'div',
        { class: 'rf-body', inert: Boolean(settingsPart || viewing) },
        h(
          'nav',
          { class: 'rf-side', 'aria-label': title },
          newMenu(section !== 'files' || Boolean(query)),
          h('input', {
            class: 'rf-file',
            type: 'file',
            multiple: true,
            hidden: true,
            onChange: (event: Event) => {
              const input = event.target as HTMLInputElement;
              if (input.files) uploadInto(input.files, folder);
              input.value = '';
            },
          }),
          nav('drive', t('myFiles'), section === 'files' && from === 'files' && !query, () => go('files'), dropTarget(null)),
          nav('users', t('sharedWithMe'), (section === 'shared' || (section === 'files' && from === 'shared')) && !query, () => go('shared')),
          nav('clock', t('recent'), section === 'recent' && !query, () => go('recent')),
          nav('trash', t('trash'), section === 'trash' && !query, () => go('trash'), {
            onDragover: (event: DragEvent) => event.dataTransfer?.types.includes(DRAGGED) && (event.preventDefault(), (event.currentTarget as HTMLElement).classList.add('rf-drop')),
            onDragleave: (event: DragEvent) => (event.currentTarget as HTMLElement).classList.remove('rf-drop'),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement).classList.remove('rf-drop');
              const gone = dragged(event);
              if (gone.length) void each(gone, (entry) => client.moveToTrash(entry.id), 'trashedMany');
            },
          }),
          storage && h('div', { class: 'rf-storage' }, t('location'), h('code', null, storage)),
        ),
        h(
          'main',
          {
            class: 'rf-main',
            onDragover: (event: DragEvent) => {
              if (section !== 'files' || query || !event.dataTransfer?.types.includes('Files')) return;
              event.preventDefault();
              if (!dropping) (dropping = true), render();
            },
            onDragleave: (event: DragEvent) => !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node) && ((dropping = false), render()),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              dropping = false;
              if (section === 'files' && !query && event.dataTransfer?.files.length) uploadInto(event.dataTransfer.files, folder);
              render();
            },
          },
          pickedEntries.length > 1
            ? pickedBar(pickedEntries)
            : h(
                'div',
                { key: 'head', class: 'rf-head' },
                h(
                  'div',
                  { class: 'rf-crumbs' },
                  heading
                    ? h('h2', { class: 'rf-crumb', style: 'margin: 0' }, heading)
                    : [
                        from === 'shared'
                          ? button(t('sharedWithMe'), () => go('shared'), { class: 'rf-crumb', key: 'from-shared' })
                          : button(t('myFiles'), () => go('files'), { class: 'rf-crumb', key: 'from-files', ...dropTarget(null) }),
                        path.map((step) =>
                          h(
                            'span',
                            { key: step.id, style: 'display: contents' },
                            icon('chevron', 16),
                            button(step.name, () => go('files', step.id), { class: 'rf-crumb', 'aria-current': step.id === folder ? 'page' : undefined, ...dropTarget(step.id) }),
                          ),
                        ),
                      ],
                ),
                section === 'trash' && entries.length > 0 && !query && button(t('emptyTrash'), () => ((dialog = { kind: 'empty' }), render()), { class: 'rf-btn rf-danger' }),
                h(
                  'div',
                  { class: 'rf-seg', role: 'group', 'aria-label': `${t('list')} / ${t('grid')}` },
                  button(icon('list'), () => ((layout = 'list'), render()), { 'aria-pressed': layout === 'list', 'aria-label': t('list'), title: t('list') }),
                  button(icon('grid'), () => ((layout = 'grid'), render()), { 'aria-pressed': layout === 'grid', 'aria-label': t('grid'), title: t('grid') }),
                ),
              ),
          items(
            entries,
            loading,
            error,
            query ? t('noResults') : section === 'trash' ? t('trashIsEmpty') : section === 'recent' ? t('noRecent') : section === 'shared' ? t('noShared') : t('emptyFolder'),
          ),
          dropping && h('div', { class: 'rf-dropzone' }, t('dropHere')),
        ),
        pickedEntries.length > 1 ? pickedDetails(pickedEntries) : details(selectedEntry),
      ),
      // Said once a view has loaded: where one is and how much is there. Not the progress of an upload, which would be read out at every step.
      h('span', { class: 'rf-sr', 'aria-live': 'polite' }, loading ? '' : `${heading ?? path.at(-1)?.name ?? t('myFiles')} · ${count}`),
      h(
        'div',
        { class: 'rf-status', inert: Boolean(settingsPart || viewing) },
        h('span', { class: 'rf-grow' }, count, storage && h('span', { class: 'rf-where' }, ` · ${storage}`)),
        sending
          ? [
              h('span', null, t('uploading', { name: sending.name, pct: Math.round((sending.sent / Math.max(1, sending.size)) * 100) })),
              h(
                'span',
                {
                  class: 'rf-bar',
                  role: 'progressbar',
                  'aria-label': sending.name,
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                  'aria-valuenow': String(Math.round((sending.sent / Math.max(1, sending.size)) * 100)),
                },
                h('span', { style: `width: ${(sending.sent / Math.max(1, sending.size)) * 100}%` }),
              ),
            ]
          : failed
            ? [
                h(
                  'span',
                  { class: 'rf-error', role: 'alert' },
                  failed.sent > 0 ? t('uploadCut', { name: failed.name, pct: Math.round((failed.sent / Math.max(1, failed.size)) * 100) }) : `${failed.name}: ${failed.error}`,
                ),
                failed.retry && h('button', { type: 'button', class: 'rf-retry', onClick: failed.retry }, t('tryAgain')),
              ]
            : null,
      ),
      toast && h('div', { class: 'rf-toast', role: 'status' }, toast),
      dialogs(),
      viewing && viewer(viewing),
      settingsPart && settings && settingsScreen(settingsPart),
    );
  }

  let scheduled = false;
  let mountedOnce = false;
  function render() {
    if (scheduled || !alive) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!alive) return;
      const tree = screen();
      if (!mountedOnce || !element.firstElementChild) {
        mountedOnce = true;
        first(element, tree);
      } else morph(element.firstElementChild, tree);
      const after = afterRender;
      afterRender = [];
      for (const run of after) run();
    });
  }

  const closeMenu = (event: MouseEvent) => {
    if (menuOpen && !element.querySelector('.rf-menu')?.contains(event.target as Node) && !element.querySelector('.rf-new')?.contains(event.target as Node)) {
      menuOpen = false;
      render();
    }
  };
  document.addEventListener('mousedown', closeMenu);

  client.info().then(
    (info) => ((storage = info.storage), render()),
    () => undefined,
  );
  void loadSettings();
  render();

  return {
    client,
    update(next) {
      options = { ...options, ...next };
      retranslate();
      render();
    },
    refresh() {
      revision++;
      void loadSettings();
      render();
    },
    destroy() {
      alive = false;
      clearTimeout(toastTimer);
      clearTimeout(searchTimer);
      document.removeEventListener('mousedown', closeMenu);
      element.replaceChildren();
    },
  };
}
