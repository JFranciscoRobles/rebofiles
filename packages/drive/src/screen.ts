// The whole drive, without a framework: a bar with the search, the sections
// beside, the list or the grid of a folder, the details of what is selected,
// and a bar of status. Mounted on an element, it renders itself again after
// each change, and `morph` changes only what differs, so the focus, a
// selection and what is scrolled stay where they were.
//
//   const drive = mountDrive(document.getElementById('files')!, { base: '/api/files' });
//   drive.destroy();

import { EVERYONE, type Entry, type EntryId, type FileEntry, type FolderEntry, type Role, versionNumber } from '@rebofiles/core';
import { type DriveClient, RequestError, createDriveClient } from './client';
import { type Child, first, h, morph } from './dom';
import { TEXTS, type Texts, type Translate, formatDate, formatSize, translator } from './i18n';
import { type IconName, icon, logo as mark } from './icons';
import { type DocumentPreview, badgeOf, kindOf } from './kinds';
import { CSS } from './styles';

export interface DriveOptions {
  /** Where the routes of @rebofiles/server are: `/api/files` unless said. */
  base?: string;
  /** A client of your own, instead of `base`: the drive kept in the page, or one shared with the rest of the page. */
  client?: DriveClient;
  /** Headers for every request to the server, such as a token of the session. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  language?: 'en' | 'es';
  /** Texts of another language, with the keys of the English ones. */
  texts?: Texts;
  /** The name over the drive: the application's, or "Files". */
  title?: string;
  /** What goes before the title; ReboFiles' mark unless given. */
  logo?: Node;
  defaultView?: 'list' | 'grid';
  /** A file opened with a double click or Enter. Unless given, it opens in a new tab, as the browser shows it. */
  onOpen?: (file: FileEntry, url: string) => void;
  /** Gives Word documents an "Open in Rebodocs" button, which calls this with an address to read the file from. */
  onOpenDocument?: (file: FileEntry, url: string) => void;
  /** Reads a Word document for its preview: `previewDocx` of `@rebofiles/drive/rebodocs`, or one of your own. */
  previewDocument?: (bytes: Uint8Array) => DocumentPreview | Promise<DocumentPreview>;
  /** The address a link of the drive is given: your page that shows it with `mountSharedLink`. This page with `?link=` unless given. */
  linkAddress?: (token: string) => string;
  /** Light (the default), dark, or as the system is (`'auto'`). */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  /** Called after every change made from the drive, for what else in the page shows it to ask again. */
  onChange?: () => void;
}

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
  | { kind: 'move'; entry: Entry; at: EntryId | null }
  | { kind: 'share'; entry: Entry; who: string; role: Role }
  | { kind: 'delete'; entry: Entry }
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
const ROLES: Role[] = ['viewer', 'commenter', 'editor'];
const defaultAddress = (token: string) => `${location.origin}${location.pathname}?link=${encodeURIComponent(token)}`;
/** An id inside a selector's quotes. */
const quoted = (text: string) => text.replace(/["\\]/g, '\\$&');

let mounts = 0;

export function mountDrive(element: HTMLElement, given: DriveOptions = {}): MountedDrive {
  let options = given;
  const client = options.client ?? createDriveClient({ base: options.base ?? '/api/files', headers: () => options.headers?.() ?? {} });
  const prefix = `rf${++mounts}`;
  let t: Translate = translator(options.texts ?? TEXTS[options.language ?? 'en']);
  let locale = options.language ?? 'en';

  // What is shown, as the hooks of @rebofiles/react keep it.
  let section: Section = 'files';
  let folder: EntryId | null = null;
  let from: 'files' | 'shared' = 'files';
  let selected: EntryId | null = null;
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
  const urlOf = (file: FileEntry): string | null => {
    const key = `${file.id}:${file.versions[0].id}`;
    if (!inline.has(key)) {
      inline.set(key, null);
      client.url(file.id, { inline: true }).then(
        (url) => (inline.set(key, url), render()),
        () => undefined,
      );
    }
    return inline.get(key) ?? null;
  };
  const texts = new Map<string, string | null>();
  const pages = new Map<string, DocumentPreview | null>();

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
  const select = (id: EntryId | null) => {
    if (id !== selected) tab = 'details';
    selected = id;
    render();
  };

  const open = async (entry: Entry) => {
    if (entry.kind === 'folder') {
      if (section === 'trash') return;
      return go('files', entry.id);
    }
    // A window opened before the address is known, so the browser takes it as the click's.
    const tabOpened = options.onOpen ? null : window.open('about:blank', '_blank');
    try {
      const url = await client.url(entry.id, { inline: true });
      if (options.onOpen) options.onOpen(entry, url);
      else if (tabOpened) tabOpened.location.href = url;
    } catch (error) {
      tabOpened?.close();
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
          try {
            const entry = await client.upload(file, { parent, onProgress: ({ sent }) => set(id, { sent }) });
            set(id, { state: 'done', sent: file.size });
            selected = entry.id;
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
      const moved = event.dataTransfer?.getData(DRAGGED);
      if (moved && moved !== target) void attempt(() => client.move(moved, target));
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
      if (event.key in step) {
        event.preventDefault();
        const next = index < 0 ? 0 : Math.min(entries.length - 1, Math.max(0, index + step[event.key]));
        if (entries[next]) select(entries[next].id);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const next = event.key === 'Home' ? entries[0] : entries[entries.length - 1];
        if (next) select(next.id);
      } else if (event.key === 'Enter' && current) {
        event.preventDefault();
        void open(current);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && current) {
        event.preventDefault();
        if (section !== 'trash') void attempt(() => client.moveToTrash(current.id), t('movedToTrash', { name: current.name }));
      } else if (event.key === 'F2' && current) {
        event.preventDefault();
        if (section !== 'trash') (dialog = { kind: 'rename', entry: current, name: current.name }), render();
      } else if (event.key === 'Escape') select(null);
    };
    const item = (entry: Entry, className: string, ...children: Child[]) =>
      h(
        'div',
        {
          key: entry.id,
          class: className,
          id: `${prefix}-${entry.id}`,
          'data-id': entry.id,
          role: 'option',
          'aria-selected': entry.id === selected,
          draggable: draggable ? 'true' : 'false',
          onClick: () => select(entry.id),
          onDblclick: () => void open(entry),
          onDragstart: (event: DragEvent) => {
            event.dataTransfer?.setData(DRAGGED, entry.id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          },
          ...(entry.kind === 'folder' && section === 'files' ? dropTarget(entry.id) : {}),
        },
        ...children,
      );
    return h(
      'div',
      {
        class: 'rf-items',
        role: 'listbox',
        'aria-label': t('name'),
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
                h('span', { class: 'rf-name' }, tile(entry), h('span', null, entry.name)),
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
              const url = kind === 'image' ? urlOf(entry as FileEntry) : null;
              return item(
                entry,
                'rf-card',
                h('div', { class: `rf-thumb rf-k-${kind}` }, url ? h('img', { src: url, alt: '', loading: 'lazy' }) : icon(entry.kind === 'folder' ? 'folder' : 'doc', 34)),
                h('div', { class: 'rf-name' }, tile(entry), h('span', null, entry.name)),
              );
            }),
          ),
    );
  }

  function preview(file: FileEntry) {
    const kind = kindOf(file);
    const reads = kind === 'text' || (kind === 'docx' && options.previewDocument && file.versions[0].size <= PREVIEW_LIMIT);
    const url = kind === 'image' || kind === 'pdf' || reads ? urlOf(file) : null;
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
                button(t('deleteForever'), () => ((dialog = { kind: 'delete', entry }), render()), { class: 'rf-btn rf-text rf-danger' }),
              ]
            : [
                file &&
                  options.onOpenDocument &&
                  kindOf(file) === 'docx' &&
                  button(withIcon('doc', t('openInRebodocs')), () => void attempt(async () => options.onOpenDocument?.(file, await client.url(file.id, { inline: true }))), {
                    class: 'rf-btn rf-docs rf-wide',
                  }),
                file && button(withIcon('download', t('download')), () => void attempt(download), { class: 'rf-btn' }),
                button(withIcon('external', t('open')), () => void open(entry), { class: 'rf-btn' }),
                button(withIcon('pencil', t('rename')), () => ((dialog = { kind: 'rename', entry, name: entry.name }), render()), { class: 'rf-btn' }),
                button(withIcon('move', t('move')), () => ((dialog = { kind: 'move', entry, at: null }), (movedInto = false), render()), { class: 'rf-btn' }),
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
  function moveDialog(entry: Entry, at: EntryId | null) {
    const listed = moving(JSON.stringify(at));
    const folders = (listed.value?.entries ?? []).filter((e): e is FolderEntry => e.kind === 'folder');
    const path = listed.value?.path ?? [];
    const label = t('moveTo', { name: entry.name });
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
            void attempt(() => client.move(entry.id, at));
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
              button([h('span', { class: 'rf-tile rf-k-folder', 'aria-hidden': 'true' }, icon('folder', 16)), f.name], () => goTo(f.id), { disabled: f.id === entry.id }),
            ),
          ),
        ),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: at === entry.parent }, t('moveHere'))),
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
        return moveDialog(dialog.entry, dialog.at);
      case 'share':
        return shareDialog(dialog.entry, dialog.who, dialog.role);
      case 'delete': {
        const { entry } = dialog;
        return confirmDialog(t('confirmDelete', { name: entry.name }), t('deleteForever'), () => void attempt(() => client.deleteForever(entry.id).then(() => (selected = null)), t('deleted')));
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
    const selectedEntry = entries.find((entry) => entry.id === selected) ?? null;
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
      { class: `rf-drive${options.className ? ` ${options.className}` : ''}`, 'data-theme': options.theme ?? 'light' },
      h('style', null, CSS),
      h(
        'div',
        { class: 'rf-top' },
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
      ),
      h(
        'div',
        { class: 'rf-body' },
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
              const id = event.dataTransfer?.getData(DRAGGED);
              if (id) void attempt(() => client.moveToTrash(id));
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
          h(
            'div',
            { class: 'rf-head' },
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
        details(selectedEntry),
      ),
      // Said once a view has loaded: where one is and how much is there. Not the progress of an upload, which would be read out at every step.
      h('span', { class: 'rf-sr', 'aria-live': 'polite' }, loading ? '' : `${heading ?? path.at(-1)?.name ?? t('myFiles')} · ${count}`),
      h(
        'div',
        { class: 'rf-status' },
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
  render();

  return {
    client,
    update(next) {
      options = { ...options, ...next };
      t = translator(options.texts ?? TEXTS[options.language ?? 'en']);
      locale = options.language ?? 'en';
      render();
    },
    refresh() {
      revision++;
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
