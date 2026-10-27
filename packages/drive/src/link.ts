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
import { picturesToPdf } from './pdf';
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
  /** Each photo taken looked at before it goes, and its sender asked to take it again when it looks blurry: true unless said. */
  checkBlur?: boolean;
}

/** Below it, a photo is taken for blurry: how much its edges vary, on a copy 400 pixels wide. */
const SHARP_ENOUGH = 60;

/** How sharp a photo is: the variance of its Laplacian, in grey, on a copy of it 400 pixels wide. */
async function sharpnessOf(photo: Blob): Promise<number> {
  const bitmap = await createImageBitmap(photo);
  const width = Math.min(400, bitmap.width);
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = context.getImageData(0, 0, width, height);
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  let sum = 0;
  let squares = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const edge = grey[at - width] + grey[at + width] + grey[at - 1] + grey[at + 1] - 4 * grey[at];
      sum += edge;
      squares += edge * edge;
      n++;
    }
  return n ? squares / n - (sum / n) ** 2 : 0;
}

/** The first letters of the first two words of a name: “Notaría Benítez” is NB. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

export function mountSharedLink(element: HTMLElement, options: SharedLinkOptions): { destroy(): void } {
  const t = translator(options.texts ?? TEXTS[options.language ?? 'en']);
  const locale = options.language ?? 'en';
  // A link with a password asks for it first; it is kept for this page only, and sent with every request.
  let password: string | undefined;
  let asking: 'ask' | 'wrong' | null = null;
  let typed = '';
  let listing: LinkListing | null = null;
  let error: string | null = null;
  let alive = true;
  let asked = 0;

  // Who sends files through it, as they say they are called, told to the owner with each.
  let from = '';
  let nameMissing = false;
  /** All the request asked for came, the last from here: it closed, and says thanks. */
  let complete = false;
  /** What was written to the questions of the request, by the id of each; and whether one it needs is missing. */
  const answers: Record<string, string> = {};
  let answersMissing = false;
  /** Who sees what a link with a watermark shares, as they said: asked before anything is shown. */
  let viewer = '';
  let askingViewer = false;
  let typedViewer = '';
  /** The file seen in the page, of a link only to see or with a watermark: its address, while it is. */
  let viewing: { file: Entry; url: string } | null = null;
  const link = createLinkClient({
    base: options.base ?? '/api/files',
    token: options.token,
    password: () => password,
    from: () => from.trim() || undefined,
    viewer: () => viewer || undefined,
    answers: () => answers,
  });
  /** What was sent from this page, by the document of the request it is for ('' for none), each as it goes. */
  interface Sent {
    id: number;
    name: string;
    size: number;
    pct: number;
    state: 'sending' | 'sent' | 'failed' | 'undone';
    error?: string;
    receipt?: string;
    /** Until when it may be taken back. */
    until?: number;
    at?: string;
  }
  const sentFor = new Map<string, Sent[]>();
  /** Photos taken for a document, to be sent as one PDF. */
  const photosFor = new Map<string, File[]>();
  /** Of those, the ones that look blurry, until kept as they are. */
  const blurry = new Set<File>();
  const lookAt = (photos: File[]) => {
    if (options.checkBlur === false) return;
    for (const photo of photos)
      void sharpnessOf(photo).then(
        (sharp) => sharp < SHARP_ENOUGH && (blurry.add(photo), render()),
        () => undefined,
      );
  };
  /** Until when each document is good, as its sender says, of those the request asks it of. */
  const expiresFor = new Map<string, string>();
  let sent = 0;
  const UNDO_FOR = 10 * 60_000;
  const ask = () => listing?.link?.request;
  /** Who sends says their name first, when the request asks it, and writes what it needs written. */
  const named = () => {
    if (ask()?.askName && !from.trim()) {
      nameMissing = true;
      render();
      element.querySelector<HTMLInputElement>('.rf-send-name input')?.focus();
      return false;
    }
    const unsaid = (ask()?.questions ?? []).find((one) => one.required && !answers[one.id]?.trim());
    if (!unsaid) return true;
    answersMissing = true;
    render();
    element.querySelector<HTMLInputElement>(`.rf-answer-${unsaid.id} input`)?.focus();
    return false;
  };
  const send = async (files: Iterable<File>, item = '') => {
    if (!named()) return;
    const into = listing?.folder.kind === 'folder' && listing.link?.uploads === 'also' ? listing.folder.id : undefined;
    await Promise.all(
      [...files].map(async (file) => {
        const one: Sent = { id: ++sent, name: file.name, size: file.size, pct: 0, state: 'sending' };
        sentFor.set(item, [...(sentFor.get(item) ?? []), one]);
        render();
        const set = (change: Partial<Sent>) => {
          sentFor.set(
            item,
            (sentFor.get(item) ?? []).map((other) => (other.id === one.id ? { ...other, ...change } : other)),
          );
          render();
        };
        try {
          await link.upload(file, {
            folder: into,
            item: item || undefined,
            expires: (item && expiresFor.get(item)) || undefined,
            onProgress: ({ sent: done, size }) => set({ pct: Math.round((done / Math.max(1, size)) * 100) }),
            onReceipt: (receipt) => set({ receipt, until: Date.now() + UNDO_FOR }),
          });
          set({ state: 'sent', pct: 100, at: new Date().toISOString() });
        } catch (failed) {
          set({ state: 'failed', error: refusal(failed) });
        }
      }),
    );
    // What came is counted: the request says so, and a folder that is seen shows it.
    show(into && listing && into !== listing.root.id ? into : undefined);
  };
  /** What shows each photo taken, made once, let go of with it. */
  const photoUrls = new Map<File, string>();
  const photoUrl = (photo: File) => {
    let url = photoUrls.get(photo);
    if (!url) photoUrls.set(photo, (url = URL.createObjectURL(photo)));
    return url;
  };
  const forget = (photos: File[]) => {
    for (const photo of photos) {
      const url = photoUrls.get(photo);
      if (url) URL.revokeObjectURL(url);
      photoUrls.delete(photo);
    }
  };
  /** The photos of a document as one PDF, sent under its name. */
  const sendPhotos = async (item: string, label: string) => {
    const photos = photosFor.get(item) ?? [];
    if (!photos.length || !named()) return;
    photosFor.delete(item);
    forget(photos);
    render();
    try {
      const pdf = await picturesToPdf(photos);
      await send([new File([pdf], `${label || t('photos')}.pdf`, { type: 'application/pdf' })], item);
    } catch (failed) {
      error = (failed as Error).message;
      render();
    }
  };
  const takeBack = async (item: string, one: Sent) => {
    if (!one.receipt) return;
    try {
      await link.takeBack(one.receipt);
      sentFor.set(
        item,
        (sentFor.get(item) ?? []).map((other) => (other.id === one.id ? { ...other, state: 'undone' as const } : other)),
      );
      show();
    } catch (failed) {
      error = refusal(failed);
      render();
    }
  };
  /** What a refusal of the server says, in the words of the page where it has them. */
  const refusal = (failed: unknown) => {
    const code = failed instanceof RequestError ? failed.code : '';
    if (code === 'not-accepted') return t('notAccepted');
    if (code === 'too-large') return t('tooLargeHere');
    if (code === 'request-full') return t('requestFull');
    if (code === 'name-needed') return t('nameFirst');
    if (code === 'answers-missing') return t('answersFirst');
    return (failed as Error).message ?? t('couldNotSend');
  };
  /** A receipt of what was sent from this page: what, for which document, and when. */
  const receipt = () => {
    const lines = [t('receiptTitle', { name: listing?.root.name ?? '' }), from.trim() ? `${t('yourNameShort')}: ${from.trim()}` : '', ''];
    for (const [item, all] of sentFor) {
      const label = ask()?.items?.find((one) => one.id === item)?.label;
      for (const one of all.filter((other) => other.state === 'sent'))
        lines.push(`${one.at ? formatDate(one.at, locale) : ''} · ${label ? `${label} · ` : ''}${one.name} · ${formatSize(one.size, locale)}`);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    a.download = `${t('receiptFile')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  };
  // The minutes left to take back what was sent, said as they go.
  const ticking = setInterval(() => [...sentFor.values()].some((all) => all.some((one) => one.until && one.until > Date.now())) && render(), 30_000);
  const acceptOf = () => (ask()?.accept ?? []).map((one) => (one === 'image/*' ? 'image/*' : one)).join(',') || undefined;
  const rules = () => {
    const request = ask();
    return [
      request?.accept?.length ? t('takes', { what: kindsOf(request.accept) }) : null,
      request?.maxSize ? t('upTo', { size: formatSize(request.maxSize, locale) }) : null,
      request?.left !== undefined ? t('filesLeft', { n: request.left }) : null,
    ].filter(Boolean) as string[];
  };
  const kindsOf = (accept: string[]) =>
    [
      ...new Set(
        accept.map((one) =>
          one.includes('pdf')
            ? 'PDF'
            : one.startsWith('image/')
              ? t('photos')
              : one.includes('word') || one.startsWith('.doc')
                ? 'Word'
                : one.includes('sheet') || one.startsWith('.xls') || one === '.csv'
                  ? 'Excel'
                  : one,
        ),
      ),
    ].join(', ');
  /** What was sent for a document, or for none: each going, sent and to take back a while, or not sent. */
  const sentList = (item: string) => {
    const all = (sentFor.get(item) ?? []).filter((one) => one.state !== 'undone');
    if (!all.length) return null;
    return h(
      'ul',
      { class: 'rf-send-list', 'aria-live': 'polite' },
      all.map((one) => {
        const left = one.until ? Math.ceil((one.until - Date.now()) / 60_000) : 0;
        return h(
          'li',
          { key: String(one.id) },
          h('span', { class: 'rf-grow' }, one.name, h('small', null, ` · ${formatSize(one.size, locale)}`)),
          one.state === 'sending'
            ? h('small', null, `${one.pct}%`)
            : one.state === 'failed'
              ? h('small', { class: 'rf-error' }, one.error ?? t('couldNotSend'))
              : [
                  h('small', { class: 'rf-sent-ok' }, t('sentFile')),
                  left > 0 && one.receipt && h('button', { type: 'button', class: 'rf-btn rf-small', onClick: () => void takeBack(item, one) }, t('undoFor', { n: left })),
                ],
        );
      }),
    );
  };
  /** The buttons to send a document: a file of one's own, or photos taken now. */
  const pickers = (item: string, label: string) => {
    const photos = photosFor.get(item) ?? [];
    return h(
      'div',
      { class: 'rf-send-pick' },
      h('input', {
        type: 'file',
        multiple: !item,
        hidden: true,
        accept: acceptOf(),
        class: `rf-send-file rf-pick-${item || 'any'}`,
        onChange: (event: Event) => {
          const input = event.target as HTMLInputElement;
          if (input.files?.length) void send(input.files, item);
          input.value = '';
        },
      }),
      h('input', {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        hidden: true,
        class: `rf-send-camera rf-camera-${item || 'any'}`,
        onChange: (event: Event) => {
          const input = event.target as HTMLInputElement;
          const taken = [...(input.files ?? [])];
          if (taken.length) photosFor.set(item, [...(photosFor.get(item) ?? []), ...taken]);
          input.value = '';
          lookAt(taken);
          render();
        },
      }),
      h(
        'button',
        // Its name asked before the files, when the request asks it.
        { type: 'button', class: 'rf-btn rf-primary', onClick: () => named() && element.querySelector<HTMLInputElement>(`.rf-pick-${item || 'any'}`)?.click() },
        icon('upload', 16),
        h('span', null, item ? t('chooseFile') : t('uploadFiles')),
      ),
      h(
        'button',
        { type: 'button', class: 'rf-btn', onClick: () => named() && element.querySelector<HTMLInputElement>(`.rf-camera-${item || 'any'}`)?.click() },
        icon('camera', 16),
        h('span', null, photos.length ? t('anotherPhoto') : t('takePhoto')),
      ),
      photos.length > 0 &&
        h(
          'div',
          { class: 'rf-photos' },
          h('span', null, t('photosReady', { n: photos.length })),
          // Each page as it was taken, in its order, to take out the one that came out wrong.
          h(
            'ol',
            { class: 'rf-photo-pages', 'aria-label': t('photosTaken') },
            photos.map((photo, i) =>
              h(
                'li',
                { key: photoUrl(photo), class: blurry.has(photo) ? 'rf-blurry' : undefined },
                h('img', { src: photoUrl(photo), alt: t('pageN', { n: i + 1 }) }),
                h('span', { class: 'rf-photo-n', 'aria-hidden': 'true' }, String(i + 1)),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'rf-photo-out',
                    'aria-label': t('removePage', { n: i + 1 }),
                    onClick: () => {
                      forget([photo]);
                      photosFor.set(
                        item,
                        photos.filter((other) => other !== photo),
                      );
                      if (!photosFor.get(item)?.length) photosFor.delete(item);
                      render();
                    },
                  },
                  icon('close', 12),
                ),
              ),
            ),
            h(
              'li',
              { key: 'more' },
              h(
                'button',
                { type: 'button', class: 'rf-photo-more', 'aria-label': t('anotherPhoto'), onClick: () => element.querySelector<HTMLInputElement>(`.rf-camera-${item || 'any'}`)?.click() },
                icon('camera', 18),
              ),
            ),
          ),
          photos.some((photo) => blurry.has(photo)) &&
            h(
              'div',
              { class: 'rf-photo-blurry', role: 'alert' },
              h('span', null, t('blurry')),
              h(
                'button',
                {
                  type: 'button',
                  class: 'rf-btn rf-small',
                  onClick: () => {
                    const out = photos.filter((photo) => blurry.has(photo));
                    forget(out);
                    for (const photo of out) blurry.delete(photo);
                    photosFor.set(
                      item,
                      photos.filter((photo) => !out.includes(photo)),
                    );
                    if (!photosFor.get(item)?.length) photosFor.delete(item);
                    render();
                    element.querySelector<HTMLInputElement>(`.rf-camera-${item || 'any'}`)?.click();
                  },
                },
                icon('camera', 14),
                t('retake'),
              ),
              h('button', { type: 'button', class: 'rf-btn rf-small rf-text', onClick: () => (photos.forEach((photo) => blurry.delete(photo)), render()) }, t('keepIt')),
            ),
          h('button', { type: 'button', class: 'rf-btn rf-primary', onClick: () => void sendPhotos(item, label) }, t('sendPages', { n: photos.length })),
          h('button', { type: 'button', class: 'rf-btn rf-text', onClick: () => (forget(photos), photosFor.delete(item), render()) }, t('discard')),
        ),
    );
  };
  /** Where files are put, of a link that takes them: who sends them, each document asked for, and what went. */
  const sendBox = (only: boolean) => {
    const request = ask();
    const items = request?.items ?? [];
    const owner = listing?.link?.owner ?? '';
    const done = items.filter((one) => one.received > 0 || (sentFor.get(one.id) ?? []).some((s) => s.state === 'sent')).length;
    const anySent = [...sentFor.values()].some((all) => all.some((one) => one.state === 'sent'));
    return h(
      'section',
      {
        class: `rf-send${only ? ' rf-send-only' : ''}`,
        'aria-label': t('sendFiles'),
        onDragover: (event: DragEvent) => event.dataTransfer?.types.includes('Files') && event.preventDefault(),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          if (event.dataTransfer?.files.length && !items.length) void send(event.dataTransfer.files);
        },
      },
      only &&
        h(
          'div',
          { class: 'rf-send-who' },
          h('span', { class: 'rf-avatar rf-avatar-big' }, owner.slice(0, 1).toUpperCase()),
          h(
            'div',
            { class: 'rf-grow' },
            h('h2', null, items.length ? t('asksDocs', { who: owner, n: items.length }) : owner ? t('asksFiles', { who: owner }) : t('sendFilesTo', { name: listing?.root.name ?? '' })),
            h('p', null, [request?.title ?? listing?.root.name, listing?.link?.expires ? t('linkUntil', { date: formatDate(listing.link.expires, locale) }) : null].filter(Boolean).join(' · ')),
          ),
          items.length > 0 && h('div', { class: 'rf-send-count' }, h('strong', null, t('nOfM', { n: done, m: items.length })), h('small', null, t('sentPlural'))),
        ),
      !only && h('h2', null, t('addFilesHere')),
      items.length > 0 &&
        h(
          'span',
          {
            class: 'rf-progress',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': String(items.length),
            'aria-valuenow': String(done),
            'aria-label': t('docsOf', { n: done, m: items.length }),
          },
          h('span', { style: `width: ${Math.round((done / items.length) * 100)}%` }),
        ),
      complete && h('div', { class: 'rf-send-done', role: 'status' }, icon('check', 18), h('strong', null, t('allSent', { who: owner || t('theOwner') }))),
      !complete && request?.message && h('blockquote', { class: 'rf-send-message' }, request.message),
      only && !request?.message && !items.length && h('p', { class: 'rf-hint' }, t('sendFilesHint')),
      !complete &&
        h(
          'label',
          { class: `rf-send-name${nameMissing && !from.trim() ? ' rf-invalid' : ''}` },
          h('span', null, request?.askName ? t('yourNameNeeded') : t('yourName')),
          h('input', {
            type: 'text',
            autocomplete: 'name',
            value: from,
            'aria-invalid': nameMissing && !from.trim() ? 'true' : undefined,
            onInput: (event: Event) => {
              from = (event.target as HTMLInputElement).value;
              if (nameMissing && from.trim()) (nameMissing = false), render();
            },
          }),
          nameMissing && !from.trim() && h('small', { class: 'rf-error', role: 'alert' }, t('nameFirst')),
        ),
      // What it asks to be written, sent with each file.
      !complete &&
        request?.questions?.length &&
        h(
          'fieldset',
          { class: 'rf-send-answers' },
          h('legend', null, t('answersTitle')),
          request.questions.map((one) => {
            const missing = answersMissing && one.required && !answers[one.id]?.trim();
            return h(
              'label',
              { key: one.id, class: `rf-answer rf-answer-${one.id}${missing ? ' rf-invalid' : ''}` },
              h('span', null, one.required ? t('neededLabel', { label: one.label }) : one.label),
              h('input', {
                type: 'text',
                value: answers[one.id] ?? '',
                maxlength: 500,
                'aria-invalid': missing ? 'true' : undefined,
                onInput: (event: Event) => {
                  answers[one.id] = (event.target as HTMLInputElement).value;
                  if (missing && answers[one.id].trim()) render();
                },
              }),
              missing && h('small', { class: 'rf-error', role: 'alert' }, t('answersFirst')),
            );
          }),
        ),
      items.length
        ? h(
            'ol',
            { class: 'rf-send-items', 'aria-label': t('docsAskedOfYou') },
            items.map((one) => {
              const mine = (sentFor.get(one.id) ?? []).some((s) => s.state === 'sent');
              const got = one.received > 0 || mine;
              return h(
                'li',
                {
                  key: one.id,
                  class: got ? 'rf-got' : undefined,
                  // A file dropped on a document goes as that document.
                  onDragover: (event: DragEvent) => !complete && event.dataTransfer?.types.includes('Files') && (event.preventDefault(), event.stopPropagation()),
                  onDrop: (event: DragEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!complete && event.dataTransfer?.files.length) void send([event.dataTransfer.files[0]], one.id);
                  },
                },
                h(
                  'div',
                  { class: 'rf-send-item' },
                  h('span', { class: 'rf-send-check', 'aria-hidden': 'true' }, got ? icon('check', 14) : null),
                  h('strong', { class: 'rf-grow' }, one.label),
                  h('small', null, got ? t('sentFile') : rules().slice(0, 2).join(' · ')),
                ),
                sentList(one.id),
                // Until when it is good, asked before it goes, of a document that asks it.
                !complete &&
                  !got &&
                  one.expires &&
                  h(
                    'label',
                    { class: 'rf-send-expires' },
                    h('span', null, t('expiryOf')),
                    h('input', {
                      type: 'date',
                      value: expiresFor.get(one.id) ?? '',
                      onChange: (event: Event) => {
                        const value = (event.target as HTMLInputElement).value;
                        if (value) expiresFor.set(one.id, value);
                        else expiresFor.delete(one.id);
                      },
                    }),
                    h('small', { class: 'rf-hint' }, t('expiryOfHint')),
                  ),
                !complete && !got && pickers(one.id, one.label),
              );
            }),
          )
        : h('div', { class: 'rf-send-drop' }, h('strong', null, t('dragHere')), pickers('', ''), sentList('')),
      items.length === 0 && rules().length > 0 && h('p', { class: 'rf-hint' }, rules().join(' · ')),
      anySent &&
        h(
          'div',
          { class: 'rf-send-receipt' },
          icon('doc', 16),
          h('span', { class: 'rf-grow' }, t('receiptHint')),
          h('button', { type: 'button', class: 'rf-btn rf-text', onClick: receipt }, t('downloadReceipt')),
        ),
      only && h('p', { class: 'rf-send-foot' }, icon('lock', 14), t('onlyOwnerSeesLong', { who: owner || t('theOwner') })),
    );
  };

  const show = (folder?: EntryId) => {
    const n = ++asked;
    link.list(folder).then(
      (found) => n === asked && ((listing = found), (error = null), (asking = null), (askingViewer = false), render()),
      (failed: unknown) => {
        if (n !== asked) return;
        if (failed instanceof RequestError && failed.code === 'link-viewer') askingViewer = true;
        else if (failed instanceof RequestError && failed.status === 401) {
          asking = failed.code === 'link-password-wrong' ? 'wrong' : 'ask';
          password = undefined;
        } else if (failed instanceof RequestError && failed.code === 'request-closed' && listing && [...sentFor.values()].some((all) => all.some((one) => one.state === 'sent'))) {
          // Closed by what was just sent: all it asked for came. The page stays, to say so and give a receipt.
          complete = true;
          const items = listing.link?.request?.items;
          if (items) for (const one of items) one.received = Math.max(one.received, (sentFor.get(one.id) ?? []).some((s) => s.state === 'sent') ? 1 : 0);
        } else
          error =
            failed instanceof RequestError && failed.status === 404
              ? t('linkGone')
              : failed instanceof RequestError && failed.code === 'request-closed'
                ? t('requestClosedGuest')
                : String((failed as Error).message ?? failed);
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

  /** Of a link only to see, or that shows who sees it: what it shares is seen here, under their name, not in a tab of its own. */
  const inPage = () => Boolean(listing?.link?.viewOnly || listing?.link?.watermark);
  /** Who sees it, asked before anything of a link with a watermark is shown: their name goes over what they see. */
  const viewerForm = () =>
    h(
      'form',
      {
        class: 'rf-pass',
        onSubmit: (event: Event) => {
          event.preventDefault();
          if (!typedViewer.trim()) return;
          viewer = typedViewer.trim().slice(0, 100);
          show();
        },
      },
      h('p', { id: 'rf-viewer-hint' }, t('viewerAsks')),
      h('input', {
        type: 'text',
        autocomplete: 'name',
        'aria-label': t('yourName'),
        'aria-describedby': 'rf-viewer-hint',
        value: typedViewer,
        autofocus: true,
        onInput: (event: Event) => (typedViewer = (event.target as HTMLInputElement).value),
      }),
      h('button', { type: 'submit', class: 'rf-btn rf-primary' }, t('viewerOpen')),
    );

  /** Who sees it and when, written across what they see, again and again. */
  const watermark = () => {
    if (!listing?.link?.watermark || !viewer) return null;
    const said = `${viewer} · ${formatDate(new Date().toISOString(), locale)}`.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><text x="160" y="90" text-anchor="middle" transform="rotate(-24 160 90)" font-family="system-ui, sans-serif" font-size="15" fill="rgba(120,120,120,0.28)">${said}</text></svg>`;
    return h('div', { class: 'rf-watermark', 'aria-hidden': 'true', style: `background-image: url("data:image/svg+xml,${encodeURIComponent(svg)}")` });
  };

  /** A file seen in the page: as a picture, a PDF, a video or a sound; what cannot be shown so, said. */
  const fileView = () => {
    if (!viewing) return null;
    const { file, url } = viewing;
    const kind = kindOf(file);
    const only = Boolean(listing?.link?.viewOnly);
    const close = () => ((viewing = null), render());
    const body =
      kind === 'image'
        ? h('img', { src: url, alt: file.name, draggable: 'false', onContextmenu: (event: Event) => only && event.preventDefault() })
        : kind === 'pdf'
          ? h('iframe', { src: `${url}#toolbar=0&navpanes=0`, title: file.name })
          : kind === 'video'
            ? h('video', {
                src: url,
                controls: true,
                controlslist: only ? 'nodownload' : undefined,
                disablepictureinpicture: only ? true : undefined,
                onContextmenu: (event: Event) => only && event.preventDefault(),
              })
            : kind === 'audio'
              ? h('audio', { src: url, controls: true, controlslist: only ? 'nodownload' : undefined })
              : h('p', { class: 'rf-empty' }, t('cannotShowHere'));
    return h(
      'div',
      {
        class: 'rf-link-view',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': file.name,
        onKeydown: (event: KeyboardEvent) => event.key === 'Escape' && close(),
      },
      h(
        'div',
        { class: 'rf-link-view-top' },
        h('strong', { class: 'rf-grow' }, file.name),
        only && h('small', null, icon('lock', 12), t('viewOnlyNote')),
        !only && h('button', { type: 'button', class: 'rf-btn rf-text', 'aria-label': `${t('download')} · ${file.name}`, onClick: () => void open(file, true) }, icon('download', 16)),
        h('button', { type: 'button', class: 'rf-btn rf-text', 'aria-label': t('close'), autofocus: true, onClick: close }, icon('close', 16)),
      ),
      h('div', { class: `rf-link-view-body rf-link-view-${kind}` }, body, watermark()),
    );
  };

  const open = async (file: Entry, save = false) => {
    if (!save && inPage()) {
      try {
        viewing = { file, url: await link.url(file.id, { inline: true }) };
      } catch (failed) {
        error = (failed as Error).message;
      }
      render();
      return;
    }
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
      {
        class: `rf-drive rf-shared${options.className ? ` ${options.className}` : ''}`,
        'data-theme': options.theme ?? 'light',
        // In the colour of the drive whose request it is.
        style: listing?.link?.brand ? `--rf-brand: ${listing.link.brand}; --rf-focus: ${listing.link.brand}` : undefined,
      },
      h('style', null, CSS),
      h(
        'div',
        { class: 'rf-top' },
        // The organisation whose request it is, as its drive is named; else the folder or file the link is of.
        listing?.link?.company
          ? h(
              'div',
              { class: 'rf-title' },
              options.logo ?? h('span', { class: 'rf-company-mark', 'aria-hidden': 'true' }, initials(listing.link.company)),
              h('span', null, listing.link.company),
              listing.link.expires && listing.link.request && h('small', { class: 'rf-top-until' }, t('linkUntil', { date: formatDate(listing.link.expires, locale) })),
            )
          : h('div', { class: 'rf-title' }, options.logo ?? mark(), h('span', null, listing?.root.name ?? '')),
      ),
      h(
        'div',
        { class: 'rf-body' },
        h(
          'main',
          { class: 'rf-main' },
          asking
            ? passwordForm()
            : askingViewer
              ? viewerForm()
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
                        listing?.folder.kind === 'folder' && !listing.link?.viewOnly && zipButton(listing.folder, true),
                        listing?.link?.viewOnly && h('small', { class: 'rf-hint rf-view-only' }, icon('lock', 12), t('viewOnlyNote')),
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
                            listing?.link?.viewOnly
                              ? h('span', null)
                              : entry.kind === 'file'
                                ? h(
                                    'button',
                                    { type: 'button', class: 'rf-btn rf-text', 'aria-label': `${t('download')} · ${entry.name}`, onClick: () => void open(entry, true) },
                                    icon('download', 16),
                                  )
                                : zipButton(entry, false),
                          ),
                        ),
                      ),
                    ],
        ),
      ),
      fileView(),
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
      clearInterval(ticking);
      element.replaceChildren();
    },
  };
}
