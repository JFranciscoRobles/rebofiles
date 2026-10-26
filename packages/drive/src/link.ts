// What someone who was sent a link sees, without signing in: the folder or the
// file it was made for, its folders to go into, and each file to open or save.
// Nothing can be changed from here. Mounted on an element of its own, as the
// page that shows it is most often apart from the drive.
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
  language?: 'en' | 'es';
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
  const link = createLinkClient({ base: options.base ?? '/api/files', token: options.token, password: () => password });
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
                  h(
                    'ul',
                    { class: 'rf-items rf-link-rows', 'aria-label': t('name') },
                    listing && rows.length === 0 && h('li', { class: 'rf-empty' }, t('emptyFolder')),
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
