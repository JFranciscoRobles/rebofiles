// What someone who was sent a link sees, without signing in: the folder or the
// file it was made for, its folders to go into, and each file to open or save.
// Nothing can be changed from here, but for files put in a folder whose link
// lets them in; and a request for files shows only where to send them.
// Mounted on an element of its own, as the page that shows it is most often
// apart from the drive.
//
//   mountSharedLink(document.getElementById('shared')!, { token: new URLSearchParams(location.search).get('link')! });

import type { Entry, EntryId } from '@rebofiles/core';
import { type LinkListing, RequestError, createLinkClient } from './client';
import { first, h, morph } from './dom';
import { TEXTS, type Texts, formatDate, formatSize, translator } from './i18n';
import { icon, logo as mark } from './icons';
import { badgeOf, kindOf } from './kinds';
import { downloadZip } from './download';
import { CSS } from './styles';

export interface SharedLinkOptions {
  /** Where the routes of @rebofiles/server are: `/api/files` unless said. */
  base?: string;
  /** The token of the link, as it came in its address. */
  token: string;
  language?: 'en' | 'es' | 'zh';
  texts?: Texts;
  logo?: Node;
  /** Light (the default), dark, or as the system is (`'auto'`). */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function mountSharedLink(element: HTMLElement, options: SharedLinkOptions): { destroy(): void } {
  const t = translator(options.texts ?? TEXTS[options.language ?? 'en']);
  const locale = options.language ?? 'en';
  // A link with a password asks for it first; it is kept for this page only, and sent with every request.
  let password: string | undefined;
  let asking: 'ask' | 'wrong' | null = null;
  let typed = '';
  // Who sends files through it, as they say they are called, told to the owner with each.
  let from = '';
  const link = createLinkClient({ base: options.base ?? '/api/files', token: options.token, password: () => password, from: () => from.trim() || undefined });
  /** The files sent from this page, each as it goes. */
  let sending: { id: number; name: string; pct: number; state: 'sending' | 'sent' | 'failed'; error?: string }[] = [];
  let sent = 0;
  const send = async (files: Iterable<File>) => {
    const into = listing?.folder.kind === 'folder' && listing.link?.uploads === 'also' ? listing.folder.id : undefined;
    await Promise.all(
      [...files].map(async (file) => {
        const item = { id: ++sent, name: file.name, pct: 0, state: 'sending' as const };
        sending = [...sending, item];
        render();
        const set = (change: Partial<(typeof sending)[number]>) => ((sending = sending.map((one) => (one.id === item.id ? { ...one, ...change } : one))), render());
        try {
          await link.upload(file, { folder: into, onProgress: ({ sent: done, size }) => set({ pct: Math.round((done / Math.max(1, size)) * 100) }) });
          set({ state: 'sent', pct: 100 });
        } catch (failed) {
          set({ state: 'failed', error: (failed as Error).message });
        }
      }),
    );
    // What it reads besides, shown again with what came.
    if (listing?.link?.uploads === 'also') show(into === listing.root.id ? undefined : into);
  };
  /** Where files are put, of a link that takes them: who sends them, the button, and each as it goes. */
  const sendBox = (only: boolean) =>
    h(
      'section',
      {
        class: `rf-send${only ? ' rf-send-only' : ''}`,
        'aria-label': t('sendFiles'),
        onDragover: (event: DragEvent) => event.dataTransfer?.types.includes('Files') && event.preventDefault(),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          if (event.dataTransfer?.files.length) void send(event.dataTransfer.files);
        },
      },
      h('h2', null, only ? t('sendFilesTo', { name: listing?.root.name ?? '' }) : t('addFilesHere')),
      only && h('p', { class: 'rf-hint' }, t('sendFilesHint')),
      h(
        'label',
        { class: 'rf-send-name' },
        h('span', null, t('yourName')),
        h('input', { type: 'text', autocomplete: 'name', value: from, onInput: (event: Event) => (from = (event.target as HTMLInputElement).value) }),
      ),
      h('input', {
        type: 'file',
        multiple: true,
        hidden: true,
        class: 'rf-send-file',
        onChange: (event: Event) => {
          const input = event.target as HTMLInputElement;
          if (input.files?.length) void send(input.files);
          input.value = '';
        },
      }),
      h(
        'button',
        { type: 'button', class: 'rf-btn rf-primary', onClick: () => element.querySelector<HTMLInputElement>('.rf-send-file')?.click() },
        icon('upload', 16),
        h('span', null, t('uploadFiles')),
      ),
      sending.length > 0 &&
        h(
          'ul',
          { class: 'rf-send-list', 'aria-live': 'polite' },
          sending.map((one) =>
            h(
              'li',
              { key: String(one.id) },
              h('span', { class: 'rf-grow' }, one.name),
              h('small', { class: one.state === 'failed' ? 'rf-error' : undefined }, one.state === 'sent' ? t('sentFile') : one.state === 'failed' ? (one.error ?? t('couldNotSend')) : `${one.pct}%`),
            ),
          ),
        ),
    );
  let listing: LinkListing | null = null;
  let error: string | null = null;
  let alive = true;
  let asked = 0;

