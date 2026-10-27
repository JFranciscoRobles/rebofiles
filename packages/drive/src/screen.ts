// The whole drive, without a framework: a bar with the search, the sections
// beside, the list or the grid of a folder, the details of what is selected,
// and a bar of status. Mounted on an element, it renders itself again after
// each change, and `morph` changes only what differs, so the focus, a
// selection and what is scrolled stay where they were.
//
//   const drive = mountDrive(document.getElementById('files')!, { base: '/api/files' });
//   drive.destroy();

import { qrPng, qrSvg } from './qr';
import {
  type Activity,
  type Comment,
  type Packed,
  type DriveSettings,
  EVERYONE,
  isGroup,
  FOLDER_COLORS,
  type FolderColor,
  type Entry,
  type EntryId,
  type FileEntry,
  type FolderEntry,
  type FileRequest,
  type Link,
  fieldFor,
  missingOf,
  type Notice,
  type PersonalSettings,
  type Role,
  type Sheet,
  readXlsx,
  splitName,
  shareHolds,
  versionNumber,
} from '@rebofiles/core';
import { refusalText } from './refusals';
import { type DriveClient, RequestError, type SettingsAnswer, createDriveClient } from './client';
import { brandStyle, contrastOnWhite } from './brand';
import { type Child, first, h, morph } from './dom';
import { TEXTS, type Texts, type Translate, formatDate, formatSize, translator } from './i18n';
import { type IconName, icon, logo as mark } from './icons';
import { type DocumentPreview, type Kind, TEXT_EXTENSIONS, badgeOf, kindOf } from './kinds';
import { type MadeRendition, renditionsOf } from './images';
import { downloadZip, saveBlob } from './download';
import { type Picked, readChosen, readDropped } from './folders';
import { type UploadItem, createUploads, formatDuration, lookInDrive } from './uploads';
import { textOf } from './text';
import { markdown, rowsOf } from './markdown';
import { CSS } from './styles';

/** The name of each colour of a folder, among the texts. */
const COLOR_TEXT: Record<FolderColor, 'colorRed' | 'colorOrange' | 'colorYellow' | 'colorGreen' | 'colorTeal' | 'colorBlue' | 'colorPurple' | 'colorPink' | 'colorGray'> = {
  red: 'colorRed',
  orange: 'colorOrange',
  yellow: 'colorYellow',
  green: 'colorGreen',
  teal: 'colorTeal',
  blue: 'colorBlue',
  purple: 'colorPurple',
  pink: 'colorPink',
  gray: 'colorGray',
};

export interface DriveOptions {
  /** Where the routes of @rebofiles/server are: `/api/files` unless said. */
  base?: string;
  /** A client of your own, instead of `base`: the drive kept in the page, or one shared with the rest of the page. */
  client?: DriveClient;
  /** Headers for every request to the server, such as a token of the session. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Over the drive's settings, under each person's own; the drive's (English) unless given. */
  language?: 'en' | 'es' | 'zh';
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
  viewDocument?: (element: HTMLElement, bytes: Uint8Array, context: { language: string }) => ShownDocument | Promise<ShownDocument>;
  /** The first page of a Word document, drawn, for its thumbnail in the grid and the details: `thumbDocx` of `@rebofiles/drive/rebodocs`. */
  thumbDocument?: (bytes: Uint8Array) => Promise<HTMLElement>;
  /** What is written in a Word document, to find it by in a search: `textOfDocx` of '@rebofiles/drive/rebodocs'. Text files are read without it. */
  textDocument?: (bytes: Uint8Array) => string | Promise<string>;
  /**
   * The first page of a Word document as a picture, its longest side `size` pixels: `pictureOfDocx` of
   * `@rebofiles/drive/rebodocs`. Made when one is uploaded, and kept with it as its thumbnail, in the sizes of the
   * drive's settings that the grid and the details show.
   */
  pictureDocument?: (bytes: Uint8Array, size: number, type: string, quality: number) => Promise<Blob>;
  /**
   * The bytes of an empty Word document: `newDocx` of `@rebofiles/drive/rebodocs`. Given, the Upload menu has "New
   * document": the one named goes into the folder one is in, and is opened with `onOpenDocument`, or else in the viewer.
   */
  newDocument?: () => Uint8Array | Promise<Uint8Array>;
  /**
   * What changed in a Word document from one version to another, shown in `element`: `compareDocx` of
   * `@rebofiles/drive/rebodocs`. Given, each version but the current has "Compare" in the history.
   */
  compareDocument?: (element: HTMLElement, before: Uint8Array, after: Uint8Array, context: { language: string; before: string; after: string }) => ShownDocument | Promise<ShownDocument>;
  /** Reads a Word document for its preview: `previewDocx` of `@rebofiles/drive/rebodocs`, or one of your own. */
  previewDocument?: (bytes: Uint8Array) => DocumentPreview | Promise<DocumentPreview>;
  /** The address a link of the drive is given: your page that shows it with `mountSharedLink`. This page with `?link=` unless given. */
  linkAddress?: (token: string) => string;
  /** Light, dark, or as the system is (`'auto'`): over the drive's settings, under each person's own. The drive's (light) unless given. */
  theme?: 'light' | 'dark' | 'auto';
  /** `'compact'`: no column on the left; New and the places in a strip over the list, for a drive in a smaller part of a page. `'full'` unless given. */
  layout?: 'full' | 'compact';
  /**
   * The application's own fields of an entry (`client: acme`), in its details: shown (`'show'`, as it comes), changed
   * there too by who may rename it (`'edit'`), or left out (false).
   */
  fields?: 'show' | 'edit' | false;
  /** False to leave out the settings of the server, and the button that changes them. */
  settings?: boolean;
  /** Templates of requests for files, to start one from and to save one as (who may configure the drive): true unless said. */
  requestTemplates?: boolean;
  /** A QR code of the address of a request made, to show a phone's camera and to download: true unless said. */
  qr?: boolean;
  /** Links only to see, and with the name of who sees them over what they share, offered when one is made: true unless said. */
  viewOnlyLinks?: boolean;
  /** Each file looked for in the drive before it goes, and asked about when its bytes or its name are there already: true unless said. */
  checkUploads?: boolean;
  className?: string;
  /** Called after every change made from the drive, for what else in the page shows it to ask again. */
  onChange?: () => void;
  /**
   * What others change shown as it happens, from the server's `/events`: true unless said. False for a drive that is
   * told otherwise, as <FileDrive> is by its provider, which watches for the whole page.
   */
  live?: boolean;
}

/** A document shown in the viewer's element: what takes it down, or more of it, as `viewDocx` gives. */
export type ShownDocument = (() => void) | { destroy(): void; pages?: number; layout?(mode: 'all' | 'pages'): void; print?(): void; pdf?(): Promise<Uint8Array> } | undefined;

export interface MountedDrive {
  readonly client: DriveClient;
  /** Other options, as a framework gives them again. */
  update(options: Partial<DriveOptions>): void;
  /** Asks the server again, after a change made elsewhere. */
  refresh(): void;
  destroy(): void;
}

type Section = 'files' | 'recent' | 'starred' | 'received' | 'shared' | 'trash';
/** What a request for files is made of, as its dialog holds it while it is written. */
/** A document asked for, as the dialog holds it: its id once made, the words it should say, whether its expiry is asked. */
interface AskedItem {
  id?: string;
  label: string;
  words: string;
  expires: boolean;
  find?: Record<string, string>;
  /** Its options shown. */
  open?: boolean;
}

/** Something asked to be written, as the dialog holds it: the field it is kept as, once made. */
interface AskedQuestion {
  id?: string;
  label: string;
  field?: string;
  required: boolean;
}

interface RequestDialog {
  kind: 'request';
  entry: FolderEntry;
  mode: 'only' | 'also';
  days: number;
  password: string;
  title: string;
  email: string;
  items: AskedItem[];
  questions: AskedQuestion[];
  closeWhenDone: boolean;
  /** Every how many days whoever it was sent to is reminded; 0 for never. */
  remind: number;
  /** Saving it as a template: the name being written; not saving unless said. */
  templateName?: string;
  message: string;
  accept: string[];
  maxSize: number;
  maxFiles: number;
  perSender: boolean;
  rename: string;
  fieldsText: string;
  askName: boolean;
  /** Made: its address, and which link it is; `editing`, a link made before whose options are being changed. */
  made?: { address: string; link: string };
  editing?: string;
}

type Dialog =
  | { kind: 'folder'; name: string }
  | { kind: 'document'; name: string }
  | { kind: 'fields'; entry: Entry; text: string }
  | RequestDialog
  | { kind: 'review'; entry: FileEntry; reason: string }
  | { kind: 'rename'; entry: Entry; name: string }
  | { kind: 'move'; entries: Entry[]; at: EntryId | null }
  | { kind: 'share'; entry: Entry; who: string; role: Role; days?: number; password?: string; once?: boolean; lasts?: number; viewOnly?: boolean; watermark?: boolean }
  | { kind: 'delete'; entries: Entry[] }
  | { kind: 'empty' }
  | null;