  const show = (folder?: EntryId) => {
    const n = ++asked;
    link.list(folder).then(
      (found) => n === asked && ((listing = found), (error = null), (asking = null), render()),
      (failed: unknown) => {
        if (n !== asked) return;
        if (failed instanceof RequestError && failed.status === 401) {
          asking = failed.code === 'link-password-wrong' ? 'wrong' : 'ask';
          password = undefined;
        } else error = failed instanceof RequestError && failed.status === 404 ? t('linkGone') : String((failed as Error).message ?? failed);
        render();
      },
    );
  };

  /** The form asking for the password, before anything of the link is shown. */
  const passwordForm = () =>
    h(
      'form',
      {
        class: 'rf-pass',
        onSubmit: (event: Event) => {
          event.preventDefault();
          if (!typed) return;
          password = typed;
          typed = '';
          show();
        },
      },
      h('p', { id: 'rf-pass-hint' }, t('linkAsks')),
      h('input', {
        type: 'password',
        autocomplete: 'current-password',
        'aria-label': t('linkPassword'),
        'aria-describedby': 'rf-pass-hint',
        'aria-invalid': asking === 'wrong' ? 'true' : undefined,
        value: typed,
        autofocus: true,
        onInput: (event: Event) => (typed = (event.target as HTMLInputElement).value),
      }),
      asking === 'wrong' && h('p', { class: 'rf-error', role: 'alert' }, t('linkWrong')),
      h('button', { type: 'submit', class: 'rf-btn rf-primary' }, t('linkOpen')),
    );