/** The type of what is dragged from the drive itself, apart from files dragged in from the computer. */
const DRAGGED = 'application/x-rebofiles-entry';
/** Larger documents are not read for a preview: they would cost more than a glance is worth. */
const PREVIEW_LIMIT = 20 * 1024 * 1024;
/** The bars a sound is drawn with on its card, and the lines of a page that has no picture. */
const WAVE = [10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 34, 20, 8, 26, 14, 22];
const LINES = [62, 100, 100, 84, 100, 58];
/** How much of a text the viewer reads: enough for any file a person reads, not a log of a year. */
const VIEW_LIMIT = 2 * 1024 * 1024;
/** The largest workbook a card reads whole for its first rows. */
const CARD_BOOK = 2 * 1024 * 1024;
const ROLES: Role[] = ['viewer', 'commenter', 'editor'];
/** Fields the drive keeps of what came through a request, shown in its own words, not as fields. */
const INTERNAL_FIELDS = ['via', 'request', 'from', 'item', 'review', 'reviewReason', 'check', 'expires', 'same'];
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
  /** What went wrong, in the language of the drive. */
  const said = (error: unknown) => refusalText(error, languageNow());
  const languageNow = (): 'en' | 'es' | 'zh' => settings?.mine.language ?? options.language ?? settings?.drive.language ?? 'en';
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
  // How the list is put in order, and which kind of file it shows: as the person last chose, in this browser.
  type SortBy = 'name' | 'owner' | 'modified' | 'created' | 'size' | 'type' | 'color' | 'arrived';
  type KindFilter = 'all' | 'folder' | 'docx' | 'pdf' | 'sheet' | 'image' | 'video' | 'audio' | 'text' | 'other';
  const remembered = (() => {
    try {
      return JSON.parse(localStorage.getItem('rebofiles:order') ?? '{}') as { by?: SortBy; dir?: 1 | -1; chosen?: boolean; foldersFirst?: boolean };
    } catch {
      return {};
    }
  })();
  let sortBy: SortBy = remembered.by ?? 'name';
  let sortDir: 1 | -1 = remembered.dir ?? 1;
  // Until one is chosen, Recent and a search keep the order the server gives: the latest, the closest.
  let sortChosen = remembered.chosen ?? false;
  // Folders before files, as a drive has them, unless the person mixes them.
  let foldersFirst = remembered.foldersFirst ?? true;
  const keepOrder = () => {
    try {
      localStorage.setItem('rebofiles:order', JSON.stringify({ by: sortBy, dir: sortDir, chosen: sortChosen, foldersFirst }));
    } catch {}
  };
  let kindFilter: KindFilter = 'all';
  const setSort = (by: SortBy, dir?: 1 | -1) => {
    sortDir = dir ?? (by === sortBy ? (sortDir === 1 ? -1 : 1) : by === 'modified' || by === 'created' || by === 'size' ? -1 : 1);
    sortBy = by;
    sortChosen = true;
    keepOrder();
    render();
  };
  const sizeOfEntry = (entry: Entry) => (entry.kind === 'file' ? entry.versions[0].size : -1);
  /** Where a folder's colour comes, in the order of the colours; one without, after them all. */
  const colorRank = (entry: Entry) => (entry.kind === 'folder' && entry.color ? FOLDER_COLORS.indexOf(entry.color) : FOLDER_COLORS.length);
  const extensionOf = (entry: Entry) => (entry.kind === 'file' ? (/\.([^.]+)$/.exec(entry.name)?.[1] ?? '').toLowerCase() : '');
  /** What the view shows, of the kind chosen, in the order chosen: folders first, unless they are mixed with the files. */
  const arranged = (entries: Entry[]) => {
    const shown = kindFilter === 'all' ? entries : entries.filter((entry) => kindOf(entry) === kindFilter);
    if (!sortChosen && (section === 'recent' || query)) return shown;
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    const byName = (a: Entry, b: Entry) => collator.compare(a.name, b.name);
    const by = (a: Entry, b: Entry): number => {
      switch (sortBy) {
        case 'name':
          return byName(a, b);
        case 'owner':
          return collator.compare(a.fields?.from ?? a.owner, b.fields?.from ?? b.owner) || byName(a, b);
        // What came through a request first, the last to come first; then the rest by name.
        case 'arrived': {
          const came = (entry: Entry) => (entry.fields?.via === 'request' ? entry.created : '');
          return came(b).localeCompare(came(a)) || byName(a, b);
        }
        case 'modified':
          return a.modified.localeCompare(b.modified);
        case 'created':
          return a.created.localeCompare(b.created);
        case 'size':
          return sizeOfEntry(a) - sizeOfEntry(b) || byName(a, b);
        // Of a kind together, Word documents with Word documents, and by their extension within it.
        case 'type':
          return collator.compare(typeLabel(a), typeLabel(b)) || collator.compare(extensionOf(a), extensionOf(b)) || byName(a, b);
        case 'color':
          return colorRank(a) - colorRank(b) || byName(a, b);
      }
    };
    return [...shown].sort((a, b) => (foldersFirst && a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : by(a, b) * sortDir));
  };
  let typed = '';
  let query = '';
  let dialog: Dialog = null;
  let toast: string | null = null;
  let storage = '';
  let dropping = false;
  let menuOpen = false;
  let tab: 'details' | 'versions' | 'activity' | 'comments' = 'details';
  /** What is being written in the comments of the entry shown, and the comment it answers. */
  let draft = '';
  let replyingTo: Comment | null = null;
  let editing: { id: string; text: string } | null = null;
  let revision = 0;
  let alive = true;
  /** Whether the drive is mounted inside the main of a page of its own, as on a landing. */
  const inMain = Boolean(element.closest('main'));

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

  type View = { section: 'files'; folder: EntryId | null } | { section: 'recent' | 'starred' | 'received' | 'shared' | 'trash' } | { section: 'search'; query: string; trashed: boolean };
  const viewOf = (): View => (query ? { section: 'search', query, trashed: section === 'trash' } : section === 'files' ? { section, folder } : { section });
  // What was found by what is written in a file, beside what was found by its name: a piece of the text for each.
  let snippets = new Map<EntryId, string>();
  const searchBoth = async (q: string, trashed: boolean) => {
    const [named, written] = await Promise.all([client.search(q, { trashed }), trashed ? Promise.resolve([]) : client.searchText(q).catch(() => [])]);
    snippets = new Map(written.map((found) => [found.entry.id, found.snippet]));
    const seen = new Set(named.map((entry) => entry.id));
    return [...named, ...written.filter((found) => !seen.has(found.entry.id)).map((found) => found.entry)];
  };
  const listing = resource((key) => {
    const view = JSON.parse(key) as View;
    if (view.section === 'files') return client.list(view.folder);
    const asked =
      view.section === 'search'
        ? searchBoth(view.query, view.trashed)
        : view.section === 'recent'
          ? client.recent()
          : view.section === 'starred'
            ? client.starred()
            : view.section === 'received'
              ? client.received()
              : view.section === 'shared'
                ? client.shared()
                : client.trash();
    return asked.then((entries) => ({ folder: null, entries, path: [] as FolderEntry[] }));
  });
  const detail = resource((id) => client.entry(id));
  // What was done to the entry shown: asked when its tab is, again after each change.
  const happened = resource((id) => client.activity(id).catch(() => [] as Activity[]));
  const remarks = resource((id) => client.comments(id));
  // The space one keeps: asked again after each change, as uploads and the trash change it.
  const usage = resource(() => client.usage());
  // For who looks after the drive, in its settings: what each keeps, and what was done anywhere.
  const everyoneUsage = resource(() => client.adminUsage());
  const everyoneActivity = resource(() => client.adminActivity(100));
  // What the one asking starred, to mark it wherever it is shown.
  const stars = resource(() => client.starred().then((entries) => new Set(entries.map((entry) => entry.id))));
  const isStarred = (id: EntryId) => stars('').value?.has(id) ?? false;
  // What came through one's requests for files: for the place of its own, and how many are to be looked at.
  const receivedNow = resource(() => client.received().catch(() => [] as Entry[]));
  const toReview = (entries: Entry[]) => entries.filter((entry) => !entry.fields?.review).length;
  /** A copy of a file beside it, selected once it is there. */
  const makeCopy = (file: FileEntry) =>
    attempt(
      async () => {
        const made = await client.copy(file.id);
        select(made.id);
      },
      t('copied', { name: file.name }),
    );
  const toggleStar = (entry: Entry) => {
    const on = !isStarred(entry.id);
    return attempt(() => client.star(entry.id, on), on ? t('nowStarred', { name: entry.name }) : t('nowUnstarred', { name: entry.name }));
  };
  const moving = resource((key) => client.list(JSON.parse(key) as EntryId | null));
  // Addresses to show a file in the page, by its version and the size it is shown at: kept until a minute before they
  // are no longer good, and asked for together, those of one rendering in one request.
  const shown = new Map<string, { url: string; until: number }>();
  const asking = new Set<string>();
  let wanted = new Map<string, { file: FileEntry; size?: number }>();
  const askShown = async () => {
    const batch = wanted;
    wanted = new Map();
    const bySize = new Map<number | undefined, [string, FileEntry][]>();
    for (const [key, { file, size }] of batch) bySize.set(size, [...(bySize.get(size) ?? []), [key, file]]);
    await Promise.all(
      [...bySize].map(async ([size, files]) => {
        let found: Record<EntryId, { url: string; expires: string }>;
        try {
          found = await client.urls(
            files.map(([, file]) => file.id),
            { inline: true, size },
          );
        } catch {
          // A server without the route: one by one, as before.
          found = {};
          for (const [, file] of files) {
            const url = await client.url(file.id, { inline: true, size }).catch(() => undefined);
            if (url) found[file.id] = { url, expires: new Date(Date.now() + 10 * 60_000).toISOString() };
          }
        }
        for (const [key, file] of files) {
          asking.delete(key);
          const address = found[file.id];
          // One left out, that may not be read: not asked for again at every rendering, for a while.
          shown.set(key, address ? { url: address.url, until: Date.parse(address.expires) } : { url: '', until: Date.now() + 5 * 60_000 });
          // A picture that failed is loaded again, though its address be the same: the same all the hour, it is not told to by a new one.
          for (const img of broken.get(key) ?? []) if (address) afterRender.push(() => img.isConnected && img.setAttribute('src', address.url));
          broken.delete(key);
        }
      }),
    );
    render();
  };
  /** With `size`, of a picture: the smaller one made of it that shows it at that size, once there is one. */
  const urlOf = (file: FileEntry, size?: number): string | null => {
    const key = `${file.id}:${file.versions[0].id}:${size ?? ''}:${file.versions[0].renditions?.length ?? 0}`;
    const known = shown.get(key);
    // The one there is meanwhile, while another is asked for.
    if ((!known || known.until - Date.now() < 60_000) && !asking.has(key)) {
      asking.add(key);
      if (!wanted.size) queueMicrotask(() => void askShown());
      wanted.set(key, { file, size });
    }
    return known?.url || null;
  };
  // A picture that did not load, as one whose address ran out while the page was closed on a laptop: asked for again, once.
  const retried = new Set<string>();
  const broken = new Map<string, HTMLImageElement[]>();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  element.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || retried.has(img.src)) return;
      retried.add(img.src);
      for (const [key, address] of shown)
        if (address.url === img.src) {
          shown.set(key, { ...address, until: 0 });
          broken.set(key, [...(broken.get(key) ?? []), img]);
        }
      // Those that fail together, as all the pictures of a grid left open past their hour, asked for together.
      clearTimeout(retryTimer);
      retryTimer = setTimeout(render, 50);
    },
    true,
  );
  const texts = new Map<string, string | null>();
  const pages = new Map<string, DocumentPreview | null>();
  /** The first page of each Word document as its engine draws it, for thumbnails: null while it is made, an Error when it could not be. */
  const thumbs = new Map<string, HTMLElement | null | Error>();
  /** Whether this browser writes WebP from a canvas: some write PNG when asked for it. */
  let webp: boolean | undefined;
  const makesWebp = () => (webp ??= typeof document !== 'undefined' && document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'));
  /** The sizes a thumbnail is shown at, in the grid and in the details, in pixels: twice as many as it covers. */
  const THUMB_SIZES = [320, 640];
  /** The pictures made of a file when it goes up: of an image, in the drive's sizes; of a Word document, its first page in those the drive shows. */
  /** What this page makes of a file it uploads, which the server need not: pictures of pictures, and of Word documents with Rebodocs; the text of text, and of those. */
  const madeHere = (file: File): ('pictures' | 'text')[] => {
    const isDocx = /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml');
    const picture = /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.type);
    const textual = /^text\/|^application\/(json|xml|csv)/.test(file.type) || TEXT_EXTENSIONS.includes(splitName(file.name).ext.slice(1).toLowerCase());
    return [...(picture || (isDocx && options.pictureDocument) ? (['pictures'] as const) : []), ...(textual || (isDocx && options.textDocument) ? (['text'] as const) : [])];
  };
  const picturesOf = async (file: Blob & { name?: string }, images: DriveSettings['images']): Promise<MadeRendition[]> => {
    const document = options.pictureDocument;
    const isDocx = /\.docx$/i.test(file.name ?? '') || file.type.includes('wordprocessingml');
    if (!isDocx) return renditionsOf(file, images);
    if (!document || !images.enabled || file.size > PREVIEW_LIMIT) return [];
    const sizes = [...new Set(THUMB_SIZES.map((wanted) => images.sizes.find((size) => size >= wanted) ?? images.sizes[images.sizes.length - 1]))];
    // A page is mostly text, which WebP keeps sharper and lighter than JPEG, by a third; JPEG where the browser makes no WebP.
    const type = images.format === 'original' ? 'image/png' : makesWebp() ? 'image/webp' : 'image/jpeg';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const made: MadeRendition[] = [];
    for (const size of sizes) {
      const blob = await document(bytes, size, type, images.quality);
      const bitmap = await createImageBitmap(blob);
      made.push({ blob, size, width: bitmap.width, height: bitmap.height });
      bitmap.close();
    }
    return made;
  };
  /**
   * The pictures of a document uploaded before they were made, made now and kept with its version, so the next
   * time it is shown nothing is drawn. Only by who may upload to it: for anyone else, nothing is kept.
   */
  const keepPictures = async (file: FileEntry, bytes: ArrayBuffer) => {
    const images = settings?.settings.images;
    if (!options.pictureDocument || !images?.enabled) return;
    try {
      const version = file.versions[0].id;
      const made = await picturesOf(Object.assign(new Blob([bytes], { type: file.type }), { name: file.name }), images);
      for (const picture of made) await client.upload(picture.blob, { rendition: { file: file.id, version, size: picture.size, width: picture.width, height: picture.height } });
      if (made.length) changed();
    } catch {
      // Not theirs to change, or the storage refused: it is drawn each time, as before.
    }
  };
  /** The first page of a document, small, made once for each version; undefined where there is no way to make it. */
  /** A picture's placeholder, blurred, under where the picture will be: what shows of it until it has come. */
  const blurred = (file: FileEntry) => {
    const placeholder = file.versions[0].placeholder;
    return placeholder ? h('img', { key: `ph:${file.versions[0].id}`, class: 'rf-ph', src: placeholder, alt: '', 'aria-hidden': 'true' }) : null;
  };

  /** The beginning of a text, the first piece of it that arrives, the rest not asked for: once for each version. */
  const headOf = (file: FileEntry): string | null | undefined => {
    const key = `${file.id}:${file.versions[0].id}`;
    const url = !texts.has(key) && urlOf(file);
    if (url) {
      texts.set(key, null);
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
    return texts.get(key);
  };
  /**
   * What a card shows of a file that is not a picture nor a Word document: the first lines of a text, the first rows
   * of a table, a frame of a video, the shape of a sound; and a page with lines on it for a PDF and the rest.
   */
  const fileThumb = (file: FileEntry, kind: Kind): Child => {
    if (kind === 'video') {
      const url = urlOf(file);
      return [
        url && h('video', { key: `v:${url}`, src: `${url}#t=0.5`, muted: true, playsinline: true, preload: 'metadata', tabindex: '-1', 'aria-hidden': 'true' }),
        h('span', { class: 'rf-play', 'aria-hidden': 'true' }, icon('play', 16)),
      ];
    }
    if (kind === 'audio')
      return h(
        'span',
        { class: 'rf-wave', 'aria-hidden': 'true' },
        WAVE.map((height) => h('span', { style: `height:${height}px` })),
      );
    const ext = splitName(file.name).ext.slice(1).toLowerCase();
    // A workbook's first rows, of one small enough to read whole for a card.
    const book = ext === 'xlsx' && file.versions[0].size <= CARD_BOOK ? sheetsOf(file, urlOf(file), { rows: 9, columns: 4, sheets: 1 }) : undefined;
    if (Array.isArray(book) && book[0]?.rows.length)
      return h(
        'div',
        { class: 'rf-paper', 'aria-hidden': 'true' },
        h(
          'table',
          null,
          h(
            'tbody',
            null,
            book[0].rows.map((row) =>
              h(
                'tr',
                null,
                row.map((cell) => h('td', null, cell)),
              ),
            ),
          ),
        ),
      );
    const table = kind === 'sheet' && (ext === 'csv' || ext === 'tsv');
    const head = kind === 'text' || table ? headOf(file) : undefined;
    if (typeof head === 'string' && head.trim()) {
      return h(
        'div',
        { class: 'rf-paper', 'aria-hidden': 'true' },
        table
          ? h(
              'table',
              null,
              h(
                'tbody',
                null,
                rowsOf(head, ext === 'tsv' ? '\t' : ',', 9).map((row) =>
                  h(
                    'tr',
                    null,
                    row.slice(0, 4).map((cell) => h('td', null, cell)),
                  ),
                ),
              ),
            )
          : head.slice(0, 700),
      );
    }
    return h(
      'div',
      { class: 'rf-paper rf-lines', 'aria-hidden': 'true' },
      LINES.map((width) => h('span', { style: `width:${width}%` })),
    );
  };

  const docThumb = (file: FileEntry, fit: 'page' | 'width', wanted = 640): Child | undefined => {
    if (kindOf(file) !== 'docx') return undefined;
    // The picture made of its first page when it was uploaded, when there is one: nothing to draw.
    const renditions = file.versions[0].renditions;
    if (renditions?.length) {
      const src = urlOf(file, wanted);
      // A page lying down is shown whole: its top would be a strip.
      const wide = renditions[0].width > renditions[0].height;
      return h(
        'div',
        { key: `pic:${file.id}:${fit}`, class: `rf-doc-thumb rf-fit-${wide ? 'page' : fit}${wide ? ' rf-wide' : ''}`, 'aria-hidden': 'true' },
        src && h('img', { class: 'rf-doc-pic', src, alt: '' }),
      );
    }
    const make = options.thumbDocument;
    if (!make || file.versions[0].size > PREVIEW_LIMIT) return undefined;
    const key = `${file.id}:${file.versions[0].id}`;
    const url = urlOf(file);
    if (url && !thumbs.has(key)) {
      thumbs.set(key, null);
      fetch(url)
        .then((answer) => answer.arrayBuffer())
        .then(async (bytes) => {
          const page = await make(new Uint8Array(bytes));
          void keepPictures(file, bytes);
          return page;
        })
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
        // A page lying down is shown whole: its top would be a strip.
        const shown = width > height ? 'page' : fit;
        if (shown !== fit) box.classList.add('rf-wide');
        // Its top, the side margins left out so the text is as large as it can be; or the whole page.
        const SHOWN = 1 / 1.22;
        const scale = shown === 'width' ? box.clientWidth / (width * SHOWN) : Math.min(box.clientWidth / width, box.clientHeight / height);
        const left = shown === 'width' ? -(width * scale - box.clientWidth) / 2 : Math.max(0, (box.clientWidth - width * scale) / 2);
        const top = shown === 'width' ? -height * scale * 0.02 : Math.max(0, (box.clientHeight - height * scale) / 2);
        copy.style.cssText = `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:top left;position:absolute;left:${left}px;top:${top}px`;
        box.appendChild(copy);
      },
    });
  };

  // ---- Changes, each telling what else shows the drive, and the toast ----

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the last change undoes with, while its toast is up: ⌘Z or Ctrl+Z, or its button. */
  let undoing: (() => Promise<unknown>) | null = null;
  /** Something else the toast offers to do, as downloading what was left out. */
  let offered: { label: string; run: () => void } | null = null;
  const say = (text: string | null, undo?: () => Promise<unknown>, offer?: { label: string; run: () => void }) => {
    toast = text;
    undoing = undo ?? null;
    offered = offer ?? null;
    clearTimeout(toastTimer);
    // Longer when there is something to do from it: time to see it and change one's mind.
    if (text) toastTimer = setTimeout(() => ((toast = null), (undoing = null), (offered = null), render()), undo || offer ? 8000 : 2800);
    render();
  };
  const undo = async () => {
    const run = undoing;
    if (!run) return;
    undoing = null;
    try {
      await run();
      say(t('undone'));
    } catch (error) {
      say(said(error));
    }
    changed();
  };
  const changed = () => {
    revision++;
    lookIn.forget();
    options.onChange?.();
    askShared();
    render();
  };
  // How many of what others shared is new since one looked at Shared with me: asked after each change, when the page is
  // seen again, and every minute, as what others do comes with no change of one's own.
  let freshShared = 0;
  const askShared = () => {
    askNotices();
    void client.sharedNew().then(
      (n) => alive && n !== freshShared && ((freshShared = n), render()),
      () => undefined,
    );
  };
  // What one was told (shared with them, named in a comment), asked when Shared with me is; none for a server without it.
  let notices: { notifications: Notice[]; unseen: number } | null = null;
  let noticesOpen = false;
  const askNotices = () =>
    void client.notifications().then(
      (told) => alive && JSON.stringify(told) !== JSON.stringify(notices) && ((notices = told), render()),
      () => undefined,
    );
  const openNotices = () => {
    noticesOpen = !noticesOpen;
    if (noticesOpen && notices?.unseen) {
      notices = { ...notices, unseen: 0 };
      void client.sawNotifications().catch(() => undefined);
    }
    render();
  };
  /** Where what one was told about is: its folder, or Shared with me, with it selected; a comment's in its tab. */
  const goToNotice = async (notice: Notice) => {
    noticesOpen = false;
    try {
      const { entry, path } = await client.entry(notice.entry);
      const parent = path.at(-1)?.id ?? null;
      if (notice.kind === 'shared' || (parent === null && entry.owner !== settings?.you)) go('shared');
      else go('files', parent);
      select(entry.id);
      if (notice.kind === 'mentioned') (tab = 'comments'), render();
    } catch (error) {
      say(said(error));
    }
  };
  /** A file shown where it is, in its folder, chosen. */
  const goToEntry = (id: EntryId) =>
    void attempt(async () => {
      const { entry, path } = await client.entry(id);
      go('files', path.at(-1)?.id ?? null);
      select(entry.id);
    });
  const onSeen = () => document.visibilityState === 'visible' && askShared();
  document.addEventListener('visibilitychange', onSeen);
  const sharedTimer = setInterval(onSeen, 60_000);
  // What others change, as it happens: everything asked again a moment after, once for changes that come together.
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  const unwatch =
    options.live === false || !client.watch
      ? () => undefined
      : client.watch(() => {
          clearTimeout(liveTimer);
          liveTimer = setTimeout(() => {
            if (!alive) return;
            revision++;
            lookIn.forget();
            askShared();
            render();
          }, 250);
        });
  /** Does it, says what went wrong in the toast rather than in the console, and asks everything again. */
  const attempt = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) say(done);
    } catch (error) {
      say(said(error));
    } finally {
      changed();
    }
  };

  const go = (next: Section, to: EntryId | null = null) => {
    if (next === 'shared' || (next === 'files' && to === null)) from = next === 'shared' ? 'shared' : 'files';
    if (next === 'shared' && freshShared) {
      freshShared = 0;
      void client.sawShared();
    }
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
    const went: Entry[] = [];
    for (const entry of entries) {
      try {
        await work(entry);
        went.push(entry);
      } catch (error) {
        failed++;
        why = said(error);
      }
    }
    if (done !== 'movedMany') picked = new Set();
    if (done !== 'movedMany') selected = null;
    // Into the trash and moved, undone by bringing back those that went, each to where it was.
    const back =
      went.length && done === 'trashedMany'
        ? () => Promise.all(went.map((entry) => client.restore(entry.id)))
        : went.length && done === 'movedMany'
          ? () => Promise.all(went.map((entry) => client.move(entry.id, entry.parent)))
          : undefined;
    say(
      failed
        ? t('notAll', { done: entries.length - failed, n: entries.length, why })
        : entries.length === 1 && done === 'trashedMany'
          ? t('movedToTrash', { name: entries[0].name })
          : t(done, { n: entries.length }),
      back,
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
      say(said(error));
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
      say(said(error));
    }
  };

  // Files going up, a few at once; what was selected when each was chosen, to show it once it is up unless that changed.
  const selectedWhen = new Map<number, EntryId | null>();
  // The same bytes anywhere in the drive, and else a file of the same name where it goes: asked about before it goes.
  const lookIn = lookInDrive(client);
  /** What the page makes of a file it sends, its pictures and its text, and says it made. */
  const madeOf = (file: File) => ({
    images: settings?.settings.images,
    renditions: picturesOf,
    text: (blob: Blob, name: string) => textOf(blob, name, options.textDocument),
    madeHere: madeHere(file),
  });
  const uploader = createUploads(client, {
    extra: madeOf,
    check: (file, parent) => (options.checkUploads === false ? Promise.resolve({}) : lookIn(file, parent)),
    onChange: render,
    onDone: (entry, item) => {
      if (selectedWhen.get(item.id) === selected && picked.size <= 1 && !viewing && !dialog) select(entry.id);
      selectedWhen.delete(item.id);
      say(t('uploaded', { name: entry.name }));
      changed();
    },
    onFail: () => changed(),
  });
  let uploadsOpen = true;
  /** What is chosen for one asked about goes for all the others of its kind. */
  let forAll = false;
  const uploadInto = (files: Iterable<File>, parent: EntryId | null) => {
    const chosen = [...files];
    const first = uploader.items.length;
    uploader.add(chosen, parent);
    for (const item of uploader.items.slice(first)) selectedWhen.set(item.id, selected);
    uploadsOpen = true;
  };
  /** Folders of the computer made in `parent` as they were, top down, the empty ones too; then their files go up into them. */
  const uploadTree = async (picked: Picked, parent: EntryId | null) => {
    const made = new Map<string, EntryId | null>([['', parent]]);
    const dirname = (path: string) => path.split('/').slice(0, -1).join('/');
    try {
      for (const path of picked.folders) {
        // A name taken where it goes is told apart as "(2)", as the drive does for anything new.
        const folderMade = await client.createFolder(path.split('/').pop()!, made.get(dirname(path)) ?? parent);
        made.set(path, folderMade.id);
      }
    } catch (error) {
      say(said(error));
    }
    changed();
    const byFolder = new Map<string, File[]>();
    for (const { file, path } of picked.files) byFolder.set(dirname(path), [...(byFolder.get(dirname(path)) ?? []), file]);
    for (const [path, files] of byFolder) if (made.has(path)) uploadInto(files, made.get(path) ?? parent);
  };
  /** What was dropped from the computer: its files, or its folders with all that is in them. */
  const dropped = (transfer: DataTransfer, parent: EntryId | null) => {
    const reading = readDropped(transfer);
    void reading.then((picked) =>
      picked.folders.length
        ? uploadTree(picked, parent)
        : uploadInto(
            picked.files.map((one) => one.file),
            parent,
          ),
    );
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
      else if (event.dataTransfer?.files.length) dropped(event.dataTransfer, target);
    },
  });

  // ---- The pieces of the screen ----

  const tile = (entry: Entry) =>
    h(
      'span',
      { class: `rf-tile rf-k-${kindOf(entry)}${entry.kind === 'folder' && entry.color ? ` rf-fc-${entry.color}` : ''}`, 'aria-hidden': 'true' },
      entry.kind === 'folder' ? icon('folder', 16) : badgeOf(entry),
    );
  /** A file's own thumbnail made small, for a row of the list: its picture, its first page, its first lines; a folder's tile. */
  /** Whether a file is shown by a picture: a picture, or one with smaller pictures of it, as the server makes of a PDF. */
  const pictured = (file: FileEntry, kind: Kind) => kind === 'image' || (kind !== 'docx' && Boolean(file.versions[0].renditions?.length));
  const rowThumb = (entry: Entry) => {
    if (entry.kind === 'folder') return tile(entry);
    const kind = kindOf(entry);
    const url = pictured(entry, kind) ? urlOf(entry, 160) : null;
    return h(
      'span',
      { class: `rf-tile rf-mini rf-k-${kind}`, 'aria-hidden': 'true' },
      url ? [blurred(entry), h('img', { key: url, src: url, alt: '', loading: 'lazy' })] : docThumb(entry, 'width', 160) || fileThumb(entry, kind),
    );
  };
  /** The colours a folder may be given, the drive's own first, the one it has marked: for each of `folders`, at once. */
  const swatches = (folders: FolderEntry[], role: 'radio' | 'menuitemradio', after?: () => void) => {
    const now = folders.every((f) => (f.color ?? null) === (folders[0].color ?? null)) ? (folders[0].color ?? null) : undefined;
    return h(
      'div',
      { key: 'colours', class: 'rf-swatches', role: role === 'radio' ? 'radiogroup' : 'group', 'aria-label': t('folderColor') },
      [null, ...FOLDER_COLORS].map((color) =>
        button(
          icon('folder', 14),
          () => {
            after?.();
            // Undone by giving each the colour it had.
            const was = folders.map((f) => [f.id, f.color ?? null] as const);
            void attempt(async () => {
              await Promise.all(folders.map((f) => client.setColor(f.id, color)));
              say(t('colorChanged'), () => Promise.all(was.map(([id, before]) => client.setColor(id, before))));
            });
          },
          {
            key: color ?? 'none',
            role,
            tabindex: role === 'menuitemradio' ? '-1' : undefined,
            class: `rf-swatch${color ? ` rf-fc-${color}` : ''}`,
            'aria-checked': now === color,
            'aria-label': color ? t(COLOR_TEXT[color]) : t('colorNone'),
            title: color ? t(COLOR_TEXT[color]) : t('colorNone'),
          },
        ),
      ),
    );
  };
  /** Who a share names, as a person reads it: everyone, a group by its name, or someone by their id. */
  const whoName = (who: string) => (who === EVERYONE ? t('everyone') : isGroup(who) ? t('groupNamed', { name: who.slice(6) }) : who.startsWith('link:') ? t('throughLink') : who);
  const roleName = (role: Role) => t(role === 'viewer' ? 'roleViewer' : role === 'commenter' ? 'roleCommenter' : 'roleEditor');
  /** A kind as a person reads it, for putting entries of one kind together. */
  const typeLabel = (entry: Entry) => (entry.kind === 'folder' ? t('folder') : typeName(entry));
  /** What each order is called, in the choice of one. */
  const sortName = (by: SortBy) =>
    t(({ name: 'name', owner: 'owner', modified: 'modified', created: 'createdAt', size: 'size', type: 'type', color: 'folderColor', arrived: 'arrivedFirst' } as const)[by]);
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
            withIcon('folder', t('uploadFolder'), 18),
            pick(() => element.querySelector<HTMLInputElement>('.rf-folder-file')?.click()),
            { role: 'menuitem', tabindex: '-1' },
          ),
          button(
            withIcon('folderPlus', t('newFolder'), 18),
            pick(() => ((dialog = { kind: 'folder', name: '' }), render())),
            { role: 'menuitem', tabindex: '-1' },
          ),
          options.newDocument && button(withIcon('doc', t('newDocument'), 18), pick(newDocument), { role: 'menuitem', tabindex: '-1' }),
        ),
    ];
  }

  const newDocument = () => ((dialog = { kind: 'document', name: t('untitledDocument') }), render());
  /** An empty Word document named `name` made in `into`, and opened: in Rebodocs when the application opens documents, else in the viewer. */
  const makeDocument = async (name: string, into: EntryId | null) => {
    const named = /\.docx$/i.test(name) ? name : `${name}.docx`;
    const bytes = await options.newDocument!();
    const file = new File([bytes as BlobPart], named, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const made = await client.upload(file, { parent: into, ...madeOf(file) });
    selected = made.id;
    changed();
    if (options.onOpenDocument) options.onOpenDocument(made, await client.url(made.id, { inline: true }));
    else view(made.id);
  };

  /** An entry's name, and, of one found by what is written in it, a piece of that under it. */
  const named = (entry: Entry) => {
    const snippet = query ? snippets.get(entry.id) : undefined;
    const star = [
      isStarred(entry.id) && h('span', { class: 'rf-star', role: 'img', 'aria-label': t('starred'), title: t('starred') }, icon('star', 14)),
      // What came through a request: who sent it, and whether it was looked at.
      layout === 'grid' && entry.fields?.via === 'request' && entry.fields.from && h('span', { class: 'rf-from', title: t('cameFrom', { who: entry.fields.from }) }, entry.fields.from),
      entry.fields?.via === 'request' &&
        (entry.fields.review === 'accepted'
          ? h('span', { class: 'rf-review rf-ok' }, t('accepted'))
          : entry.fields.review === 'rejected'
            ? h('span', { class: 'rf-review rf-back' }, t('returned'))
            : Date.now() - Date.parse(entry.created) < 3 * 86_400_000 && h('span', { class: 'rf-review rf-new' }, t('newOne'))),
    ];
    return snippet ? h('span', { class: 'rf-name-lines' }, h('span', null, entry.name, star), h('small', { class: 'rf-snippet' }, snippet)) : h('span', null, entry.name, star);
  };

  // A folder of many: only what is in sight is in the page, and a little around it, with the room of the rest kept
  // above and below, so the scroll bar is as long as all of it. Their heights are measured as they are shown.
  const VIRTUAL_FROM = 200;
  const AROUND = 4;
  const sight = { top: 0, height: 0, width: 0, row: 41, card: 190, of: '' };
  let sightFrame = 0;
  /** The rows of a grid, as its CSS lays them: cards of 150 pixels at least, 12 between, 12 at each side. */
  const columnsIn = (width: number) => Math.max(1, Math.floor((width - 24 + 12) / (150 + 12)));
  const measure = (box: HTMLElement) => {
    const row = box.querySelector<HTMLElement>('.rf-row, .rf-card');
    const height = row ? row.getBoundingClientRect().height + (layout === 'grid' ? 12 : 0) : 0;
    const before = { ...sight };
    sight.top = box.scrollTop;
    sight.height = box.clientHeight;
    sight.width = box.clientWidth;
    if (height > 0) layout === 'grid' ? (sight.card = height) : (sight.row = height);
    return before.top !== sight.top || before.height !== sight.height || before.width !== sight.width || before.row !== sight.row || before.card !== sight.card;
  };
  /** What of `count` is in sight, with how much room goes before and after it: all of it, for a few. */
  const inSight = (count: number, index: number) => {
    if (count < VIRTUAL_FROM) return { from: 0, to: count, before: 0, after: 0, scroll: undefined as number | undefined };
    const each = layout === 'grid' ? columnsIn(sight.width || 600) : 1;
    const tall = layout === 'grid' ? sight.card : sight.row;
    const rows = Math.ceil(count / each);
    const height = sight.height || 600;
    let scroll: number | undefined;
    // The one current, moved to with the keyboard, brought into sight first: it must be in the page to be told of.
    const key = `${selected}|${layout}`;
    if (index >= 0 && key !== sight.of) {
      sight.of = key;
      const at = Math.floor(index / each) * tall;
      if (at < sight.top) scroll = sight.top = at;
      else if (at + tall > sight.top + height) scroll = sight.top = at + tall - height;
    }
    const first = Math.max(0, Math.floor(sight.top / tall) - AROUND);
    const last = Math.min(rows, Math.ceil((sight.top + height) / tall) + AROUND);
    return { from: first * each, to: Math.min(count, last * each), before: first * tall, after: Math.max(0, rows - last) * tall, scroll };
  };

  function items(entries: Entry[], loading: boolean, error: Error | null, empty: string) {
    if (error) return h('div', { class: 'rf-empty rf-error', role: 'alert' }, said(error));
    if (!loading && entries.length === 0) return h('div', { class: 'rf-empty' }, h('div', null, icon('folder', 40), h('div', null, empty)));
    const index = entries.findIndex((entry) => entry.id === selected);
    const shown = inSight(entries.length, index);
    const visible = entries.slice(shown.from, shown.to);
    const many = entries.length >= VIRTUAL_FROM;
    afterRender.push(() => {
      const box = element.querySelector<HTMLElement>('.rf-items');
      if (!box || !many) return;
      if (shown.scroll !== undefined) box.scrollTop = shown.scroll;
      // Measured once it is in the page: other heights than were thought, or another size, lay it out again.
      if (measure(box)) render();
    });
    const room = (key: string, height: number) => (height > 0 ? h('div', { key, class: 'rf-room', 'aria-hidden': 'true', style: `height:${height}px` }) : null);
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
      } else if ((event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) && current) {
        event.preventDefault();
        const row = element.querySelector(`[data-id="${quoted(current.id)}"]`)?.getBoundingClientRect();
        openContext(many.length ? many : [current], { x: (row?.left ?? 0) + 24, y: (row?.bottom ?? 0) - 4 });
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
          // Where it is among all, for a screen reader, when only some are in the page.
          'aria-setsize': many ? entries.length : undefined,
          'aria-posinset': many ? entries.indexOf(entry) + 1 : undefined,
          'data-current': entry.id === selected,
          draggable: draggable ? 'true' : 'false',
          onClick: (event: MouseEvent) => (event.shiftKey ? pickRange(entries, entry.id, event.ctrlKey || event.metaKey) : event.ctrlKey || event.metaKey ? toggle(entry.id) : select(entry.id)),
          onDblclick: () => void open(entry),
          onContextmenu: (event: MouseEvent) => {
            event.preventDefault();
            // On one not picked, that one alone; on one picked, all that is.
            if (!picked.has(entry.id)) select(entry.id);
            openContext(
              entries.filter((e) => picked.has(e.id) || e.id === entry.id),
              { x: event.clientX, y: event.clientY },
            );
          },
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
        // Come into by the keyboard, the first is chosen; by a tap or a click, the one under it is.
        onFocus: (event: FocusEvent) => index < 0 && entries[0] && (event.currentTarget as HTMLElement).matches(':focus-visible') && select(entries[0].id),
        onScroll: (event: Event) => {
          if (!many || sightFrame) return;
          const box = event.currentTarget as HTMLElement;
          sightFrame = requestAnimationFrame(() => {
            sightFrame = 0;
            if (measure(box)) render();
          });
        },
      },
      layout === 'list'
        ? [
            room('before', shown.before),
            visible.map((entry) =>
              item(
                entry,
                'rf-row',
                h('span', { class: 'rf-name' }, tick(entry), rowThumb(entry), named(entry)),
                // Of what came through a request, who sent it, in the place of its owner.
                entry.fields?.via === 'request' && entry.fields.from
                  ? h(
                      'span',
                      { class: 'rf-cell-from', title: t('cameFrom', { who: entry.fields.from }) },
                      h('span', { class: 'rf-avatar rf-avatar-small', 'aria-hidden': 'true' }, entry.fields.from.slice(0, 1).toUpperCase()),
                      entry.fields.from,
                    )
                  : h('span', null, entry.owner),
                h('span', null, formatDate(entry.modified, locale)),
                h('span', null, entry.kind === 'file' ? formatSize(entry.versions[0].size, locale) : '—'),
              ),
            ),
            room('after', shown.after),
          ]
        : h(
            'div',
            { class: 'rf-grid', style: many ? `padding-top:${shown.before + 4}px;padding-bottom:${shown.after + 12}px` : undefined },
            visible.map((entry) => {
              const kind = kindOf(entry);
              const url = entry.kind === 'file' && pictured(entry, kind) ? urlOf(entry, 320) : null;
              return item(
                entry,
                'rf-card',
                h(
                  'div',
                  { class: `rf-thumb rf-k-${kind}${entry.kind === 'folder' && entry.color ? ` rf-fc-${entry.color}` : ''}` },
                  tick(entry),
                  url
                    ? [blurred(entry as FileEntry), h('img', { key: url, src: url, alt: '', loading: 'lazy' })]
                    : entry.kind === 'folder'
                      ? icon('folder', 34)
                      : docThumb(entry, 'width', 320) || fileThumb(entry, kind),
                ),
                h('div', { class: 'rf-name' }, tile(entry), named(entry)),
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
    if (kind === 'text') headOf(file);
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
      { class: `rf-preview${kind === 'image' && file.versions[0].placeholder ? ' rf-has-ph' : ''}` },
      kind === 'image' && url
        ? [blurred(file), h('img', { key: url, src: url, alt: file.name })]
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
  // ---- The menu of an entry, at the pointer or at the one the keyboard is on ----

  let contextMenu: { x: number; y: number; entries: Entry[]; here?: boolean } | null = null;
  /** `here`: the menu of the folder one is in, from its name over the list: nothing to open, and trashed, the one above is shown. */
  const openContext = (entries: Entry[], at: { x: number; y: number }, here = false) => {
    const box = element.getBoundingClientRect();
    menuOpen = false;
    contextMenu = { x: at.x - box.left, y: at.y - box.top, entries, ...(here ? { here } : {}) };
    render();
  };
  const closeContext = (focusList = true) => {
    if (!contextMenu) return;
    contextMenu = null;
    render();
    if (focusList) afterRender.push(() => element.querySelector<HTMLElement>('.rf-items')?.focus());
  };
  function contextMenuView(menu: { x: number; y: number; entries: Entry[]; here?: boolean }) {
    const many = menu.entries;
    const one = many.length === 1 ? many[0] : null;
    const file = one?.kind === 'file' ? one : null;
    /** An item of the menu; `keys`, its key of the keyboard, shown beside it and told to a screen reader. */
    const act = (label: string, name: IconName, run: () => void, danger = false, keys?: string) =>
      button(
        [icon(name, 16), label],
        () => {
          closeContext(false);
          run();
        },
        { key: label, role: 'menuitem', tabindex: '-1', class: danger ? 'rf-danger' : undefined, ...(keys ? { 'aria-keyshortcuts': keys, 'data-keys': keys } : {}) },
      );
    const label = (text: string) => h('div', { key: `label-${text}`, class: 'rf-menu-label', 'aria-hidden': 'true' }, text);
    const inTrash = section === 'trash';
    const actions: Child[] = inTrash
      ? [
          act(t('restore'), 'restore', () => void each(many, (entry) => client.restore(entry.id), 'restoredMany')),
          act(t('deleteForever'), 'trash', () => ((dialog = { kind: 'delete', entries: many }), render()), true),
        ]
      : [
          one?.kind === 'folder' && label(t('organize')),
          one && !menu.here && act(t('open'), file ? 'eye' : 'folder', () => void open(one)),
          file ? act(t('download'), 'download', () => void attempt(() => downloadEach([file]))) : act(t('downloadZip'), 'download', () => void zipDownload(many)),
          one && act(t('rename'), 'pencil', () => ((dialog = { kind: 'rename', entry: one, name: one.name }), render()), false, 'F2'),
          act(t('move'), 'move', () => ((dialog = { kind: 'move', entries: many, at: null }), (movedInto = false), render())),
          one && act(isStarred(one.id) ? t('unstar') : t('star'), 'star', () => void toggleStar(one)),
          file && !inTrash && act(t('makeCopy'), 'copy', () => void makeCopy(file)),
          one && h('div', { key: 'sep-share', class: 'rf-menu-sep', role: 'separator' }),
          one?.kind === 'folder' && label(t('shareGroup')),
          one && act(t('share'), 'users', () => ((dialog = { kind: 'share', entry: one, who: '', role: 'viewer' }), render())),
          one?.kind === 'folder' &&
            act(
              t('linkToView'),
              'link',
              () => ((dialog = { kind: 'share', entry: one, who: '', role: 'viewer' }), render(), afterRender.push(() => element.querySelector('.rf-link-add')?.scrollIntoView({ block: 'center' }))),
            ),
          one?.kind === 'folder' && act(t('requestFiles'), 'upload', () => requestFiles(one)),
          h('div', { key: 'sep-trash', class: 'rf-menu-sep', role: 'separator' }),
          act(
            t('moveToTrash'),
            'trash',
            () =>
              void each(many, (entry) => client.moveToTrash(entry.id), 'trashedMany').then(() => {
                // The folder one was in, gone: the one above it.
                if (menu.here && one) go('files', one.parent);
              }),
            true,
          ),
          many.every((entry) => entry.kind === 'folder') && swatches(many as FolderEntry[], 'menuitemradio', () => closeContext(false)),
        ];
    return h(
      'div',
      {
        key: 'context',
        class: 'rf-menu rf-ctx',
        role: 'menu',
        'aria-label': one ? one.name : t('pickedN', { n: many.length }),
        style: `left: ${menu.x}px; top: ${menu.y}px`,
        mount: (node: HTMLElement) => {
          // Inside the drive, wherever it was asked for.
          const box = element.getBoundingClientRect();
          const own = node.getBoundingClientRect();
          if (own.right > box.right - 8) node.style.left = `${Math.max(8, menu.x - own.width)}px`;
          if (own.bottom > box.bottom - 8) node.style.top = `${Math.max(8, menu.y - own.height)}px`;
          node.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        },
        onKeydown: (event: KeyboardEvent) => {
          const all = [...element.querySelectorAll<HTMLButtonElement>('.rf-ctx [role="menuitem"], .rf-ctx [role="menuitemradio"]')];
          const at = all.indexOf(document.activeElement as HTMLButtonElement);
          const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key];
          if (to !== undefined) {
            event.preventDefault();
            all[(to + all.length) % all.length]?.focus();
          } else if (event.key === 'Escape' || event.key === 'Tab') {
            event.preventDefault();
            closeContext();
          }
        },
      },
      actions,
    );
  }

  /** A .zip being made, of what was picked: how far it is, and what stops it. */
  let zipping: { name: string; read: number; size: number; stop: AbortController } | null = null;
  const zipDownload = async (entries: Pick<Entry, 'id' | 'name'>[], named?: string, of?: { pack: () => Promise<Packed>; extra?: { path: string; text: string }[] }) => {
    if (zipping) return;
    // Named after the one, or after where they are.
    const name = named ?? (entries.length === 1 ? entries[0].name : `${t('filesZip')} ${new Date().toISOString().slice(0, 10)}`);
    const job = { name: `${name}.zip`, read: 0, size: 0, stop: new AbortController() };
    zipping = job;
    render();
    try {
      const done = await downloadZip(
        of ? { pack: of.pack, urls: client.urls } : client,
        entries.map((entry) => entry.id),
        {
          name,
          extra: of?.extra,
          signal: job.stop.signal,
          onProgress: ({ read, size }) => {
            job.read = read;
            job.size = size;
            render();
          },
        },
      );
      // What could not be read, offered on its own: a cut while it was read, an address run out.
      if (done.missed.length)
        say(t('zipMissed', { name: job.name, n: done.missed.length }), undefined, {
          label: t('zipTheRest'),
          run: () =>
            void zipDownload(
              done.missed.map((file) => ({ id: file.id, name: file.path.split('/').pop() ?? file.path })),
              `${name} (${t('zipRest')})`,
            ),
        });
      else say(t('zipped', { name: job.name }));
    } catch (error) {
      say(job.stop.signal.aborted || (error as Error).name === 'AbortError' ? t('zipStopped') : said(error));
    } finally {
      zipping = null;
      render();
    }
  };

  /** Everything of one's own in a .zip: the files at their places, and what one said and did in a file of JSON beside them. */
  const exportMine = async () => {
    const exported = await client.exportPerson();
    const { pack, ...rest } = exported;
    await zipDownload([], `${t('exportMine')} ${exported.at.slice(0, 10)}`, { pack: async () => pack, extra: [{ path: 'rebofiles-export.json', text: JSON.stringify(rest, null, 2) }] });
  };

  /** What can be done to all that is picked at once. */
  const pickedActions = (many: Entry[], wide = false): Child[] => {
    const cls = (extra = '') => `rf-btn${wide ? '' : ' rf-small'}${extra}`;
    // In the bar, the words go on a narrow screen and the icons stay, the words still their names.
    const labelled = (name: IconName, text: string): Child => (wide ? withIcon(name, text) : [icon(name, 16), h('span', { class: 'rf-btn-text' }, text)]);
    return section === 'trash'
      ? [
          button(labelled('restore', t('restore')), () => void each(many, (entry) => client.restore(entry.id), 'restoredMany'), { class: cls(' rf-primary'), title: t('restore') }),
          button(labelled('trash', t('deleteForever')), () => ((dialog = { kind: 'delete', entries: many }), render()), { class: cls(' rf-text rf-danger'), title: t('deleteForever') }),
        ]
      : [
          // All of it in one .zip, folders with what is in them.
          button(labelled('download', t('downloadZip')), () => void zipDownload(many), { class: cls(), title: t('downloadZip') }),
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
      { class: 'rf-details rf-details-many', 'aria-label': t('details') },
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

  function details(listed: Entry | null, here: FolderEntry | null = null) {
    const found = listed ? detail(listed.id) : null;
    // The entry as the server says it is now, once it has said; as the list had it until then.
    const entry = found?.current && found.value && listed && found.value.entry.id === listed.id ? found.value.entry : listed;
    if (!entry)
      return h(
        'aside',
        { class: 'rf-details', 'aria-label': t('details') },
        // In a folder with requests for files, nothing picked: those requests, what came of each.
        here && (here.links ?? []).some((link) => link.uploads) ? h('div', { class: 'rf-details-in' }, requestsCard(here)) : h('p', { class: 'rf-none' }, t('nothingSelected')),
      );
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
    const shown = !file && tab === 'versions' ? 'details' : tab;
    const row = (term: string, value: Child, title?: string) => [h('dt', null, term), h('dd', { title }, value)];
    return h(
      'aside',
      {
        class: 'rf-details rf-details-on',
        'aria-label': t('details'),
        // On a phone it is a sheet over the drive: a tap around it closes it.
        onClick: (event: Event) => event.target === event.currentTarget && select(null),
      },
      h(
        'div',
        { class: 'rf-details-in' },
        h('span', { class: 'rf-sheet-grip', 'aria-hidden': 'true' }),
        button(icon('close', 18), () => select(null), { class: 'rf-sheet-x', 'aria-label': t('close') }),
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
                file
                  ? button(withIcon('download', t('download')), () => void attempt(download), { class: 'rf-btn rf-act-download' })
                  : button(withIcon('download', t('downloadZip')), () => void zipDownload([entry]), { class: 'rf-btn rf-act-download' }),
                button(withIcon(file ? 'eye' : 'external', t('open')), () => void open(entry), { class: 'rf-btn rf-act-open' }),
                button(withIcon('pencil', t('rename')), () => ((dialog = { kind: 'rename', entry, name: entry.name }), render()), { class: 'rf-btn' }),
                button(withIcon('move', t('move')), () => ((dialog = { kind: 'move', entries: [entry], at: null }), (movedInto = false), render()), { class: 'rf-btn' }),
                button(withIcon('users', t('share')), () => ((dialog = { kind: 'share', entry, who: '', role: 'viewer' }), render()), { class: 'rf-btn rf-act-share' }),
                button(withIcon('star', isStarred(entry.id) ? t('unstar') : t('star')), () => void toggleStar(entry), { class: 'rf-btn rf-act-star', 'aria-pressed': isStarred(entry.id) }),
                file && button(withIcon('copy', t('makeCopy')), () => void makeCopy(file), { class: 'rf-btn' }),
                // A file that came through a request, looked at: kept, or turned back with a reason for who sent it.
                file?.fields?.via === 'request' &&
                  file.fields.review !== 'accepted' &&
                  button(withIcon('check', t('accept')), () => void attempt(() => client.review(file.id, 'accepted'), t('acceptedNow', { name: file.name })), { class: 'rf-btn rf-primary' }),
                file?.fields?.via === 'request' &&
                  file.fields.review !== 'rejected' &&
                  button(withIcon('back', t('return')), () => ((dialog = { kind: 'review', entry: file, reason: '' }), render()), { class: 'rf-btn rf-text rf-danger', 'aria-haspopup': 'dialog' }),
                !file && button(withIcon('upload', t('requestFiles')), () => requestFiles(entry as FolderEntry), { class: 'rf-btn' }),
                button(withIcon('trash', t('moveToTrash')), () => void each([entry], (one) => client.moveToTrash(one.id), 'trashedMany'), {
                  class: 'rf-btn rf-text rf-danger',
                }),
                // A legal hold, for who may configure the drive.
                settings?.canConfigure &&
                  button(
                    entry.hold ? t('releaseHold') : t('putOnHold'),
                    () =>
                      void attempt(() => (entry.hold ? client.release(entry.id) : client.hold(entry.id)), entry.hold ? t('nowReleased', { name: entry.name }) : t('nowOnHold', { name: entry.name })),
                    {
                      class: 'rf-btn rf-text',
                    },
                  ),
              ],
        ),
        h(
          'div',
          { class: 'rf-tabs', role: 'tablist' },
          button(t('details'), () => ((tab = 'details'), render()), { role: 'tab', 'aria-selected': shown === 'details' }),
          file && button(`${t('versions')} · ${file.versions.length}`, () => ((tab = 'versions'), render()), { role: 'tab', 'aria-selected': shown === 'versions' }),
          button(t('activity'), () => ((tab = 'activity'), render()), { role: 'tab', 'aria-selected': shown === 'activity' }),
          button(t('comments'), () => ((tab = 'comments'), render()), { role: 'tab', 'aria-selected': shown === 'comments' }),
        ),
        shown === 'comments'
          ? commentsOf(entry, inTrash)
          : shown === 'activity'
            ? activityList(entry)
            : shown === 'versions' && file
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
                        : [
                            // What changed from it to the version now, in the viewer.
                            options.compareDocument &&
                              kindOf(file) === 'docx' &&
                              button(t('compare'), () => ((comparing = version.id), view(file.id)), {
                                class: 'rf-link',
                                'aria-label': `${t('compare')} · ${t('version', { n: versionNumber(file, version.id) })}`,
                              }),
                            !inTrash &&
                              button(t('restore'), () => void attempt(() => client.restoreVersion(file.id, version.id), t('versionRestored', { n: versionNumber(file, version.id) })), {
                                class: 'rf-link',
                              }),
                          ],
                    ),
                  ),
                )
              : h(
                  'dl',
                  { class: 'rf-props' },
                  row(t('type'), file ? typeName(file) : t('folder'), file?.type),
                  file && row(t('size'), formatSize(file.versions[0].size, locale)),
                  !file && !inTrash && row(t('folderColor'), swatches([entry as FolderEntry], 'radio')),
                  row(t('owner'), entry.owner),
                  entry.hold ? row(t('onHold'), t('onHoldHint', { by: entry.hold.by }), entry.hold.reason) : null,
                  entry.shares?.length
                    ? row(
                        t('sharedWith'),
                        entry.shares
                          .map((s) => `${whoName(s.with)} · ${roleName(s.role)}${s.until ? ` · ${shareHolds(s) ? t('linkUntil', { date: formatDate(s.until, locale) }) : t('shareEnded')}` : ''}`)
                          .join(', '),
                      )
                    : null,
                  row(t('modified'), `${formatDate(entry.modified, locale)} · ${whoName(entry.modifiedBy)}`),
                  where && row(t('location'), where),
                  // What came through a request: who sent it, the document it is, and how it was looked at.
                  entry.fields?.via === 'request' && entry.fields.from && row(t('cameFromLabel'), entry.fields.from),
                  entry.fields?.via === 'request' && entry.fields.item && row(t('documentLabel'), entry.fields.item),
                  entry.fields?.expires &&
                    row(
                      t('expiresLabel'),
                      h(
                        'span',
                        { class: 'rf-row-end' },
                        expiryTag(entry),
                        button(t('askAgain'), () => askAgain(entry), { class: 'rf-link' }),
                      ),
                    ),
                  entry.fields?.check && row(t('checkLabel'), checkTag(entry)),
                  entry.fields?.same && row(t('sameLabel'), sameTag(entry)),
                  entry.fields?.review === 'rejected' && row(t('returned'), entry.fields.reviewReason || '—'),
                  options.fields !== false &&
                    Object.entries(entry.fields ?? {})
                      .filter(([name]) => !INTERNAL_FIELDS.includes(name))
                      .map(([name, value]) => row(name, value)),
                  file && row(t('key'), h('code', null, file.versions[0].key)),
                ),
        options.fields === 'edit' &&
          shown === 'details' &&
          !inTrash &&
          button(withIcon('pencil', t('editFields')), () => ((dialog = { kind: 'fields', entry, text: fieldsText(entry) }), render()), { class: 'rf-btn rf-small rf-edit-fields' }),
        entry.kind === 'folder' && shown === 'details' && !inTrash && (entry.links ?? []).some((link) => link.uploads) && requestsCard(entry as FolderEntry),
      ),
    );
  }

  /** What is said of an entry, a thread at a time, and a box to say more: a reply under one, one's own changed. */
  function commentsOf(entry: Entry, inTrash: boolean) {
    const found = remarks(entry.id);
    if (found.error) return h('p', { class: 'rf-hint', role: 'alert' }, said(found.error));
    if (!found.current || !found.value) return h('p', { class: 'rf-hint' }, t('loading'));
    const all = found.value;
    const send = () => {
      const text = draft.trim();
      if (!text) return;
      const to = replyingTo?.id;
      void attempt(async () => {
        await client.addComment(entry.id, text, to);
        draft = '';
        replyingTo = null;
      });
    };
    const one = (comment: Comment) => {
      const mine = comment.by === settings?.you;
      const top = !comment.replyTo;
      const isEditing = editing?.id === comment.id;
      return h(
        'li',
        { key: comment.id, class: `rf-comment${top ? '' : ' rf-reply'}${comment.resolved ? ' rf-resolved' : ''}` },
        h('div', { class: 'rf-comment-head' }, h('strong', null, comment.by), h('small', null, `${formatDate(comment.at, locale)}${comment.edited ? ` · ${t('edited')}` : ''}`)),
        isEditing
          ? h(
              'form',
              {
                class: 'rf-comment-edit',
                onSubmit: (event: Event) => {
                  event.preventDefault();
                  const text = editing!.text;
                  void attempt(async () => {
                    await client.editComment(entry.id, comment.id, text);
                    editing = null;
                  });
                },
              },
              h('textarea', {
                'aria-label': t('editComment'),
                value: editing!.text,
                mount: (field: HTMLElement) => (field as HTMLTextAreaElement).focus(),
                onInput: (event: Event) => (editing = { id: comment.id, text: (event.target as HTMLTextAreaElement).value }),
                onKeydown: (event: KeyboardEvent) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    (event.target as HTMLTextAreaElement).form?.requestSubmit();
                  } else if (event.key === 'Escape') {
                    event.stopPropagation();
                    editing = null;
                    render();
                  }
                },
              }),
              actionsRow(
                button(t('cancel'), () => ((editing = null), render()), { class: 'rf-btn' }),
                h('button', { type: 'submit', class: 'rf-btn rf-primary' }, t('save')),
              ),
            )
          : h('p', null, comment.text),
        top && comment.resolved && h('small', { class: 'rf-hint' }, t('resolvedBy', { by: comment.resolved.by })),
        !inTrash &&
          !isEditing &&
          h(
            'div',
            { class: 'rf-comment-actions' },
            button(t('reply'), () => ((replyingTo = comment), render()), { class: 'rf-link', 'aria-label': `${t('reply')} · ${comment.by}` }),
            top && button(comment.resolved ? t('reopen') : t('resolve'), () => void attempt(() => client.resolveComment(entry.id, comment.id, !comment.resolved)), { class: 'rf-link' }),
            mine && button(t('editComment'), () => ((editing = { id: comment.id, text: comment.text }), render()), { class: 'rf-link' }),
            mine && button(t('deleteComment'), () => void attempt(() => client.removeComment(entry.id, comment.id)), { class: 'rf-link rf-danger' }),
          ),
      );
    };
    return h(
      'div',
      { class: 'rf-comments' },
      all.length ? h('ol', { class: 'rf-comment-list', 'aria-label': t('comments') }, all.map(one)) : h('p', { class: 'rf-hint' }, t('noComments')),
      !inTrash &&
        h(
          'form',
          {
            class: 'rf-comment-new',
            onSubmit: (event: Event) => {
              event.preventDefault();
              send();
            },
          },
          replyingTo &&
            h(
              'p',
              { class: 'rf-hint' },
              t('replyTo', { who: replyingTo.by }),
              ' ',
              button(t('cancel'), () => ((replyingTo = null), render()), { class: 'rf-link' }),
            ),
          h('textarea', {
            'aria-label': replyingTo ? t('replyTo', { who: replyingTo.by }) : t('addComment'),
            placeholder: t('addComment'),
            value: draft,
            rows: 3,
            onInput: (event: Event) => (draft = (event.target as HTMLTextAreaElement).value),
            // ⌘Enter or Ctrl+Enter sends it, as in a chat.
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            },
          }),
          h('div', { class: 'rf-row-end' }, h('button', { type: 'submit', class: 'rf-btn rf-primary' }, t('commentButton'))),
        ),
    );
  }

  /** What was done to an entry, and in it, the newest first: who, what, when. */
  function activityList(entry: Entry) {
    const found = happened(entry.id);
    const lines = found.value ?? [];
    if (!found.current || !found.value) return h('p', { class: 'rf-hint' }, t('loading'));
    if (!lines.length) return h('p', { class: 'rf-hint' }, t('noActivity'));
    return h(
      'ol',
      { class: 'rf-activity', 'aria-label': t('activity') },
      lines.map((a, i) => h('li', { key: `${a.at}${a.action}${a.entry}${i}` }, h('span', null, activityText(a)), h('small', null, formatDate(a.at, locale)))),
    );
  }
  const activityText = (a: Activity) => {
    const by = a.by === 'trash' ? t('theTrash') : a.by.startsWith('link:') ? t('throughLink') : a.by;
    const values = { by, name: a.name, was: a.was ?? '', with: a.with ? whoName(a.with) : '', role: a.role ? roleName(a.role) : '' };
    const key = (
      {
        colored: 'didColor',
        created: 'didCreate',
        uploaded: 'didUpload',
        version: 'didVersion',
        renamed: 'didRename',
        moved: 'didMove',
        trashed: 'didTrash',
        restored: 'didRestore',
        deleted: 'didDelete',
        shared: 'didShare',
        unshared: 'didUnshare',
        linked: 'didLink',
        unlinked: 'didUnlink',
        commented: 'didComment',
        held: 'didHold',
        released: 'didRelease',
      } as const
    )[a.action];
    return t(key, values);
  };

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
            const dot = input.value.lastIndexOf('.');
            input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
          },
        }),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: !name.trim() || name.trim() === initial }, action)),
      ),
    );
  }

  /** An entry's fields as they are written in their dialog: a line each, `name: value`. */
  const fieldsText = (entry: Entry) =>
    Object.entries(entry.fields ?? {})
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');
  function fieldsDialog(entry: Entry, text: string) {
    const save = () => {
      // What is written now: typing changes the dialog without drawing it again.
      const written = dialog?.kind === 'fields' ? dialog.text : text;
      const given: Record<string, string> = {};
      for (const line of written.split('\n')) {
        const at = line.indexOf(':');
        if (at > 0) given[line.slice(0, at).trim()] = line.slice(at + 1).trim();
      }
      // Those no longer written taken away; the rest set as they are.
      const fields: Record<string, string | null> = { ...given };
      for (const name of Object.keys(entry.fields ?? {})) if (!(name in given)) fields[name] = null;
      closeDialog();
      void attempt(() => client.setFields(entry.id, fields), t('fieldsSaved'));
    };
    return modal(
      t('editFields'),
      h(
        'form',
        { onSubmit: (event: Event) => (event.preventDefault(), save()) },
        h('h2', null, t('editFields')),
        h('p', { class: 'rf-hint', id: 'rf-fields-hint', style: 'margin: 0' }, t('fieldsHint')),
        h('textarea', {
          class: 'rf-fields-text',
          rows: 6,
          'aria-label': t('editFields'),
          'aria-describedby': 'rf-fields-hint',
          value: text,
          placeholder: 'client: acme',
          onInput: (event: Event) => {
            if (dialog?.kind === 'fields') dialog.text = (event.target as HTMLTextAreaElement).value;
          },
          mount: (field: HTMLElement) => field.focus(),
        }),
        actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary' }, t('save'))),
      ),
    );
  }

  /** What a request takes, as the dialog offers it: the types and endings of each choice. */
  const KINDS: [string, 'kindPdf' | 'kindPhotos' | 'kindWord' | 'kindExcel', string[]][] = [
    ['pdf', 'kindPdf', ['application/pdf', '.pdf']],
    ['photos', 'kindPhotos', ['image/*']],
    ['word', 'kindWord', ['.docx', '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
    ['excel', 'kindExcel', ['.xlsx', '.xls', '.csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
  ];
  const MB = 1024 * 1024;
  const fresh = (entry: FolderEntry): RequestDialog => ({
    kind: 'request',
    entry,
    mode: 'only',
    days: 7,
    password: '',
    title: '',
    email: '',
    items: [],
    questions: [],
    closeWhenDone: true,
    remind: 0,
    message: '',
    accept: [],
    maxSize: 0,
    maxFiles: 0,
    perSender: false,
    rename: '',
    fieldsText: '',
    askName: true,
  });
  /** A request for files of a folder: a link that takes files, made in a dialog of its own. */
  const requestFiles = (entry: FolderEntry) => ((dialog = fresh(entry)), render());
  /** The request a dialog holds, as the server takes it. */
  const requestOf = (asked: RequestDialog): FileRequest => {
    const fields: Record<string, string> = {};
    for (const line of asked.fieldsText.split('\n')) {
      const at = line.indexOf(':');
      if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    const items = asked.items.filter((item) => item.label.trim());
    const questions = asked.questions.filter((question) => question.label.trim());
    const uniqueField = (field: string, before: AskedQuestion[]) => {
      const used = new Set(before.map((one) => one.field ?? fieldFor(one.label.trim())));
      let made = field;
      for (let n = 2; used.has(made); n++) made = `${field}_${n}`;
      return made;
    };
    const taken = new Set(items.map((item) => item.id).filter(Boolean));
    let next = 1;
    const idOf = (item: AskedItem) => {
      if (item.id) return item.id;
      while (taken.has(`d${next}`)) next++;
      taken.add(`d${next}`);
      return `d${next}`;
    };
    return {
      ...(asked.title.trim() ? { title: asked.title.trim() } : {}),
      ...(asked.message.trim() ? { message: asked.message.trim() } : {}),
      ...(asked.askName ? { askName: true } : {}),
      ...(asked.email.trim() ? { email: asked.email.trim() } : {}),
      ...(items.length
        ? {
            items: items.map((item) => {
              const words = item.words
                .split(',')
                .map((word) => word.trim())
                .filter(Boolean);
              return {
                id: idOf(item),
                label: item.label.trim(),
                ...(words.length ? { words } : {}),
                ...(item.find ? { find: item.find } : {}),
                ...(item.expires ? { expires: true } : {}),
              };
            }),
          }
        : {}),
      ...(questions.length
        ? {
            questions: questions.map((question, i) => ({
              id: question.id ?? `q${i + 1}`,
              label: question.label.trim(),
              // Kept as the field it was, or as its name says; two of one name apart.
              field: question.field ?? uniqueField(fieldFor(question.label.trim()), questions.slice(0, i)),
              ...(question.required ? { required: true } : {}),
            })),
          }
        : {}),
      ...(asked.remind && asked.email.trim() ? { remind: asked.remind } : {}),
      ...(items.length && asked.closeWhenDone ? { closeWhenDone: true } : {}),
      ...(asked.perSender ? { perSender: true } : {}),
      ...(asked.rename.trim() ? { rename: asked.rename.trim() } : {}),
      ...(Object.keys(fields).length ? { fields } : {}),
      ...(asked.accept.length ? { accept: KINDS.filter(([id]) => asked.accept.includes(id)).flatMap(([, , types]) => types) } : {}),
      ...(asked.maxSize ? { maxSize: asked.maxSize * MB } : {}),
      ...(asked.maxFiles ? { maxFiles: asked.maxFiles } : {}),
    };
  };
  /** A link made before, in the dialog again to change what it asks. */
  const editRequest = (entry: FolderEntry, link: Link): RequestDialog => ({
    ...fromRequest(entry, link.request ?? {}),
    editing: link.id,
    mode: link.uploads === 'also' ? 'also' : 'only',
  });
  /** A dialog that asks what a request asks: of a link made before, or of a template. */
  const fromRequest = (entry: FolderEntry, request: FileRequest): RequestDialog => {
    return {
      ...fresh(entry),
      title: request.title ?? '',
      email: request.email ?? '',
      items: (request.items ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        words: (item.words ?? []).join(', '),
        expires: Boolean(item.expires),
        ...(item.find ? { find: item.find } : {}),
      })),
      questions: (request.questions ?? []).map((question) => ({ id: question.id, label: question.label, field: question.field, required: Boolean(question.required) })),
      closeWhenDone: Boolean(request.closeWhenDone),
      remind: request.remind ?? 0,
      message: request.message ?? '',
      accept: KINDS.filter(([, , types]) => types.some((type) => request.accept?.includes(type))).map(([id]) => id),
      maxSize: request.maxSize ? Math.round(request.maxSize / MB) : 0,
      maxFiles: request.maxFiles ?? 0,
      perSender: Boolean(request.perSender),
      rename: request.rename ?? '',
      fieldsText: Object.entries(request.fields ?? {})
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n'),
      askName: Boolean(request.askName),
    };
  };
  /** The document dragged in the list of a request, while it is. */
  let dragging: number | null = null;
  /** A list with one of its items put in another place. */
  const moved = <T>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one);
    return next;
  };
  /** What came through a request, of what it asks: “2 of 3 documents”, or how many files. */
  const progressOf = (link: Link) => {
    const items = link.request?.items ?? [];
    const came = items.filter((item) => link.got?.items?.[item.id]).length;
    return items.length ? { done: came, of: items.length, text: t('docsOf', { n: came, m: items.length }) } : { done: link.got?.files ?? 0, of: 0, text: t('filesCame', { n: link.got?.files ?? 0 }) };
  };

  /**
   * A request for files of a folder: whoever has the link sends files into it without an account. Written on the left,
   * seen on the right as whoever sends will see it; made, its address to copy, send by email or open, and the requests
   * of the folder with what came through each.
   */
  function requestDialog(asked: RequestDialog) {
    const of = asked.entry;
    const found = detail(of.id);
    const entry = found.current && found.value ? found.value.entry : of;
    const address = options.linkAddress ?? defaultAddress;
    const set = (change: Partial<RequestDialog>) => {
      if (dialog?.kind === 'request') Object.assign(dialog, change);
      render();
    };
    /** Typed, kept without drawing again; drawn on leaving the field, for the preview to follow. */
    const typed = (key: keyof RequestDialog) => ({
      onInput: (event: Event) => {
        if (dialog?.kind === 'request') (dialog as unknown as Record<string, unknown>)[key] = (event.target as HTMLInputElement).value;
      },
      onChange: () => render(),
    });
    const short = asked.password.length > 0 && asked.password.length < 4;
    const create = () =>
      void attempt(
        async () => {
          const request = requestOf(asked);
          if (asked.editing) {
            await client.updateLink(of.id, asked.editing, { uploads: asked.mode, request, days: asked.days });
            const token = await client.linkToken(of.id, asked.editing);
            set({ made: { address: address(token), link: asked.editing }, editing: undefined });
            return;
          }
          const link = await client.createLink(of.id, asked.days, { uploads: asked.mode, password: asked.password || undefined, request });
          const at = address(link.token);
          const made = (link.entry.links ?? []).at(-1)?.id ?? '';
          set({ made: { address: at, link: made }, password: '' });
          await navigator.clipboard?.writeText(at).catch(() => undefined);
        },
        asked.editing ? t('requestChanged') : t('linkCopied'),
      );
    const chip = (on: boolean, label: string, pick: () => void, key: string) => button(label, pick, { key, type: 'button', class: `rf-chip-btn${on ? ' rf-on' : ''}`, 'aria-pressed': on });
    const section = (title: string, ...content: Child[]) => h('fieldset', { class: 'rf-ask-box' }, h('legend', null, title), ...content);
    const toggle = (label: string, hint: string | null, on: boolean, flip: () => void) =>
      h('label', { class: 'rf-ask-toggle' }, h('span', null, h('strong', null, label), hint && h('small', null, hint)), h('input', { type: 'checkbox', role: 'switch', checked: on, onChange: flip }));
    const items = asked.items;
    const request = requestOf(asked);
    const owner = settings?.you ?? entry.owner;
    const until = formatDate(new Date(Date.now() + asked.days * 86_400_000).toISOString(), locale);
    const rules = [
      asked.accept.length
        ? KINDS.filter(([id]) => asked.accept.includes(id))
            .map(([, key]) => t(key))
            .join(', ')
        : null,
      asked.maxSize ? t('upTo', { size: `${asked.maxSize} MB` }) : null,
    ].filter(Boolean);
    const requests = (entry.links ?? []).filter((link) => link.uploads);
    const templates = options.requestTemplates === false ? [] : (settings?.drive.requestTemplates ?? []);
    const canTemplate = options.requestTemplates !== false && Boolean(settings?.canConfigure);
    /** What it asks kept as a template, for everyone of the drive: what it asks and how, not to whom. */
    const saveTemplate = (name: string) =>
      void attempt(
        async () => {
          const { email: _, title: __, ...kept } = requestOf(asked);
          const others = templates.filter((one) => one.name.toLowerCase() !== name.toLowerCase());
          let n = templates.length + 1;
          while (templates.some((one) => one.id === `t${n}`)) n++;
          await client.saveSettings({ requestTemplates: [...others, { id: `t${n}`, name, request: kept }] });
          await loadSettings();
          set({ templateName: undefined });
        },
        t('templateSaved', { name }),
      );

    // Made: the address, and what to do with it.
    if (asked.made) {
      const made = (entry.links ?? []).find((link) => link.id === asked.made!.link);
      const subject = encodeURIComponent(t('mailSubject', { name: of.name }));
      const mailBody = encodeURIComponent(`${request.message ? `${request.message}\n\n` : ''}${asked.made.address}`);
      return modal(
        t('requestReady'),
        h(
          'div',
          { class: 'rf-request rf-ready' },
          h(
            'div',
            { class: 'rf-ready-head' },
            h('span', { class: 'rf-ready-mark', 'aria-hidden': 'true' }, icon('check', 22)),
            h('div', null, h('h2', null, t('requestReady')), h('p', { class: 'rf-hint' }, t('requestReadyHint'))),
          ),
          h(
            'div',
            { class: 'rf-made' },
            icon('link', 16),
            h('input', { type: 'text', readonly: true, 'aria-label': t('requestAddress'), value: asked.made.address, mount: (field: HTMLElement) => (field as HTMLInputElement).select() }),
            button(withIcon('copy', t('copyLink')), () => void attempt(async () => navigator.clipboard.writeText(asked.made!.address), t('linkCopied')), { class: 'rf-btn rf-primary' }),
          ),
          options.qr !== false &&
            h(
              'div',
              { class: 'rf-ready-qr' },
              h('div', {
                key: asked.made.address,
                class: 'rf-qr',
                // Drawn once, as an SVG of its own: not the screen's to change.
                'data-own': '',
                role: 'img',
                'aria-label': t('qrOf', { name: request.title ?? of.name }),
                mount: (box: HTMLElement) => (box.innerHTML = qrSvg(asked.made!.address, { margin: 2 })),
              }),
              h(
                'div',
                null,
                h('strong', null, t('qrTitle')),
                h('p', { class: 'rf-hint' }, t('qrHint')),
                button(
                  withIcon('download', t('qrDownload')),
                  () =>
                    void attempt(async () => {
                      const png = await qrPng(asked.made!.address);
                      const url = URL.createObjectURL(png);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `QR - ${request.title ?? of.name}.png`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }),
                  { class: 'rf-btn' },
                ),
              ),
            ),
          made &&
            h(
              'div',
              { class: 'rf-tags' },
              h('span', { class: 'rf-tag rf-tag-on' }, made.uploads === 'only' ? t('linkOnlyAdds') : t('linkSeesAndAdds')),
              made.request?.askName && h('span', { class: 'rf-tag' }, t('asksName')),
              made.locked && h('span', { class: 'rf-tag' }, t('linkLocked')),
              h('span', { class: 'rf-tag' }, t('linkUntil', { date: formatDate(made.expires, locale) })),
            ),
          h(
            'div',
            { class: 'rf-ready-actions' },
            h('a', { class: 'rf-btn', href: `mailto:${encodeURIComponent(request.email ?? '')}?subject=${subject}&body=${mailBody}` }, icon('mail', 16), t('sendByEmail')),
            h('a', { class: 'rf-btn', href: asked.made.address, target: '_blank', rel: 'noopener' }, icon('external', 16), t('viewAsGuest')),
            made && button(withIcon('pencil', t('changeOptions')), () => ((dialog = editRequest(of, made)), render()), { class: 'rf-btn' }),
          ),
          requestsList(of, requests),
          actionsRow(button(t('done'), closeDialog, { class: 'rf-btn' })),
        ),
      );
    }

    return modal(
      t('requestTitle', { name: of.name }),
      h(
        'form',
        { class: 'rf-request rf-ask', onSubmit: (event: Event) => (event.preventDefault(), !short && create()) },
        h(
          'div',
          { class: 'rf-ask-form' },
          h('h2', null, asked.editing ? t('changeOptions') : t('requestTitle', { name: of.name })),
          h('p', { class: 'rf-hint', style: 'margin: 0' }, t('requestIntro')),
          !asked.editing &&
            templates.length > 0 &&
            h(
              'label',
              { class: 'rf-ask-field rf-ask-template' },
              h('span', null, t('startFromTemplate')),
              h(
                'select',
                {
                  class: 'rf-select',
                  value: '',
                  onChange: (event: Event) => {
                    const picked = templates.find((one) => one.id === (event.target as HTMLSelectElement).value);
                    if (!picked) return;
                    // What it asks, as the template says; to whom, as written already.
                    dialog = { ...fromRequest(of, picked.request), mode: asked.mode, days: asked.days, title: asked.title, email: asked.email, password: asked.password };
                    render();
                  },
                },
                h('option', { value: '' }, t('pickTemplate')),
                templates.map((one) => h('option', { key: one.id, value: one.id }, one.name)),
              ),
            ),
          h(
            'fieldset',
            { class: 'rf-choices' },
            h('legend', { class: 'rf-sr' }, t('linkLets')),
            ...(['only', 'also'] as const).map((mode) =>
              h(
                'label',
                { key: mode, class: `rf-choice${asked.mode === mode ? ' rf-on' : ''}` },
                h('input', { type: 'radio', name: `${prefix}-request-mode`, value: mode, checked: asked.mode === mode, onChange: () => set({ mode }) }),
                h('span', null, h('strong', null, mode === 'only' ? t('linkOnlyAdds') : t('linkSeesAndAdds')), h('small', null, mode === 'only' ? t('requestOnlyHint') : t('requestAlsoHint'))),
              ),
            ),
          ),
          h(
            'div',
            { class: 'rf-ask-two' },
            h('label', null, h('span', null, t('requestFor')), h('input', { type: 'text', value: asked.title, placeholder: 'Northwind', ...typed('title') })),
            h('label', null, h('span', null, t('theirEmail')), h('input', { type: 'email', value: asked.email, placeholder: 'carla@northwind.com', ...typed('email') })),
          ),
          settings?.can?.remind &&
            h(
              'div',
              { class: 'rf-ask-row' },
              h('span', { class: 'rf-ask-label' }, t('remindThem')),
              ...[0, 2, 3, 7].map((n) => chip(asked.remind === n, n ? t('everyNDays', { n }) : t('never'), () => set({ remind: n }), `r${n}`)),
              asked.remind > 0 && !asked.email.trim() && h('small', { class: 'rf-hint' }, t('remindNeedsEmail')),
            ),
          section(
            t('docsAsked'),
            items.length
              ? h(
                  'ol',
                  { class: 'rf-ask-items' },
                  items.map((item, i) =>
                    h(
                      'li',
                      {
                        key: String(i),
                        class: item.open ? 'rf-open' : undefined,
                        // Put in another place by its handle, or by Alt and the arrows from its field.
                        onDragover: (event: DragEvent) => dragging !== null && event.preventDefault(),
                        onDrop: (event: DragEvent) => {
                          event.preventDefault();
                          if (dragging !== null && dragging !== i) set({ items: moved(items, dragging, i) });
                          dragging = null;
                        },
                      },
                      h(
                        'span',
                        {
                          class: 'rf-drag',
                          draggable: 'true',
                          title: t('dragToOrder'),
                          'aria-hidden': 'true',
                          onDragstart: (event: DragEvent) => {
                            dragging = i;
                            event.dataTransfer?.setData('text/plain', String(i));
                          },
                          onDragend: () => (dragging = null),
                        },
                        icon('grip', 14),
                      ),
                      h('input', {
                        type: 'text',
                        'aria-label': t('docN', { n: i + 1 }),
                        'aria-description': t('orderKeys'),
                        value: item.label,
                        onInput: (event: Event) => {
                          if (dialog?.kind === 'request') dialog.items[i].label = (event.target as HTMLInputElement).value;
                        },
                        onChange: () => render(),
                        onKeydown: (event: KeyboardEvent) => {
                          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
                          const to = i + (event.key === 'ArrowUp' ? -1 : 1);
                          if (to < 0 || to >= items.length) return;
                          event.preventDefault();
                          if (dialog?.kind === 'request') dialog.items[i].label = (event.target as HTMLInputElement).value;
                          set({ items: moved(dialog?.kind === 'request' ? dialog.items : items, i, to) });
                          afterRender.push(() => element.querySelectorAll<HTMLInputElement>('.rf-ask-items input')[to]?.focus());
                        },
                      }),
                      !item.open &&
                        (item.words.trim() || item.expires) &&
                        h(
                          'span',
                          { class: 'rf-ask-item-tags' },
                          item.words.trim() && h('span', { class: 'rf-tag', title: t('mustSay') }, icon('search', 12), item.words.trim()),
                          item.expires && h('span', { class: 'rf-tag' }, icon('clock', 12), t('asksExpiry')),
                        ),
                      button(icon('more', 14), () => set({ items: items.map((one, at) => (at === i ? { ...one, open: !one.open } : one)) }), {
                        class: 'rf-btn rf-icon',
                        'aria-expanded': Boolean(item.open),
                        'aria-label': `${t('docOptions')} · ${item.label || t('docN', { n: i + 1 })}`,
                      }),
                      button(icon('close', 14), () => set({ items: items.filter((_, at) => at !== i) }), {
                        class: 'rf-btn rf-icon',
                        'aria-label': `${t('remove')} · ${item.label || t('docN', { n: i + 1 })}`,
                      }),
                      item.open &&
                        h(
                          'div',
                          { class: 'rf-ask-item-more' },
                          h(
                            'label',
                            { class: 'rf-ask-field' },
                            h('span', null, t('mustSay')),
                            h('input', {
                              type: 'text',
                              value: item.words,
                              placeholder: t('mustSayExample'),
                              onInput: (event: Event) => {
                                if (dialog?.kind === 'request') dialog.items[i].words = (event.target as HTMLInputElement).value;
                              },
                              onChange: () => render(),
                            }),
                            h('small', { class: 'rf-hint' }, t('mustSayHint')),
                          ),
                          toggle(t('asksExpiry'), t('asksExpiryHint'), item.expires, () => set({ items: items.map((one, at) => (at === i ? { ...one, expires: !one.expires } : one)) })),
                        ),
                    ),
                  ),
                )
              : h('p', { class: 'rf-hint', style: 'margin: 0' }, t('docsAskedHint')),
            button(
              `+ ${t('addDoc')}`,
              () => (
                set({ items: [...items, { label: '', words: '', expires: false }] }), afterRender.push(() => element.querySelector<HTMLInputElement>('.rf-ask-items li:last-child input')?.focus())
              ),
              {
                class: 'rf-link',
              },
            ),
            items.length > 0 && toggle(t('closeWhenDone'), null, asked.closeWhenDone, () => set({ closeWhenDone: !asked.closeWhenDone })),
          ),
          section(
            t('dataAsked'),
            asked.questions.length
              ? h(
                  'ol',
                  { class: 'rf-ask-items rf-ask-questions' },
                  asked.questions.map((question, i) =>
                    h(
                      'li',
                      { key: `q${i}` },
                      h('input', {
                        type: 'text',
                        'aria-label': t('dataN', { n: i + 1 }),
                        placeholder: t('dataExample'),
                        value: question.label,
                        onInput: (event: Event) => {
                          if (dialog?.kind === 'request') dialog.questions[i].label = (event.target as HTMLInputElement).value;
                        },
                        onChange: () => render(),
                      }),
                      h(
                        'label',
                        { class: 'rf-ask-required' },
                        h('input', {
                          type: 'checkbox',
                          checked: question.required,
                          onChange: () => set({ questions: asked.questions.map((one, at) => (at === i ? { ...one, required: !one.required } : one)) }),
                        }),
                        h('span', null, t('required')),
                      ),
                      button(icon('close', 14), () => set({ questions: asked.questions.filter((_, at) => at !== i) }), {
                        class: 'rf-btn rf-icon',
                        'aria-label': `${t('remove')} · ${question.label || t('dataN', { n: i + 1 })}`,
                      }),
                    ),
                  ),
                )
              : h('p', { class: 'rf-hint', style: 'margin: 0' }, t('dataAskedHint')),
            button(
              `+ ${t('addData')}`,
              () => (
                set({ questions: [...asked.questions, { label: '', required: true }] }),
                afterRender.push(() => element.querySelector<HTMLInputElement>('.rf-ask-questions li:last-child input')?.focus())
              ),
              { class: 'rf-link' },
            ),
          ),
          h('label', { class: 'rf-ask-field' }, h('span', null, t('messageForThem')), h('textarea', { rows: 2, value: asked.message, ...typed('message') })),
          section(
            t('whatYouTake'),
            h(
              'div',
              { class: 'rf-chips', role: 'group', 'aria-label': t('whatYouTake') },
              ...KINDS.map(([id, key]) =>
                chip(asked.accept.includes(id), t(key), () => set({ accept: asked.accept.includes(id) ? asked.accept.filter((one) => one !== id) : [...asked.accept, id] }), id),
              ),
              chip(asked.accept.length === 0, t('anyFile'), () => set({ accept: [] }), 'any'),
            ),
            h(
              'div',
              { class: 'rf-ask-two' },
              h(
                'label',
                null,
                h('span', null, t('largestFile')),
                h(
                  'select',
                  { class: 'rf-select', value: String(asked.maxSize), onChange: (event: Event) => set({ maxSize: Number((event.target as HTMLSelectElement).value) }) },
                  [0, 10, 25, 100, 1000].map((n) => h('option', { key: String(n), value: String(n) }, n ? `${n} MB` : t('noLimit'))),
                ),
              ),
              h(
                'label',
                null,
                h('span', null, t('mostFiles')),
                h(
                  'select',
                  { class: 'rf-select', value: String(asked.maxFiles), onChange: (event: Event) => set({ maxFiles: Number((event.target as HTMLSelectElement).value) }) },
                  [0, 1, 5, 10, 50].map((n) => h('option', { key: String(n), value: String(n) }, n ? String(n) : t('noLimit'))),
                ),
              ),
            ),
          ),
          section(
            t('howItArrives'),
            toggle(t('perSender'), `${of.name} / Carla Ruiz /`, asked.perSender, () => set({ perSender: !asked.perSender })),
            h(
              'label',
              { class: 'rf-ask-field' },
              h('span', null, t('renameAs')),
              h('input', { type: 'text', class: 'rf-mono', value: asked.rename, placeholder: '{item} - {name}', ...typed('rename') }),
              h('small', { class: 'rf-hint' }, t('renameHint')),
            ),
            h(
              'label',
              { class: 'rf-ask-field' },
              h('span', null, t('tagWith')),
              h('textarea', { rows: 2, class: 'rf-mono', value: asked.fieldsText, placeholder: 'client: northwind', ...typed('fieldsText') }),
            ),
          ),
          h(
            'div',
            { class: 'rf-ask-row' },
            h('span', { class: 'rf-ask-label' }, t('linkLasts')),
            ...[1, 7, 30].map((n) => chip(asked.days === n, n === 1 ? t('linkDay') : t('linkDays', { n }), () => set({ days: n }), `d${n}`)),
          ),
          toggle(t('askName'), t('askNameHint'), asked.askName, () => set({ askName: !asked.askName })),
          !asked.editing &&
            h(
              'label',
              { class: 'rf-ask-field' },
              h('span', null, t('linkPassword')),
              h('input', { type: 'password', autocomplete: 'new-password', placeholder: t('linkPasswordOptional'), value: asked.password, ...typed('password') }),
            ),
          short && h('p', { class: 'rf-hint' }, t('linkPasswordShort')),
          h(
            'div',
            { class: 'rf-ask-foot' },
            h('small', { class: 'rf-hint' }, request.email ? t('remindHint') : t('yoursHint')),
            canTemplate && asked.templateName === undefined && button(t('saveAsTemplate'), () => set({ templateName: asked.title.trim() }), { class: 'rf-link' }),
            button(t('cancel'), closeDialog, { class: 'rf-btn' }),
            h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: short }, asked.editing ? t('save') : t('createLink')),
          ),
          canTemplate &&
            asked.templateName !== undefined &&
            h(
              'div',
              { class: 'rf-ask-save-template', role: 'group', 'aria-label': t('saveAsTemplate') },
              h(
                'label',
                { class: 'rf-ask-field' },
                h('span', null, t('templateName')),
                h('input', {
                  type: 'text',
                  value: asked.templateName,
                  placeholder: t('templateExample'),
                  mount: (field: HTMLElement) => field.focus(),
                  onInput: (event: Event) => {
                    if (dialog?.kind === 'request') dialog.templateName = (event.target as HTMLInputElement).value;
                  },
                  onKeydown: (event: KeyboardEvent) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const name = (event.target as HTMLInputElement).value.trim();
                    if (name) saveTemplate(name);
                  },
                }),
              ),
              button(t('save'), () => asked.templateName?.trim() && saveTemplate(asked.templateName.trim()), { class: 'rf-btn rf-primary' }),
              button(t('cancel'), () => set({ templateName: undefined }), { class: 'rf-btn' }),
            ),
          !asked.editing && requests.length > 0 && requestsList(of, requests),
        ),
        // As whoever sends will see it, as it is written.
        h(
          'aside',
          { class: 'rf-ask-preview', 'aria-label': t('asTheyWillSee') },
          h('span', { class: 'rf-ask-label' }, t('asTheyWillSee')),
          h(
            'div',
            { class: 'rf-ask-card' },
            h(
              'div',
              { class: 'rf-ask-who' },
              h('span', { class: 'rf-avatar' }, owner.slice(0, 1).toUpperCase()),
              h(
                'div',
                null,
                h('strong', null, items.filter((one) => one.label.trim()).length ? t('asksDocs', { who: owner, n: items.filter((one) => one.label.trim()).length }) : t('asksFiles', { who: owner })),
                h('small', null, `${asked.title.trim() || of.name} · ${t('linkUntil', { date: until })}`),
              ),
            ),
            asked.message.trim() && h('p', { class: 'rf-ask-message' }, asked.message.trim()),
            items.filter((one) => one.label.trim()).length
              ? h(
                  'ul',
                  { class: 'rf-ask-docs' },
                  items
                    .filter((one) => one.label.trim())
                    .map((item, i) =>
                      h(
                        'li',
                        { key: String(i) },
                        h('span', { class: 'rf-ask-dot', 'aria-hidden': 'true' }),
                        h('span', null, item.label, item.expires && h('small', null, t('expiresOn'))),
                        h('b', null, t('uploadIt')),
                      ),
                    ),
                )
              : h('div', { class: 'rf-ask-drop' }, icon('upload', 22), h('strong', null, t('dragHere'))),
            asked.askName && h('div', { class: 'rf-ask-name' }, h('small', null, t('yourNameShort')), h('span', null, 'Carla Ruiz')),
            asked.questions
              .filter((one) => one.label.trim())
              .map((one, i) =>
                h('div', { key: `q${i}`, class: 'rf-ask-name' }, h('small', null, one.required ? t('neededLabel', { label: one.label.trim() }) : one.label.trim()), h('span', null, '…')),
              ),
            h('small', { class: 'rf-hint' }, [...rules, asked.mode === 'only' ? t('onlyOwnerSees', { who: owner }) : t('theySeeFolder')].join(' · ')),
          ),
        ),
      ),
    );
  }
  /** A request of a folder in its dialog, as made: its address to copy, and the folder's others. */
  const manageRequest = (of: FolderEntry, link: Link) =>
    void attempt(async () => {
      const token = await client.linkToken(of.id, link.id);
      dialog = { ...fresh(of), made: { address: (options.linkAddress ?? defaultAddress)(token), link: link.id } };
    });
  /** The head of the folder one is in: its name and colour, how much it holds, who it is shared with, and its requests open. */
  function folderHead(here: FolderEntry, entries: Entry[]) {
    const files = entries.filter((entry): entry is FileEntry => entry.kind === 'file');
    const size = files.reduce((sum, file) => sum + file.versions[0].size, 0);
    const now = new Date().toISOString();
    const open = (here.links ?? []).filter((link) => link.uploads && !link.closed && link.expires > now);
    const shares = (here.shares ?? []).filter((share) => shareHolds(share));
    const copyLink = (link: Link) => void attempt(async () => navigator.clipboard.writeText((options.linkAddress ?? defaultAddress)(await client.linkToken(here.id, link.id))), t('linkCopied'));
    return h(
      'div',
      { key: `here:${here.id}`, class: 'rf-folder-head' },
      h(
        'div',
        { class: 'rf-folder-row' },
        h('span', { class: `rf-folder-tile rf-k-folder${here.color ? ` rf-fc-${here.color}` : ''}`, 'aria-hidden': 'true' }, icon('folder', 22)),
        h(
          'div',
          { class: 'rf-folder-title' },
          h('h2', null, here.name),
          h(
            'div',
            { class: 'rf-folder-meta' },
            h('span', null, `${entries.length === 1 ? t('item') : t('items', { n: entries.length })} · ${formatSize(size, locale)}`),
            shares.length > 0 && h('span', { class: 'rf-tag' }, t('sharedWithN', { n: shares.length })),
            open.length > 0 && h('span', { class: 'rf-tag rf-tag-on' }, icon('upload', 12), t('receivesFiles')),
          ),
        ),
        h(
          'div',
          { class: 'rf-folder-actions' },
          button(withIcon('users', t('share')), () => ((dialog = { kind: 'share', entry: here, who: '', role: 'viewer' }), render()), { class: 'rf-btn' }),
          button(withIcon('upload', t('requestFiles')), () => requestFiles(here), { class: 'rf-btn rf-primary', 'aria-haspopup': 'dialog' }),
          button(
            icon('more', 18),
            (event: Event) => {
              // Under the button itself: the event comes to the drive, not to it.
              const at = ((event.target as HTMLElement).closest('.rf-here') ?? (event.target as HTMLElement)).getBoundingClientRect();
              openContext([here], { x: at.left, y: at.bottom + 4 }, true);
            },
            { class: 'rf-btn rf-icon rf-here', 'aria-label': t('folderOptions', { name: here.name }), title: t('folderOptions', { name: here.name }), 'aria-haspopup': 'menu' },
          ),
        ),
      ),
      open.map((link) => {
        const progress = progressOf(link);
        const missing = missingOf(link);
        return h(
          'div',
          { key: link.id, class: 'rf-request-strip', role: 'status' },
          h('span', { class: 'rf-strip-mark', 'aria-hidden': 'true' }, icon('link', 16)),
          h(
            'div',
            { class: 'rf-grow' },
            h('strong', null, `${link.request?.title ? `${link.request.title}: ` : ''}${progress.of ? progress.text : t('receivingFiles')}.`),
            h(
              'span',
              null,
              ` ${[missing.length ? t('missing', { what: missing.map((one) => one.label).join(', ') }) : progress.of ? null : progress.text, t('linkUntil', { date: formatDate(link.expires, locale) })]
                .filter(Boolean)
                .join(' · ')}`,
            ),
          ),
          button(t('copyLink'), () => copyLink(link), { class: 'rf-btn rf-small' }),
          button(t('manage'), () => manageRequest(here, link), { class: 'rf-btn rf-small rf-text' }),
        );
      }),
    );
  }

  // Received: what is shown of it, and the one being turned back with its reason.
  let receivedTab: 'review' | 'accepted' | 'returned' = 'review';
  let receivedRequest = '';
  let returning: { id: EntryId; reason: string } | null = null;
  const requestsNow = resource(() => client.requests().catch(() => [] as { folder: { id: EntryId; name: string }; link: Link; token: string }[]));
  const reviewOf = (entry: Entry) => (entry.fields?.review === 'accepted' ? 'accepted' : entry.fields?.review === 'rejected' ? 'returned' : 'review');
  /**
   * What came through one's requests for files, by request: what each asked and what is missing, and each file to accept
   * or turn back with a reason, there and then; those to look at, accepted or turned back.
   */
  /** Until when a file is good, as its field `expires` says: a tag, warned of from fifteen days before. */
  const expiryTag = (entry: Entry) => {
    const expires = entry.fields?.expires;
    if (!expires || !/^\d{4}-\d{2}-\d{2}/.test(expires)) return null;
    const days = Math.ceil((Date.parse(expires.slice(0, 10)) - Date.now()) / 86_400_000);
    const date = formatDate(`${expires.slice(0, 10)}T12:00:00Z`, locale);
    return h(
      'span',
      { class: `rf-tag${days <= 15 ? ' rf-tag-warn' : ''}`, title: t('expiresDate', { date }) },
      icon('clock', 12),
      days < 0 ? t('expiredOn', { date }) : days <= 15 ? t('expiresInDays', { n: days }) : t('expiresDate', { date }),
    );
  };
  /** What a check of a file that came found missing in what is written in it. */
  const checkTag = (entry: Entry) =>
    entry.fields?.check ? h('span', { class: 'rf-tag rf-tag-warn', title: t('checkHint') }, icon('search', 12), t('doesNotSay', { what: entry.fields.check })) : null;
  /** Of a file that came, one with the same bytes its owner had already: a tag, to go to it. */
  const sameTag = (entry: Entry) =>
    entry.fields?.same
      ? button(withIcon('copy', t('sameAsBefore'), 12), () => goToEntry(entry.fields!.same!), {
          class: 'rf-tag rf-tag-warn rf-tag-btn',
          title: t('sameAsBeforeHint'),
          'aria-label': `${t('sameAsBefore')} · ${entry.name}`,
        })
      : null;
  /** A document asked for again, of a file that came and stops being good: a request of it alone, in its folder. */
  const askAgain = (entry: Entry) =>
    void attempt(async () => {
      const { entry: folder } = await client.entry(entry.parent ?? '');
      if (folder.kind !== 'folder') return;
      const label = entry.fields?.item ?? entry.name.replace(/\.[^.]+$/, '');
      dialog = { ...fresh(folder), title: t('renewalOf', { what: label }), items: [{ label, words: '', expires: Boolean(entry.fields?.expires) }] };
      render();
    });

  function receivedView(all: Entry[]) {
    const files = all.filter((entry): entry is FileEntry => entry.kind === 'file');
    const requests = requestsNow('').value ?? [];
    const byLink = new Map(requests.map((one) => [one.link.id, one]));
    const count = (tab: typeof receivedTab) => files.filter((entry) => reviewOf(entry) === tab).length;
    const shown = files.filter((entry) => reviewOf(entry) === receivedTab && (!receivedRequest || entry.fields?.request === receivedRequest));
    const groups = new Map<string, FileEntry[]>();
    for (const entry of shown) groups.set(entry.fields?.request ?? '', [...(groups.get(entry.fields?.request ?? '') ?? []), entry]);
    const tab = (id: typeof receivedTab, text: string) => button(`${text} · ${count(id)}`, () => ((receivedTab = id), (returning = null), render()), { key: id, 'aria-pressed': receivedTab === id });
    const decide = (entry: FileEntry, status: 'accepted' | 'rejected', reason?: string) =>
      void attempt(
        () => client.review(entry.id, status, reason).then(() => (returning = null)),
        status === 'accepted' ? t('acceptedNow', { name: entry.name }) : t('returnedNow', { name: entry.name }),
      );
    return h(
      'div',
      { class: 'rf-received' },
      h(
        'div',
        { class: 'rf-received-bar' },
        h('div', { class: 'rf-received-tabs', role: 'group', 'aria-label': t('show') }, tab('review', t('toReview')), tab('accepted', t('acceptedPlural')), tab('returned', t('returnedPlural'))),
        requests.length > 1 &&
          h(
            'label',
            { class: 'rf-received-filter' },
            h('span', null, t('requestLabel')),
            h(
              'select',
              { class: 'rf-select', value: receivedRequest, onChange: (event: Event) => ((receivedRequest = (event.target as HTMLSelectElement).value), render()) },
              h('option', { value: '' }, t('allRequests')),
              requests.map((one) => h('option', { key: one.link.id, value: one.link.id }, one.link.request?.title || one.folder.name)),
            ),
          ),
      ),
      shown.length === 0
        ? h('p', { class: 'rf-empty' }, files.length ? t('noneHere') : t('noReceived'))
        : [...groups].map(([linkId, entries]) => {
            const made = byLink.get(linkId);
            const link = made?.link;
            const progress = link ? progressOf(link) : null;
            const missing = link ? missingOf(link) : [];
            const senders = [...new Set(entries.map((entry) => entry.fields?.from).filter(Boolean))].join(', ');
            return h(
              'section',
              { key: linkId || 'none', class: 'rf-received-group', 'aria-labelledby': `${prefix}-got-${linkId}` },
              h(
                'div',
                { class: 'rf-received-head' },
                h('h3', { id: `${prefix}-got-${linkId}` }, [link?.request?.title, made?.folder.name].filter(Boolean).join(' · ') || t('received')),
                h('small', null, [senders, progress?.text].filter(Boolean).join(' · ')),
                progress && progress.of > 0 && h('span', { class: 'rf-progress', 'aria-hidden': 'true' }, h('span', { style: `width: ${Math.round((progress.done / progress.of) * 100)}%` })),
                link &&
                  (missing.length && !link.closed
                    ? h('span', { class: 'rf-tag rf-tag-warn' }, t('missingCap', { what: missing.map((one) => one.label).join(', ') }))
                    : h('span', { class: 'rf-tag rf-tag-on' }, link.closed ? t('completeClosed') : t('complete'))),
              ),
              h(
                'ul',
                { class: 'rf-received-list' },
                entries.map((entry) => {
                  const turning = returning?.id === entry.id;
                  const meta = [
                    entry.fields?.item,
                    formatDate(entry.created, locale),
                    formatSize(entry.versions[0].size, locale),
                    // What was written to its questions, by their names.
                    ...Object.entries(entry.fields ?? {})
                      .filter(([name]) => !INTERNAL_FIELDS.includes(name))
                      .map(([name, value]) => `${link?.request?.questions?.find((one) => one.field === name)?.label ?? name}: ${value}`),
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return h(
                    'li',
                    { key: entry.id, class: turning ? 'rf-turning' : undefined },
                    h(
                      'div',
                      { class: 'rf-received-row' },
                      h('span', { class: 'rf-received-thumb' }, rowThumb(entry)),
                      h(
                        'div',
                        { class: 'rf-grow' },
                        button(entry.name, () => select(entry.id), { class: 'rf-received-name', onDblclick: () => view(entry.id) }),
                        h('small', null, meta),
                        (entry.fields?.check || entry.fields?.expires || entry.fields?.same) && h('span', { class: 'rf-tags' }, sameTag(entry), checkTag(entry), expiryTag(entry)),
                        entry.fields?.review === 'rejected' && entry.fields.reviewReason && h('small', { class: 'rf-error' }, entry.fields.reviewReason),
                      ),
                      !turning &&
                        h(
                          'div',
                          { class: 'rf-received-actions' },
                          reviewOf(entry) !== 'returned' &&
                            button(
                              t('return'),
                              () => ((returning = { id: entry.id, reason: '' }), render(), afterRender.push(() => element.querySelector<HTMLInputElement>('.rf-turning input')?.focus())),
                              {
                                class: 'rf-btn rf-small rf-danger-link',
                                'aria-label': `${t('return')} · ${entry.name}`,
                              },
                            ),
                          reviewOf(entry) !== 'accepted' &&
                            button(t('accept'), () => decide(entry, 'accepted'), { class: 'rf-btn rf-small rf-primary', 'aria-label': `${t('accept')} · ${entry.name}` }),
                          reviewOf(entry) === 'accepted' &&
                            entry.fields?.expires &&
                            Date.parse(entry.fields.expires.slice(0, 10)) - Date.now() <= 15 * 86_400_000 &&
                            button(t('askAgain'), () => askAgain(entry), { class: 'rf-btn rf-small', 'aria-label': `${t('askAgain')} · ${entry.name}` }),
                        ),
                    ),
                    turning &&
                      h(
                        'form',
                        {
                          class: 'rf-received-reason',
                          onSubmit: (event: Event) => (event.preventDefault(), decide(entry, 'rejected', returning?.reason.trim())),
                        },
                        h(
                          'label',
                          null,
                          h('span', null, t('returnReason')),
                          h('input', {
                            type: 'text',
                            placeholder: t('returnPlaceholder'),
                            onInput: (event: Event) => returning && (returning.reason = (event.target as HTMLInputElement).value),
                          }),
                        ),
                        h(
                          'div',
                          { class: 'rf-row-end' },
                          button(t('cancel'), () => ((returning = null), render()), { class: 'rf-btn' }),
                          h('button', { type: 'submit', class: 'rf-btn rf-primary rf-back-btn' }, entry.fields?.from ? t('returnAndTell', { who: entry.fields.from }) : t('return')),
                        ),
                      ),
                  );
                }),
              ),
            );
          }),
    );
  }

  /** The requests of a folder in its details, as cards: what each takes, what came, until when; to copy, close, and one more. */
  function requestsCard(of: FolderEntry) {
    const now = Date.now();
    const address = options.linkAddress ?? defaultAddress;
    const requests = (of.links ?? []).filter((link) => link.uploads);
    return h(
      'section',
      { class: 'rf-req-cards', 'aria-labelledby': `${prefix}-req-${of.id}` },
      h('h3', { id: `${prefix}-req-${of.id}` }, t('requestsMade')),
      requests.map((link) => {
        const progress = progressOf(link);
        const days = Math.ceil((Date.parse(link.expires) - now) / 86_400_000);
        const name = link.request?.title || (link.uploads === 'only' ? t('linkRequest') : t('linkTakesFiles'));
        const last = link.got?.last;
        return h(
          'div',
          { key: link.id, class: `rf-req-card${link.closed ? ' rf-closed' : ''}` },
          h('strong', null, name),
          h(
            'div',
            { class: 'rf-tags' },
            h('span', { class: 'rf-tag rf-tag-on' }, link.uploads === 'only' ? t('linkOnlyAdds') : t('linkSeesAndAdds')),
            link.locked && h('span', { class: 'rf-tag' }, t('linkLocked')),
            link.closed && h('span', { class: 'rf-tag' }, t('requestClosed')),
          ),
          h('small', null, [progress.text, last ? t('lastCame', { when: formatDate(last, locale) }) : null].filter(Boolean).join(' · ')),
          progress.of > 0 &&
            h(
              'span',
              { class: 'rf-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progress.of), 'aria-valuenow': String(progress.done), 'aria-label': progress.text },
              h('span', { style: `width: ${Math.round((progress.done / progress.of) * 100)}%` }),
            ),
          !link.closed && h('small', null, `${t('linkUntil', { date: formatDate(link.expires, locale) })}${days > 0 ? ` · ${t('daysLeft', { n: days })}` : ''}`),
          h(
            'div',
            { class: 'rf-req-card-actions' },
            !link.closed &&
              button(t('copyLink'), () => void attempt(async () => navigator.clipboard.writeText(address(await client.linkToken(of.id, link.id))), t('linkCopied')), {
                class: 'rf-btn rf-small',
                'aria-label': `${t('copyLink')} · ${name}`,
              }),
            link.closed
              ? button(t('reopen'), () => void attempt(() => client.updateLink(of.id, link.id, { closed: false })), { class: 'rf-btn rf-small', 'aria-label': `${t('reopen')} · ${name}` })
              : button(t('closeRequest'), () => void attempt(() => client.updateLink(of.id, link.id, { closed: true })), {
                  class: 'rf-btn rf-small rf-danger-link',
                  'aria-label': `${t('closeRequest')} · ${name}`,
                }),
          ),
        );
      }),
      button(`+ ${t('newRequest')}`, () => requestFiles(of), { class: 'rf-btn rf-req-new', 'aria-haspopup': 'dialog' }),
    );
  }

  /** The requests of a folder, each with what came through it, to copy, change, close or open again. */
  function requestsList(of: FolderEntry, requests: Link[]) {
    if (!requests.length) return null;
    const address = options.linkAddress ?? defaultAddress;
    return h(
      'section',
      { class: 'rf-ask-requests', 'aria-label': t('requestsMade') },
      h('h3', { class: 'rf-sub' }, t('requestsMade')),
      h(
        'ul',
        { class: 'rf-shares' },
        requests.map((link) => {
          const progress = progressOf(link);
          const name = link.request?.title || (link.uploads === 'only' ? t('linkRequest') : t('linkTakesFiles'));
          const missing = missingOf(link);
          return h(
            'li',
            { key: link.id, class: link.closed ? 'rf-closed' : undefined },
            h(
              'div',
              { class: 'rf-grow' },
              h('strong', null, name),
              h(
                'small',
                null,
                [
                  progress.text,
                  missing.length && !link.closed ? t('missing', { what: missing.map((one) => one.label).join(', ') }) : null,
                  link.closed ? t('requestClosed') : t('linkUntil', { date: formatDate(link.expires, locale) }),
                  link.reminded && !link.closed ? t('remindedOn', { date: formatDate(link.reminded, locale) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
              progress.of > 0 &&
                h(
                  'span',
                  { class: 'rf-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progress.of), 'aria-valuenow': String(progress.done), 'aria-label': progress.text },
                  h('span', { style: `width: ${Math.round((progress.done / progress.of) * 100)}%` }),
                ),
            ),
            !link.closed &&
              button(t('copyLink'), () => void attempt(async () => navigator.clipboard.writeText(address(await client.linkToken(of.id, link.id))), t('linkCopied')), {
                class: 'rf-link',
                'aria-label': `${t('copyLink')} · ${name}`,
              }),
            settings?.can?.remind &&
              link.request?.email &&
              !link.closed &&
              button(t('remindNow'), () => void attempt(() => client.remind(of.id, link.id), t('remindSent', { who: link.request!.email! })), {
                class: 'rf-link',
                'aria-label': `${t('remindNow')} · ${name}`,
              }),
            button(t('changeOptions'), () => ((dialog = editRequest(of, link)), render()), { class: 'rf-link', 'aria-label': `${t('changeOptions')} · ${name}` }),
            link.closed
              ? button(t('reopen'), () => void attempt(() => client.updateLink(of.id, link.id, { closed: false })), { class: 'rf-link', 'aria-label': `${t('reopen')} · ${name}` })
              : button(t('closeRequest'), () => void attempt(() => client.updateLink(of.id, link.id, { closed: true })), {
                  class: 'rf-link rf-danger-link',
                  'aria-label': `${t('closeRequest')} · ${name}`,
                }),
          );
        }),
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
  function shareDialog(of: Entry, who: string, role: Role, made: { days?: number; password?: string; once?: boolean; lasts?: number; viewOnly?: boolean; watermark?: boolean } = {}) {
    const found = detail(of.id);
    const entry = found.current && found.value ? found.value.entry : of;
    const label = t('shareTitle', { name: of.name });
    const address = options.linkAddress ?? defaultAddress;
    const copy = async (token: string) => navigator.clipboard.writeText(address(token));
    const setShare = (change: Partial<{ who: string; role: Role; days: number; password: string; once: boolean; lasts: number; viewOnly: boolean; watermark: boolean }>) => {
      if (dialog?.kind === 'share') Object.assign(dialog, change);
      render();
    };
    // Emptied once shared, unless the next one was typed meanwhile.
    const add = (user: string) =>
      attempt(
        () => client.share(of.id, user, role, made.lasts || null).then(() => dialog?.kind === 'share' && dialog.who.trim() === user && setShare({ who: '' })),
        t('shared', { who: whoName(user) }),
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
                const person = whoName(s.with);
                const ended = !shareHolds(s);
                return h(
                  'li',
                  { key: s.with },
                  h(
                    'span',
                    { class: 'rf-grow' },
                    person,
                    s.until && h('small', { class: `rf-share-until${ended ? ' rf-ended' : ''}` }, ended ? t('shareEnded') : t('linkUntil', { date: formatDate(s.until, locale) })),
                  ),
                  roles(s.role, (next) => void attempt(() => client.share(of.id, s.with, next)), `${t('role')} · ${person}`),
                  button(t('remove'), () => void attempt(() => client.unshare(of.id, s.with)), { class: 'rf-link', 'aria-label': `${t('remove')} · ${person}` }),
                );
              }),
            )
          : h('p', { class: 'rf-hint' }, t('onlyOwner')),
        h(
          'div',
          { class: 'rf-share-add' },
          h('input', {
            type: 'text',
            'aria-label': t('addPerson'),
            'aria-describedby': `${prefix}-who-hint`,
            placeholder: t('addPerson'),
            value: who,
            onInput: (event: Event) => setShare({ who: (event.target as HTMLInputElement).value }),
          }),
          roles(role, (next) => setShare({ role: next }), t('role')),
          h(
            'select',
            { class: 'rf-select', 'aria-label': t('shareLasts'), value: String(made.lasts ?? 0), onChange: (event: Event) => setShare({ lasts: Number((event.target as HTMLSelectElement).value) }) },
            [0, 1, 7, 30, 90].map((n) => h('option', { key: String(n), value: String(n) }, n === 0 ? t('forGood') : n === 1 ? t('linkDay') : t('linkDays', { n }))),
          ),
          h('button', { type: 'submit', class: 'rf-btn rf-primary', disabled: !who.trim() }, t('share')),
        ),
        h('p', { class: 'rf-hint', id: `${prefix}-who-hint` }, t('addPersonHint')),
        !entry.shares?.some((s) => s.with === EVERYONE) && button(`+ ${t('everyone')} · ${roleName(role)}`, () => void add(EVERYONE), { class: 'rf-link' }),
        h('h3', { class: 'rf-sub' }, t('links')),
        entry.links?.length
          ? h(
              'ul',
              { class: 'rf-shares' },
              entry.links.map((link) => {
                const until = t('linkUntil', { date: formatDate(link.expires, locale) });
                const spent = link.uses !== undefined && (link.used ?? 0) >= link.uses;
                return h(
                  'li',
                  { key: link.id },
                  icon('link', 16),
                  h(
                    'span',
                    { class: 'rf-grow' },
                    until,
                    link.locked && h('span', { class: 'rf-tag' }, t('linkLocked')),
                    link.uses !== undefined && h('span', { class: 'rf-tag' }, spent ? t('linkSpent') : t('linkOnce')),
                    link.uploads && h('span', { class: 'rf-tag' }, link.uploads === 'only' ? t('linkRequest') : t('linkTakesFiles')),
                    link.viewOnly && h('span', { class: 'rf-tag' }, t('linkViewOnly')),
                    link.watermark && h('span', { class: 'rf-tag' }, t('linkWatermark')),
                    // Who opened it, as they said, the last first.
                    link.views?.length &&
                      h(
                        'small',
                        { class: 'rf-link-views' },
                        t('openedBy', {
                          who: [...link.views]
                            .reverse()
                            .slice(0, 5)
                            .map((view) => `${view.name} (${formatDate(view.at, locale)})`)
                            .join(', '),
                        }),
                      ),
                  ),
                  button(t('copyLink'), () => void attempt(async () => copy(await client.linkToken(of.id, link.id)), t('linkCopied')), {
                    class: 'rf-link',
                    'aria-label': `${t('copyLink')} · ${until}`,
                  }),
                  button(t('remove'), () => void attempt(() => client.removeLink(of.id, link.id)), { class: 'rf-link', 'aria-label': `${t('remove')} · ${until}` }),
                );
              }),
            )
          : h('p', { class: 'rf-hint' }, t('noLinks')),
        h(
          'div',
          { class: 'rf-link-add' },
          h(
            'select',
            { class: 'rf-select', 'aria-label': t('linkLasts'), value: String(made.days ?? 7), onChange: (event: Event) => setShare({ days: Number((event.target as HTMLSelectElement).value) }) },
            [1, 7, 30].map((n) => h('option', { key: String(n), value: String(n) }, n === 1 ? t('linkDay') : t('linkDays', { n }))),
          ),
          h('input', {
            type: 'password',
            autocomplete: 'new-password',
            'aria-label': t('linkPassword'),
            placeholder: t('linkPasswordOptional'),
            value: made.password ?? '',
            onInput: (event: Event) => setShare({ password: (event.target as HTMLInputElement).value }),
          }),
          h(
            'label',
            { class: 'rf-check' },
            h('input', { type: 'checkbox', checked: Boolean(made.once), onChange: (event: Event) => setShare({ once: (event.target as HTMLInputElement).checked }) }),
            t('linkOnceLabel'),
          ),
          options.viewOnlyLinks !== false && [
            h(
              'label',
              { class: 'rf-check' },
              h('input', { type: 'checkbox', checked: Boolean(made.viewOnly), onChange: (event: Event) => setShare({ viewOnly: (event.target as HTMLInputElement).checked }) }),
              t('linkViewOnlyLabel'),
            ),
            h(
              'label',
              { class: 'rf-check' },
              h('input', { type: 'checkbox', checked: Boolean(made.watermark), onChange: (event: Event) => setShare({ watermark: (event.target as HTMLInputElement).checked }) }),
              t('linkWatermarkLabel'),
            ),
          ],
        ),
        made.password && made.password.length < 4 && h('p', { class: 'rf-hint' }, t('linkPasswordShort')),
        button(
          withIcon('link', t('createLink')),
          () =>
            void attempt(async () => {
              const link = await client.createLink(of.id, made.days ?? 7, { password: made.password || undefined, once: made.once, viewOnly: made.viewOnly, watermark: made.watermark });
              await copy(link.token);
              setShare({ password: '', once: false, viewOnly: false, watermark: false });
            }, t('linkCopied')),
          { class: 'rf-btn', disabled: Boolean(made.password && made.password.length < 4) },
        ),
        // A link that takes files is made apart, in a dialog of its own.
        of.kind === 'folder' && button(withIcon('upload', `${t('requestFiles')}…`), () => requestFiles(of as FolderEntry), { class: 'rf-link', 'aria-haspopup': 'dialog' }),
        actionsRow(button(t('done'), closeDialog, { class: 'rf-btn rf-primary' })),
      ),
    );
  }

  // ---- The viewer: a file shown whole over the drive, and the others of the view before and after it ----

  let viewing: EntryId | null = null;
  let zoomed = false;
  /** Of a document shown, the version it is compared with, from the history; none for the document as it is. */
  let comparing: string | null = null;
  /** The whole text of a file, up to VIEW_LIMIT: null while it comes, an Error when it could not. */
  const fullTexts = new Map<string, string | null | Error>();
  // Workbooks read, by version and how much of them; and the sheet shown of the one in the viewer.
  const books = new Map<string, Sheet[] | null | Error>();
  let sheetShown = 0;
  function sheetsOf(file: FileEntry, url: string | null, limits?: { rows: number; columns: number; sheets: number }) {
    const key = `${file.id}:${file.versions[0].id}:${limits ? 'card' : 'all'}`;
    if (url && !books.has(key)) {
      books.set(key, null);
      fetch(url)
        .then(async (answer) => {
          if (!answer.ok) throw new Error(`${answer.status}`);
          return readXlsx(new Uint8Array(await answer.arrayBuffer()), limits);
        })
        .then(
          (sheets) => (books.set(key, sheets), render()),
          (error: Error) => (books.set(key, error), render()),
        );
    }
    return books.get(key);
  }
  /** The document shown in pages, to take down before the next. */
  let shownDocument: { destroy(): void; pages?: number; layout?(mode: 'all' | 'pages'): void; print?(): void; pdf?(): Promise<Uint8Array> } | undefined;
  const undoDocument = () => {
    shownDocument?.destroy();
    shownDocument = undefined;
  };

  /** Rows shown as a table, the first as its head: of a CSV, or a sheet of a workbook. */
  const tableView = (rows: string[][]) => {
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
  };

  const view = (id: EntryId) => {
    viewing = id;
    sheetShown = 0;
    zoomed = false;
    if (picked.size <= 1) select(id);
    afterRender.push(() => element.querySelector<HTMLElement>('.rf-view')?.focus());
    render();
  };
  const closeView = () => {
    undoDocument();
    comparing = null;
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
            !zoomed && blurred(file),
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
    if (ext === 'xlsx') {
      if (file.versions[0].size > VIEW_LIMIT * 20) return none(t('tooLargeToShow'));
      const sheets = sheetsOf(file, urlOf(file));
      if (sheets === undefined || sheets === null) return h('div', { class: 'rf-view-wait' }, t('loading'));
      if (sheets instanceof Error || !sheets.length) return none(t('couldNotRead'));
      const at = Math.min(sheetShown, sheets.length - 1);
      return h(
        'div',
        { class: 'rf-view-book' },
        sheets.length > 1 &&
          h(
            'div',
            { class: 'rf-sheet-tabs', role: 'group', 'aria-label': t('sheets') },
            sheets.map((sheet, i) => button(sheet.name, () => ((sheetShown = i), render()), { key: `${i}`, class: 'rf-btn rf-small', 'aria-pressed': i === at })),
          ),
        tableView(sheets[at].rows),
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
      if (ext === 'csv' || ext === 'tsv') return tableView(rowsOf(text, ext === 'tsv' ? '\t' : ','));
      let shown = text;
      if (ext === 'json') {
        try {
          shown = JSON.stringify(JSON.parse(text), null, 2);
        } catch {}
      }
      return h('div', { class: 'rf-view-code' }, h('pre', null, shown), cut);
    }
    // Two versions of a document, what changed from the one asked for to the one now.
    const against = comparing && file.versions.find((version) => version.id === comparing);
    if (kind === 'docx' && against && options.compareDocument) {
      const compare = options.compareDocument;
      return h('div', {
        key: `compare:${file.id}:${against.id}:${file.versions[0].id}`,
        class: 'rf-view-pages',
        'data-own': true,
        mount: (node: HTMLElement) => {
          undoDocument();
          const bytesOf = async (version?: string) => new Uint8Array(await (await fetch(await client.url(file.id, { version, inline: true }))).arrayBuffer());
          Promise.all([bytesOf(against.id), bytesOf()])
            .then(([before, after]) =>
              compare(node, before, after, {
                language: locale,
                before: t('version', { n: versionNumber(file, against.id) }),
                after: t('version', { n: versionNumber(file, file.versions[0].id) }),
              }),
            )
            .then(
              (shown) => {
                const handle = typeof shown === 'function' ? { destroy: shown } : shown;
                if (viewing !== file.id) return handle?.destroy();
                shownDocument = handle;
                render();
              },
              () => node.replaceChildren(h('p', { class: 'rf-view-cut' }, t('couldNotRead'))),
            );
        },
      });
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
              .then((bytes) => show(node, new Uint8Array(bytes), { language: locale }))
              .then(
                (shown) => {
                  const handle = typeof shown === 'function' ? { destroy: shown } : shown;
                  if (viewing !== file.id) return handle?.destroy();
                  shownDocument = handle;
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
        options.onOpenDocument &&
          kind === 'docx' &&
          button(
            withIcon('doc', t('openInRebodocs')),
            () =>
              void attempt(async () => {
                const url = await client.url(file.id, { inline: true });
                // The viewer is modal: closed, so what the application opens over the drive takes the keys.
                closeView();
                options.onOpenDocument?.(file, url);
              }),
            { class: 'rf-btn rf-docs rf-small' },
          ),
        button(icon('download', 18), () => void attempt(() => downloadEach([file])), { class: 'rf-btn rf-icon', 'aria-label': t('download'), title: t('download') }),
        // As a PDF, made in the page from the pages shown.
        kind === 'docx' &&
          shownDocument?.pdf &&
          button(
            [icon('download', 18), h('span', null, 'PDF')],
            () =>
              void attempt(async () => {
                const pdf = await shownDocument?.pdf?.();
                if (pdf) saveBlob(new Blob([pdf as BlobPart], { type: 'application/pdf' }), `${file.name.replace(/\.docx$/i, '')}.pdf`);
              }),
            { class: 'rf-btn rf-icon rf-pdf', 'aria-label': t('downloadPdf'), title: t('downloadPdf') },
          ),
        // A document shown in its pages prints as it is shown; anything else opens in a tab of its own.
        kind === 'docx' && shownDocument?.print
          ? button(icon('printer', 18), () => shownDocument?.print?.(), { class: 'rf-btn rf-icon', 'aria-label': t('print'), title: t('print') })
          : button(icon('external', 18), () => void openInTab(file), { class: 'rf-btn rf-icon', 'aria-label': t('openInTab'), title: t('openInTab') }),
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

  type SettingsPart = 'language' | 'appearance' | 'pictures' | 'storage' | 'people';
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
    // Back to the button, once what was inert behind the settings is not: Safari takes the focus only a frame after.
    afterRender.push(() => {
      gear?.focus();
      if (document.activeElement !== gear) requestAnimationFrame(() => gear?.focus());
    });
    render();
  };
  /** A change saved at once, as it is made: what the server says of it is said in the screen. */
  const saveSetting = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await loadSettings();
      settingsNote = { text: t('settingsSaved'), error: false };
      // Asked again, as what a setting changes, the space one may keep, is shown elsewhere.
      changed();
    } catch (error) {
      settingsNote = { text: said(error), error: true };
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
    const languages: ['en' | 'es' | 'zh', string][] = [
      ['en', 'English'],
      ['es', 'Español'],
      ['zh', '中文'],
    ];
    const themes: ['light' | 'dark' | 'auto', string][] = [
      ['light', t('themeLight')],
      ['dark', t('themeDark')],
      ['auto', t('themeAuto')],
    ];
    const parts: [SettingsPart, IconName, string][] = [
      ['language', 'globe', t('language')],
      ['appearance', 'contrast', t('appearance')],
      ...(canConfigure
        ? ([
            ['pictures', 'image', t('pictures')],
            ['storage', 'drive', t('storageSettings')],
            ['people', 'users', t('peopleSettings')],
          ] as [SettingsPart, IconName, string][])
        : []),
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
          // What is one's own, taken away whole: the files, and what one said and did.
          field(
            t('exportMine'),
            t('exportHint'),
            button(withIcon('download', t('exportMine')), () => void attempt(exportMine), { class: 'rf-btn' }),
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
          // The name over the pages of the drive's requests for files, beside its colour.
          field(
            t('companyName'),
            t('companyHint'),
            h('input', {
              type: 'text',
              class: 'rf-set-text',
              'aria-label': t('companyName'),
              value: drive.company ?? '',
              maxlength: 80,
              onChange: (event: Event) => saveDrive({ company: (event.target as HTMLInputElement).value.trim() || null }),
            }),
          ),
          // The requests kept to be made again, as the dialog of a request saves them.
          canConfigure &&
            options.requestTemplates !== false &&
            field(
              t('requestTemplates'),
              t('requestTemplatesHint'),
              (drive.requestTemplates ?? []).length
                ? h(
                    'ul',
                    { class: 'rf-set-templates' },
                    (drive.requestTemplates ?? []).map((one) =>
                      h(
                        'li',
                        { key: one.id },
                        h('span', { class: 'rf-grow' }, h('strong', null, one.name), h('small', null, (one.request.items ?? []).map((item) => item.label).join(', ') || t('docsOfTemplate', { n: 0 }))),
                        button(icon('trash', 14), () => saveDrive({ requestTemplates: (drive.requestTemplates ?? []).filter((other) => other.id !== one.id) }), {
                          class: 'rf-btn rf-icon',
                          'aria-label': `${t('remove')} · ${one.name}`,
                        }),
                      ),
                    ),
                  )
                : h('p', { class: 'rf-set-hint' }, t('noTemplates')),
            ),
        ),
      ];
    } else if (part === 'storage') {
      intro = t('storageIntro');
      const GB = 1024 ** 3;
      const number = (label: string, hint: string, value: number | null, unit: string, save: (value: number | null) => void, step: string) =>
        field(
          label,
          hint,
          h(
            'span',
            { class: 'rf-set-px' },
            h('input', {
              type: 'number',
              min: step,
              step,
              'aria-label': label,
              placeholder: t('noLimit'),
              value: value === null ? '' : String(value),
              onChange: (event: Event) => {
                const typed = (event.target as HTMLInputElement).value.trim();
                save(typed === '' ? null : Number(typed));
              },
            }),
            unit,
          ),
        );
      body = [
        number(
          t('quotaLabel'),
          t('quotaHint'),
          drive.quota === null ? null : Math.round((drive.quota / GB) * 10) / 10,
          'GB',
          (gb) => saveDrive({ quota: gb === null ? null : Math.round(gb * GB) }),
          '0.1',
        ),
        number(t('trashDaysLabel'), t('trashDaysHint'), drive.trashDays, t('days'), (days) => saveDrive({ trashDays: days }), '1'),
        number(t('retentionLabel'), t('retentionHint'), drive.retentionDays ?? null, t('days'), (days) => saveDrive({ retentionDays: days }), '1'),
      ];
    } else if (part === 'people') {
      // What each keeps, and what was done anywhere: asked each time the part is shown, for who looks after the drive.
      intro = t('peopleIntro');
      const kept = everyoneUsage('');
      const done = everyoneActivity('');
      const failed = kept.error ?? done.error;
      body = failed
        ? h('p', { class: 'rf-set-hint rf-set-warn', role: 'alert' }, said(failed))
        : [
            h(
              'section',
              { class: 'rf-set-group', 'aria-labelledby': `${prefix}-people-usage` },
              h('h3', { id: `${prefix}-people-usage` }, t('spaceByPerson')),
              kept.value
                ? h(
                    'table',
                    { class: 'rf-people' },
                    h(
                      'thead',
                      null,
                      h('tr', null, h('th', { scope: 'col' }, t('person')), h('th', { scope: 'col' }, t('filesCount')), h('th', { scope: 'col' }, t('folders')), h('th', { scope: 'col' }, t('space'))),
                    ),
                    h(
                      'tbody',
                      null,
                      kept.value.people.map((one) =>
                        h(
                          'tr',
                          { key: one.owner },
                          h('th', { scope: 'row' }, one.owner),
                          h('td', null, String(one.files)),
                          h('td', null, String(one.folders)),
                          h('td', null, formatSize(one.bytes, locale), kept.value!.quota ? h('small', null, ` / ${formatSize(kept.value!.quota, locale)}`) : null),
                        ),
                      ),
                    ),
                    h(
                      'tfoot',
                      null,
                      h(
                        'tr',
                        null,
                        h('th', { scope: 'row' }, t('wholeDrive')),
                        h('td', null, String(kept.value.total.files)),
                        h('td', null, String(kept.value.total.folders)),
                        h('td', null, formatSize(kept.value.total.bytes, locale)),
                      ),
                    ),
                  )
                : h('p', { class: 'rf-set-hint' }, t('loading')),
            ),
            h(
              'section',
              { class: 'rf-set-group', 'aria-labelledby': `${prefix}-people-activity` },
              h('h3', { id: `${prefix}-people-activity` }, t('activityEverywhere')),
              done.value
                ? done.value.length
                  ? h(
                      'ol',
                      { class: 'rf-activity', 'aria-labelledby': `${prefix}-people-activity` },
                      done.value.map((a, i) => h('li', { key: `${a.at}${a.action}${a.entry}${i}` }, h('span', null, activityText(a)), h('small', null, formatDate(a.at, locale)))),
                    )
                  : h('p', { class: 'rf-set-hint' }, t('noActivity'))
                : h('p', { class: 'rf-set-hint' }, t('loading')),
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

  /** Every file going up, and those gone: how far each is, how fast, how long it has left; and all of them together. */
  function uploadsPanel() {
    const all = uploader.items;
    const sum = uploader.summary();
    const going = sum.sending + sum.waiting + sum.asking;
    const pct = (sent: number, size: number) => Math.round((sent / Math.max(1, size)) * 100);
    const title = going
      ? `${t('upGoing', { done: sum.done, n: all.length })}${sum.remaining !== undefined ? ` · ${t('upLeft', { time: formatDuration(sum.remaining, locale) })}` : ''}`
      : sum.failed
        ? t('upFailedN', { n: sum.failed })
        : t('upDone', { n: sum.done });
    const row = (item: UploadItem) => {
      const stateText =
        item.state === 'asking' && item.conflict
          ? item.conflict.kind === 'same'
            ? t('upSame', { name: item.conflict.entry.name })
            : t('upNamed', { name: item.conflict.entry.name })
          : item.state === 'checking'
            ? t('upChecking')
            : item.state === 'skipped'
              ? t('upSkipped')
              : item.state === 'waiting'
                ? t('upWaiting')
                : item.state === 'sending'
                  ? [
                      t('upOf', { sent: formatSize(item.sent, locale), size: formatSize(item.size, locale) }),
                      item.speed !== undefined && ` · ${t('upSpeed', { speed: formatSize(item.speed, locale) })}`,
                      item.remaining !== undefined && ` · ${t('upLeft', { time: formatDuration(item.remaining, locale) })}`,
                    ]
                  : item.state === 'done'
                    ? t('upUploaded')
                    : item.state === 'stopped'
                      ? t('upStopped')
                      : item.sent > 0
                        ? t('uploadCut', { name: item.name, pct: pct(item.sent, item.size) })
                        : `${item.name}: ${item.refused ? said(new RequestError(0, item.refused, item.error ?? '')) : item.error}`;
      return h(
        'li',
        { key: `up${item.id}`, class: `rf-up rf-up-${item.state}` },
        h('span', { class: `rf-tile rf-k-${kindOf({ kind: 'file', name: item.name, type: '' } as unknown as Entry)}`, 'aria-hidden': 'true' }, badgeOf({ name: item.name } as Entry)),
        h(
          'div',
          { class: 'rf-up-text' },
          h('span', { class: 'rf-up-name', title: item.name }, item.name),
          h('span', { class: 'rf-up-state', ...(item.state === 'failed' ? { role: 'alert' } : {}) }, stateText),
          (item.state === 'sending' || item.state === 'waiting') &&
            h(
              'span',
              { class: 'rf-bar', role: 'progressbar', 'aria-label': item.name, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct(item.sent, item.size)) },
              h('span', { style: `width: ${pct(item.sent, item.size)}%` }),
            ),
        ),
        item.state === 'asking' &&
          item.conflict &&
          h(
            'div',
            { class: 'rf-up-ask', role: 'group', 'aria-label': `${t('upWhat')} ${item.name}` },
            item.conflict.kind === 'name' && button(t('upReplace'), () => uploader.decide(item.id, 'replace', forAll), { class: 'rf-btn rf-small' }),
            button(item.conflict.kind === 'name' ? t('upKeepBoth') : t('upAnyway'), () => uploader.decide(item.id, 'keep', forAll), { class: 'rf-btn rf-small' }),
            button(t('upSkip'), () => uploader.decide(item.id, 'skip', forAll), { class: 'rf-btn rf-small rf-text' }),
          ),
        item.state === 'done' && h('span', { class: 'rf-up-ok', 'aria-hidden': 'true' }, icon('check', 16)),
        (item.state === 'failed' || item.state === 'stopped') && button(t('tryAgain'), () => uploader.retry(item.id), { class: 'rf-retry' }),
        (item.state === 'sending' || item.state === 'waiting' || item.state === 'checking') &&
          button(icon('close', 14), () => uploader.stop(item.id), { class: 'rf-btn rf-icon rf-up-stop', 'aria-label': `${t('stopUpload')} ${item.name}`, title: t('stopUpload') }),
      );
    };
    return h(
      'section',
      { key: 'uploads', class: 'rf-ups', 'aria-label': t('uploadsLabel') },
      h(
        'div',
        { class: 'rf-ups-head' },
        h('strong', { class: 'rf-ups-title' }, title),
        going > 1 && button(t('stopAll'), () => uploader.stopAll(), { class: 'rf-btn rf-small rf-text' }),
        button(icon('chevron', 16), () => ((uploadsOpen = !uploadsOpen), render()), {
          class: `rf-btn rf-icon rf-ups-fold${uploadsOpen ? ' rf-open' : ''}`,
          'aria-expanded': uploadsOpen,
          'aria-label': uploadsOpen ? t('hideUploads') : t('showUploads'),
        }),
        !going && button(icon('close', 16), () => uploader.clear(), { class: 'rf-btn rf-icon', 'aria-label': t('closeUploads'), title: t('closeUploads') }),
      ),
      going > 0 &&
        h(
          'span',
          { class: 'rf-bar rf-ups-bar', role: 'progressbar', 'aria-label': title, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct(sum.sent, sum.size)) },
          h('span', { style: `width: ${pct(sum.sent, sum.size)}%` }),
        ),
      uploadsOpen &&
        sum.asking > 1 &&
        h(
          'label',
          { class: 'rf-check rf-ups-all' },
          h('input', { type: 'checkbox', checked: forAll, onChange: (event: Event) => ((forAll = (event.target as HTMLInputElement).checked), render()) }),
          t('upForAll'),
        ),
      uploadsOpen && h('ul', { class: 'rf-ups-list' }, all.map(row)),
    );
  }

  function dialogs() {
    if (!dialog) return null;
    switch (dialog.kind) {
      case 'folder': {
        const into = folder;
        return nameDialog(t('newFolder'), t('folderName'), '', t('create'), dialog.name, (name) => void attempt(() => client.createFolder(name, into).then((made) => (selected = made.id))));
      }
      case 'fields':
        return fieldsDialog(dialog.entry, dialog.text);
      case 'request':
        return requestDialog(dialog);
      case 'review': {
        const file = dialog.entry;
        return modal(
          t('returnTitle', { name: file.name }),
          h(
            'form',
            {
              onSubmit: (event: Event) => {
                event.preventDefault();
                const reason = dialog?.kind === 'review' ? dialog.reason.trim() : '';
                closeDialog();
                void attempt(() => client.review(file.id, 'rejected', reason), t('returnedNow', { name: file.name }));
              },
            },
            h('h2', null, t('returnTitle', { name: file.name })),
            h('p', { class: 'rf-hint', style: 'margin: 0' }, file.fields?.from ? t('returnHint', { who: file.fields.from }) : t('returnHintAnyone')),
            h('textarea', {
              class: 'rf-fields-text',
              rows: 3,
              'aria-label': t('returnReason'),
              placeholder: t('returnPlaceholder'),
              onInput: (event: Event) => {
                if (dialog?.kind === 'review') dialog.reason = (event.target as HTMLTextAreaElement).value;
              },
              mount: (field: HTMLElement) => field.focus(),
            }),
            actionsRow(cancel(), h('button', { type: 'submit', class: 'rf-btn rf-primary', style: 'background: var(--rf-danger); border-color: var(--rf-danger)' }, t('return'))),
          ),
        );
      }
      case 'document': {
        const into = folder;
        return nameDialog(t('newDocument'), t('documentName'), '', t('create'), dialog.name, (name) => void attempt(() => makeDocument(name, into)));
      }
      case 'rename': {
        const { entry } = dialog;
        return nameDialog(t('rename'), t('newName'), entry.name, t('save'), dialog.name, async (name) => {
          try {
            await client.rename(entry.id, name);
            say(t('renamedTo', { name }), () => client.rename(entry.id, entry.name));
          } catch (error) {
            say(said(error));
          }
          changed();
        });
      }
      case 'move':
        return moveDialog(dialog.entries, dialog.at);
      case 'share':
        return shareDialog(dialog.entry, dialog.who, dialog.role, dialog);
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
    const entries = arranged(value?.entries ?? []);
    const path = value?.path ?? [];
    shownEntries = entries;
    const pickedEntries = entries.filter((entry) => picked.has(entry.id));
    const selectedEntry = pickedEntries.length > 1 ? null : (entries.find((entry) => entry.id === selected) ?? null);
    // The folder one is in, of a folder of the drive opened: its own options beside its name.
    const here = section === 'files' && !query && folder ? (path.at(-1)?.id === folder ? (path.at(-1) as FolderEntry) : null) : null;
    const heading = query
      ? t('resultsFor', { q: query })
      : section === 'recent'
        ? t('recent')
        : section === 'starred'
          ? t('starred')
          : section === 'received'
            ? t('received')
            : section === 'shared'
              ? t('sharedWithMe')
              : section === 'trash'
                ? t('trash')
                : null;
    const count = entries.length === 1 ? t('item') : t('items', { n: entries.length });
    const title = options.title ?? 'Files';
    // Each with a shorter name, for the bar at the foot of a phone.
    const nav = (name: IconName, text: string, current: boolean, onClick: () => void, { badge, short, ...extra }: Record<string, unknown> = {}) =>
      h(
        'button',
        { type: 'button', class: 'rf-nav', 'aria-current': current, onClick, ...extra },
        icon(name),
        h('span', { class: 'rf-nav-label' }, text),
        h('span', { class: 'rf-nav-short' }, (short as string | undefined) ?? text),
        badge ? h('span', { class: 'rf-badge', 'aria-hidden': 'true' }, Number(badge) > 99 ? '99+' : String(badge)) : null,
      );
    if (selected !== scrolledTo) {
      scrolledTo = selected;
      if (selected) afterRender.push(() => element.querySelector(`[data-id="${quoted(selected!)}"]`)?.scrollIntoView({ block: 'nearest' }));
    }

    return h(
      'div',
      { class: `rf-drive${options.layout === 'compact' ? ' rf-compact' : ''}${options.className ? ` ${options.className}` : ''}`, 'data-theme': themeNow(), 'data-rf': prefix },
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
        notices &&
          h(
            'div',
            { class: 'rf-bell-box' },
            button([icon('bell'), notices.unseen > 0 && h('span', { class: 'rf-bell-n', 'aria-hidden': 'true' }, String(notices.unseen))], openNotices, {
              class: 'rf-gear rf-bell',
              'aria-label': notices.unseen ? `${t('notifications')} · ${t('newNotices', { n: notices.unseen })}` : t('notifications'),
              title: t('notifications'),
              'aria-expanded': noticesOpen,
            }),
            noticesOpen &&
              h(
                'div',
                {
                  class: 'rf-notices',
                  role: 'region',
                  'aria-label': t('notifications'),
                  onKeydown: (event: KeyboardEvent) => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    noticesOpen = false;
                    render();
                    element.querySelector<HTMLButtonElement>('.rf-bell')?.focus();
                  },
                },
                h('strong', null, t('notifications')),
                notices.notifications.length
                  ? h(
                      'ul',
                      null,
                      notices.notifications.map((notice) =>
                        h(
                          'li',
                          { key: notice.id },
                          button(
                            [
                              h(
                                'span',
                                null,
                                notice.kind === 'expiring' && notice.expires
                                  ? t(Date.parse(notice.expires) < Date.now() ? 'noticeExpired' : 'noticeExpiring', {
                                      name: notice.name,
                                      date: formatDate(`${notice.expires}T12:00:00Z`, locale),
                                    })
                                  : t(notice.kind === 'shared' ? 'noticeShared' : notice.kind === 'received' ? 'noticeReceived' : 'noticeMentioned', {
                                      by: notice.by.startsWith('link:') ? t('throughLink') : notice.by,
                                      name: notice.name,
                                    }),
                              ),
                              notice.text && h('small', { class: 'rf-notice-text' }, notice.text),
                              h('small', null, formatDate(notice.at, locale)),
                            ],
                            () => void goToNotice(notice),
                            { class: 'rf-notice', mount: (node: HTMLElement) => node === element.querySelector('.rf-notice') && node.focus() },
                          ),
                        ),
                      ),
                    )
                  : h('p', { class: 'rf-hint' }, t('noNotices')),
              ),
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
          h('input', {
            class: 'rf-folder-file',
            type: 'file',
            webkitdirectory: true,
            hidden: true,
            onChange: (event: Event) => {
              const input = event.target as HTMLInputElement;
              if (input.files?.length) void uploadTree(readChosen(input.files), folder);
              input.value = '';
            },
          }),
          nav('drive', t('myFiles'), section === 'files' && from === 'files' && !query, () => go('files'), { ...dropTarget(null), short: t('shortFiles') }),
          nav('users', t('sharedWithMe'), (section === 'shared' || (section === 'files' && from === 'shared')) && !query, () => go('shared'), {
            'aria-label': freshShared ? `${t('sharedWithMe')} · ${t('newShared', { n: freshShared })}` : undefined,
            badge: freshShared,
            short: t('shortShared'),
          }),
          nav('clock', t('recent'), section === 'recent' && !query, () => go('recent')),
          nav('star', t('starred'), section === 'starred' && !query, () => go('starred'), { short: t('shortStarred') }),
          // What came through one's requests for files, with how many are still to be looked at.
          (receivedNow('').value?.length ?? 0) > 0 &&
            nav('inbox', t('received'), section === 'received' && !query, () => go('received'), {
              badge: toReview(receivedNow('').value ?? []),
              'aria-label': toReview(receivedNow('').value ?? []) ? `${t('received')} · ${t('toReviewN', { n: toReview(receivedNow('').value ?? []) })}` : undefined,
            }),
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
          (() => {
            const space = usage('').value;
            if (!space) return null;
            const pct = space.quota ? Math.min(100, Math.round((space.used / space.quota) * 100)) : 0;
            return h(
              'div',
              { class: 'rf-usage' },
              space.quota
                ? [
                    h('span', null, t('usedOf', { used: formatSize(space.used, locale), quota: formatSize(space.quota, locale) })),
                    h(
                      'span',
                      { class: `rf-bar${pct >= 90 ? ' rf-full' : ''}`, role: 'progressbar', 'aria-label': t('space'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) },
                      h('span', { style: `width: ${pct}%` }),
                    ),
                  ]
                : h('span', null, t('used', { used: formatSize(space.used, locale) })),
            );
          })(),
          storage && h('div', { class: 'rf-storage' }, t('location'), h('code', null, storage)),
        ),
        h(
          // The page's own main, unless the drive is inside one already: then a region of it, named.
          inMain ? 'section' : 'main',
          {
            class: 'rf-main',
            'aria-label': inMain ? (options.title ?? t('myFiles')) : undefined,
            onDragover: (event: DragEvent) => {
              if (section !== 'files' || query || !event.dataTransfer?.types.includes('Files')) return;
              event.preventDefault();
              if (!dropping) (dropping = true), render();
            },
            onDragleave: (event: DragEvent) => !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node) && ((dropping = false), render()),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              dropping = false;
              if (section === 'files' && !query && event.dataTransfer?.files.length) dropped(event.dataTransfer, folder);
              render();
            },
          },
          // The folder one is in: its name, what it is, what may be done with it, and the requests for files it has open.
          here && pickedEntries.length <= 1 && folderHead(here, entries),
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
                  'select',
                  {
                    class: 'rf-select rf-kind',
                    'aria-label': t('kindFilter'),
                    value: kindFilter,
                    onChange: (event: Event) => {
                      kindFilter = (event.target as HTMLSelectElement).value as KindFilter;
                      render();
                    },
                  },
                  (['all', 'folder', 'docx', 'pdf', 'sheet', 'image', 'video', 'audio', 'text', 'other'] as KindFilter[]).map((kind) => h('option', { value: kind }, t(`kind_${kind}` as 'kind_all'))),
                ),
                h(
                  'select',
                  {
                    class: 'rf-select',
                    'aria-label': t('sortLabel'),
                    value: `${sortBy}:${sortDir}`,
                    onChange: (event: Event) => {
                      const [by, dir] = (event.target as HTMLSelectElement).value.split(':');
                      setSort(by as SortBy, Number(dir) as 1 | -1);
                    },
                  },
                  (['name', 'modified', 'created', 'size', 'type', 'owner', 'color', 'arrived'] as SortBy[]).flatMap((by) =>
                    ([1, -1] as const).map((dir) => h('option', { value: `${by}:${dir}` }, `${sortName(by)} ${dir === 1 ? '↑' : '↓'}`)),
                  ),
                ),
                button(
                  icon('folder', 16),
                  () => {
                    foldersFirst = !foldersFirst;
                    keepOrder();
                    render();
                  },
                  { class: 'rf-btn rf-icon rf-folders-first', 'aria-pressed': foldersFirst, 'aria-label': t('foldersFirst'), title: t('foldersFirst') },
                ),
                h(
                  'div',
                  { class: 'rf-seg', role: 'group', 'aria-label': `${t('list')} / ${t('grid')}` },
                  button(icon('list'), () => ((layout = 'list'), render()), { 'aria-pressed': layout === 'list', 'aria-label': t('list'), title: t('list') }),
                  button(icon('grid'), () => ((layout = 'grid'), render()), { 'aria-pressed': layout === 'grid', 'aria-label': t('grid'), title: t('grid') }),
                ),
              ),
          layout === 'list' &&
            entries.length > 0 &&
            !(section === 'received' && !query) &&
            h(
              'div',
              { class: 'rf-cols' },
              (
                [
                  ['name', t('name')],
                  ['owner', entries.some((entry) => entry.fields?.via === 'request') ? t('ownerOrFrom') : t('owner')],
                  ['modified', t('modified')],
                  ['size', t('size')],
                ] as [SortBy, string][]
              ).map(([by, label]) => {
                const on = sortBy === by && (sortChosen || (section !== 'recent' && !query));
                return button([label, on && h('span', { class: 'rf-sort-dir', 'aria-hidden': 'true' }, sortDir === 1 ? '↑' : '↓')], () => setSort(by), {
                  key: by,
                  class: `rf-col${on ? ' rf-on' : ''}`,
                  'aria-label': on ? t(sortDir === 1 ? 'sortedUp' : 'sortedDown', { by: label }) : t('sortBy', { by: label }),
                });
              }),
            ),
          section === 'received' && !query && !error && value
            ? receivedView(entries)
            : items(
                entries,
                loading,
                error,
                kindFilter !== 'all' && (value?.entries.length ?? 0) > 0
                  ? t('noneOfKind')
                  : query
                    ? t('noResults')
                    : section === 'trash'
                      ? t('trashIsEmpty')
                      : section === 'recent'
                        ? t('noRecent')
                        : section === 'starred'
                          ? t('noStarred')
                          : section === 'received'
                            ? t('noReceived')
                            : section === 'shared'
                              ? t('noShared')
                              : t('emptyFolder'),
              ),
          dropping && h('div', { class: 'rf-dropzone' }, t('dropHere')),
        ),
        pickedEntries.length > 1 ? pickedDetails(pickedEntries) : details(selectedEntry, here),
      ),
      // Said once a view has loaded: where one is and how much is there. Not the progress of an upload, which would be read out at every step.
      h('span', { class: 'rf-sr', 'aria-live': 'polite' }, loading ? '' : `${heading ?? path.at(-1)?.name ?? t('myFiles')} · ${count}`),
      h(
        'div',
        { class: 'rf-status', inert: Boolean(settingsPart || viewing) },
        h('span', { class: 'rf-grow' }, count, storage && h('span', { class: 'rf-where' }, ` · ${storage}`)),
        zipping
          ? [
              h('span', null, t('zipping', { name: zipping.name, pct: Math.round((zipping.read / Math.max(1, zipping.size)) * 100) })),
              h(
                'span',
                {
                  class: 'rf-bar',
                  role: 'progressbar',
                  'aria-label': zipping.name,
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                  'aria-valuenow': String(Math.round((zipping.read / Math.max(1, zipping.size)) * 100)),
                },
                h('span', { style: `width: ${(zipping.read / Math.max(1, zipping.size)) * 100}%` }),
              ),
              button(t('cancel'), () => zipping?.stop.abort(), { class: 'rf-retry' }),
            ]
          : null,
      ),
      toast &&
        h(
          'div',
          { class: 'rf-toast', role: 'status' },
          h('span', null, toast),
          undoing && button(t('undo'), () => void undo(), { class: 'rf-toast-undo' }),
          offered && button(offered.label, () => (offered?.run(), say(null)), { class: 'rf-toast-undo' }),
        ),
      uploader.items.length > 0 && uploadsPanel(),
      contextMenu && contextMenuView(contextMenu),
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
    if (contextMenu && !element.querySelector('.rf-ctx')?.contains(event.target as Node)) closeContext(false);
    if (noticesOpen && !element.querySelector('.rf-bell-box')?.contains(event.target as Node)) {
      noticesOpen = false;
      render();
    }
    if (menuOpen && !element.querySelector('.rf-menu')?.contains(event.target as Node) && !element.querySelector('.rf-new')?.contains(event.target as Node)) {
      menuOpen = false;
      render();
    }
  };
  document.addEventListener('mousedown', closeMenu);
  // Safari leaves the focus on the page, not on a button clicked: Escape still closes what is open over the drive.
  const onLooseKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || (event.target !== document.body && event.target !== document.documentElement)) return;
    if (viewing) closeView();
    else if (settingsPart) closeSettings();
  };
  document.addEventListener('keydown', onLooseKey);
  // ⌘Z or Ctrl+Z undoes the last change while its toast is up, unless it is a field's own.
  element.addEventListener('keydown', (event) => {
    const field = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable], .rf-view-pages');
    if (!field && undoing && (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void undo();
    }
  });

  client.info().then(
    (info) => ((storage = info.storage), render()),
    () => undefined,
  );
  void loadSettings();
  askShared();
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
      clearTimeout(retryTimer);
      clearInterval(sharedTimer);
      clearTimeout(liveTimer);
      unwatch();
      document.removeEventListener('visibilitychange', onSeen);
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', onLooseKey);
      element.replaceChildren();
    },
  };
}