  const open = async (file: Entry, save = false) => {
    // A window opened before the address is known, so the browser takes it as the click's.
    const tab = save ? null : window.open('about:blank', '_blank');
    try {
      const url = await link.url(file.id, { inline: !save });
      if (tab) tab.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
      }
    } catch (failed) {
      tab?.close();
      error = (failed as Error).message;
      render();
    }
  };

  // A .zip of the folder shown, or of one in it: made in the page, as in the drive.
  let zipping: { id: EntryId; pct: number } | null = null;
  const zip = async (folder: Entry) => {
    if (zipping) return;
    zipping = { id: folder.id, pct: 0 };
    render();
    try {
      const done = await downloadZip(link, [folder.id], { name: folder.name, onProgress: ({ read, size }) => zipping && ((zipping.pct = Math.round((read / Math.max(1, size)) * 100)), render()) });
      if (done.missed.length) error = t('zipMissed', { name: `${folder.name}.zip`, n: done.missed.length });
    } catch (failed) {
      error = (failed as Error).message;
    } finally {
      zipping = null;
      render();
    }
  };
  const zipButton = (folder: Entry, wide: boolean) => {
    const going = zipping?.id === folder.id;
    const label = going ? t('zipping', { name: `${folder.name}.zip`, pct: zipping!.pct }) : t('downloadZip');
    return h(
      'button',
      { type: 'button', class: wide ? 'rf-btn rf-small' : 'rf-btn rf-text', disabled: Boolean(zipping), 'aria-label': wide ? label : `${label} · ${folder.name}`, onClick: () => void zip(folder) },
      icon('download', 16),
      wide && h('span', null, label),
    );
  };

  function screen() {
    // A link to one file shows that file as the only row.
    const rows = listing ? (listing.root.kind === 'file' ? [listing.root] : listing.entries) : [];
    return h(
      'div',
      { class: `rf-drive rf-shared${options.className ? ` ${options.className}` : ''}`, 'data-theme': options.theme ?? 'light' },
      h('style', null, CSS),
      h('div', { class: 'rf-top' }, h('div', { class: 'rf-title' }, options.logo ?? mark(), h('span', null, listing?.root.name ?? ''))),
      h(
        'div',
        { class: 'rf-body' },
        h(
          'main',
          { class: 'rf-main' },
          asking
            ? passwordForm()
            : error
              ? h('div', { class: 'rf-empty rf-error', role: 'alert' }, error)
              : listing?.link?.uploads === 'only'
                ? sendBox(true)
                : [
                    h(
                      'div',
                      { class: 'rf-head' },
                      h(
                        'div',
                        { class: 'rf-crumbs' },
                        // A link to a file has no folders to go back up: the file is its only row.
                        listing?.root.kind === 'folder' &&
                          listing.path.map((step, i) =>
                            h(
                              'span',
                              { key: step.id, style: 'display: contents' },
                              i > 0 && icon('chevron', 16),
                              h(
                                'button',
                                { type: 'button', class: 'rf-crumb', 'aria-current': step.id === listing?.folder.id ? 'page' : undefined, onClick: () => show(i === 0 ? undefined : step.id) },
                                step.name,
                              ),
                            ),
                          ),
                      ),
                      listing?.folder.kind === 'folder' && zipButton(listing.folder, true),
                    ),
                    listing?.link?.uploads === 'also' && listing.folder.kind === 'folder' && sendBox(false),
                    h(
                      'ul',
                      { class: 'rf-items rf-link-rows', 'aria-label': t('name') },
                      listing && rows.length === 0 && h('li', { class: 'rf-empty' }, t('linkEmpty')),
                      rows.map((entry) =>
                        h(
                          'li',
                          { key: entry.id, class: 'rf-row' },
                          h(
                            'button',
                            { type: 'button', class: 'rf-name', onClick: () => (entry.kind === 'folder' ? show(entry.id) : void open(entry)) },
                            h('span', { class: `rf-tile rf-k-${kindOf(entry)}`, 'aria-hidden': 'true' }, entry.kind === 'folder' ? icon('folder', 16) : badgeOf(entry)),
                            h('span', null, entry.name),
                          ),
                          h('span', null, formatDate(entry.modified, locale)),
                          h('span', null, entry.kind === 'file' ? formatSize(entry.versions[0].size, locale) : '—'),
                          entry.kind === 'file'
                            ? h('button', { type: 'button', class: 'rf-btn rf-text', 'aria-label': `${t('download')} · ${entry.name}`, onClick: () => void open(entry, true) }, icon('download', 16))
                            : zipButton(entry, false),
                        ),
                      ),
                    ),
                  ],
        ),
      ),
    );
  }

  let started = false;
  function render() {
    if (!alive) return;
    const tree = screen();
    if (!started || !element.firstElementChild) {
      started = true;
      first(element, tree);
    } else morph(element.firstElementChild, tree);
  }

  render();
  show();
  return {
    destroy() {
      alive = false;
      element.replaceChildren();
    },
  };
}
