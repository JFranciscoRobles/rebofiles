// The window of the desktop application: which ReboFiles server it is, asked
// the first time and kept, and then the drive of @rebofiles/drive against it,
// as in a browser. "Change server…" in the menu of the application asks again.
//
// The server lets this page in with `cors: { origins: ['tauri://localhost',
// 'http://tauri.localhost'] }`, the origins of the window on a Mac and on
// Windows, and the bucket with the same in its rule of origins.

import { type MountedDrive, mountDrive } from '@rebofiles/drive';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/drive/rebodocs';
import { type Server, type ServerProblem, forget, recall, remember, tryServer } from './server';
import { type SyncStatus, canSync, defaultFolder, keptSync, startSync } from './sync';

const root = document.getElementById('root')!;
const language = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';

const TEXTS = {
  en: {
    title: 'Connect to a drive',
    hint: 'The address of the routes of a ReboFiles server, as https://files.example.com/api/files.',
    address: 'Address',
    tokenLabel: 'Token (optional)',
    tokenHint: 'Sent as Authorization: Bearer, when the server asks for one.',
    connect: 'Connect',
    trying: 'Connecting…',
    'not-an-address': 'That is not an address.',
    'not-http': 'The address starts with https://.',
    token: 'The server did not take that token.',
    answered: 'The server answered {status}: is that the address of its routes?',
    'not-rebofiles': 'That is not a ReboFiles server.',
    unreachable: 'The server could not be reached, or does not let this application in (its cors origins).',
    syncTitle: 'Sync a folder',
    syncHint: 'A folder of this computer kept as your drive, both ways: what changes on one side goes to the other.',
    syncFolder: 'Folder on this computer',
    syncStart: 'Keep in sync',
    syncStop: 'Stop syncing',
    close: 'Close',
    syncing: 'Syncing…',
    synced: 'In sync · {n} changes',
    syncedNone: 'In sync',
    syncFailed: 'Not synced: {error}',
    syncFailedSome: '{n} could not be synced',
  },
  es: {
    title: 'Conectar con un drive',
    hint: 'La dirección de las rutas de un servidor de ReboFiles, como https://files.example.com/api/files.',
    address: 'Dirección',
    tokenLabel: 'Token (opcional)',
    tokenHint: 'Se envía como Authorization: Bearer, cuando el servidor lo pide.',
    connect: 'Conectar',
    trying: 'Conectando…',
    'not-an-address': 'Eso no es una dirección.',
    'not-http': 'La dirección empieza por https://.',
    token: 'El servidor no aceptó ese token.',
    answered: 'El servidor respondió {status}: ¿es la dirección de sus rutas?',
    'not-rebofiles': 'Eso no es un servidor de ReboFiles.',
    unreachable: 'No se pudo llegar al servidor, o no deja entrar a esta aplicación (sus orígenes de cors).',
    syncTitle: 'Sincronizar una carpeta',
    syncHint: 'Una carpeta de esta computadora, igual que tu drive en los dos sentidos: lo que cambia en un lado pasa al otro.',
    syncFolder: 'Carpeta en esta computadora',
    syncStart: 'Mantener sincronizada',
    syncStop: 'Dejar de sincronizar',
    close: 'Cerrar',
    syncing: 'Sincronizando…',
    synced: 'Sincronizada · {n} cambios',
    syncedNone: 'Sincronizada',
    syncFailed: 'Sin sincronizar: {error}',
    syncFailedSome: '{n} no se pudieron sincronizar',
  },
}[language];

/** A problem with a server, said in the language of the window. */
const say = (found: { problem: ServerProblem; status?: number }) => TEXTS[found.problem].replace('{status}', String(found.status ?? ''));

let drive: MountedDrive | null = null;
let current: Server | null = null;
let syncing: ReturnType<typeof startSync> | null = null;

/** The drive of `server`, filling the window. */
function open(server: Server) {
  drive?.destroy();
  syncing?.stop();
  syncing = null;
  current = server;
  root.replaceChildren();
  const host = new URL(server.address).host;
  drive = mountDrive(root, {
    base: server.address,
    headers: (): Record<string, string> => (server.token ? { authorization: `Bearer ${server.token}` } : {}),
    language,
    title: host,
    theme: 'auto',
    // A link is opened in a browser, on the site of the server, not in this window.
    linkAddress: (token) => `${new URL(server.address).origin}/?link=${encodeURIComponent(token)}`,
    previewDocument: previewDocx,
    viewDocument: viewDocx,
    thumbDocument: thumbDocx,
    textDocument: textOfDocx,
    pictureDocument: pictureOfDocx,
  });
  // The folder synced before with this server, kept in sync again.
  const kept = canSync() ? keptSync(server.address) : null;
  if (kept) sync(kept.folder);
}

// ---- A folder of the computer, kept as the drive ----

// The styles of the window's own: the form, the dialog and the chip, which are not the drive's.
document.head.append(style());

const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'sync-chip', hidden: true });
chip.addEventListener('click', () => askSync());
document.body.append(chip);

function showStatus(status: SyncStatus) {
  const failed = status.last?.actions.filter((a) => a.do === 'failed').length ?? 0;
  const changes = (status.last?.actions.length ?? 0) - failed;
  chip.hidden = false;
  chip.dataset.state = status.running ? 'running' : status.error || failed ? 'problem' : 'idle';
  chip.textContent = status.running
    ? TEXTS.syncing
    : status.error
      ? TEXTS.syncFailed.replace('{error}', status.error)
      : failed
        ? TEXTS.syncFailedSome.replace('{n}', String(failed))
        : changes
          ? TEXTS.synced.replace('{n}', String(changes))
          : TEXTS.syncedNone;
  chip.title = status.folder;
}

function sync(folder: string) {
  if (!drive || !current) return;
  syncing?.stop();
  syncing = startSync(current.address, drive.client, folder, showStatus);
}

/** The dialog that says which folder, and starts or stops it. */
async function askSync() {
  if (!drive || !current || !canSync()) return;
  const server = current;
  const kept = keptSync(server.address);
  const dialog = document.createElement('dialog');
  dialog.className = 'sync-dialog';
  dialog.setAttribute('aria-labelledby', 'sync-title');
  const heading = Object.assign(document.createElement('h2'), { id: 'sync-title', textContent: TEXTS.syncTitle });
  const hint = Object.assign(document.createElement('p'), { textContent: TEXTS.syncHint });
  const label = Object.assign(document.createElement('label'), { className: 'field', textContent: TEXTS.syncFolder });
  const input = Object.assign(document.createElement('input'), { type: 'text', required: true, value: kept?.folder ?? (await defaultFolder()) });
  label.append(input);
  const row = document.createElement('div');
  row.className = 'row';
  const close = Object.assign(document.createElement('button'), { type: 'button', className: 'quiet', textContent: TEXTS.close });
  close.addEventListener('click', () => dialog.close());
  row.append(close);
  if (syncing) {
    const stop = Object.assign(document.createElement('button'), { type: 'button', className: 'quiet', textContent: TEXTS.syncStop });
    stop.addEventListener('click', () => {
      syncing?.stop(true);
      syncing = null;
      chip.hidden = true;
      dialog.close();
    });
    row.append(stop);
  }
  const start = Object.assign(document.createElement('button'), { type: 'submit', textContent: TEXTS.syncStart });
  row.append(start);
  const form = document.createElement('form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sync(input.value.trim());
    dialog.close();
  });
  form.append(heading, hint, label, row);
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}

/** The form asking which server, with what was given before in it. */
function ask(error?: string) {
  drive?.destroy();
  drive = null;
  const before = recall();
  const field = (label: string, input: HTMLInputElement, hint?: string) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.append(label, input);
    if (hint) {
      const small = document.createElement('small');
      small.textContent = hint;
      wrap.append(small);
    }
    return wrap;
  };
  const address = Object.assign(document.createElement('input'), { type: 'url', required: true, value: before?.address ?? '', placeholder: 'https://files.example.com/api/files' });
  const token = Object.assign(document.createElement('input'), { type: 'password', value: before?.token ?? '', autocomplete: 'off' });
  const button = Object.assign(document.createElement('button'), { type: 'submit', textContent: TEXTS.connect });
  const said = Object.assign(document.createElement('p'), { className: 'error', role: 'alert', textContent: error ?? '' });
  const heading = Object.assign(document.createElement('h1'), { textContent: TEXTS.title });
  const hint = Object.assign(document.createElement('p'), { textContent: TEXTS.hint });
  const form = document.createElement('form');
  form.className = 'connect';
  form.append(heading, hint, field(TEXTS.address, address), field(TEXTS.tokenLabel, token, TEXTS.tokenHint), said, button);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = TEXTS.trying;
    const server = { address: address.value.trim().replace(/\/$/, ''), token: token.value.trim() || undefined };
    const problem = await tryServer(server);
    if (problem) {
      said.textContent = say(problem);
      button.disabled = false;
      button.textContent = TEXTS.connect;
      return;
    }
    remember(server);
    open(server);
  });
  root.replaceChildren(form);
  address.focus();
}

function style() {
  const css = document.createElement('style');
  css.textContent = `
    .connect { box-sizing: border-box; max-width: 440px; margin: 12vh auto 0; padding: 0 24px; display: flex; flex-direction: column; gap: 14px; }
    .connect h1 { font-size: 22px; margin: 0; }
    .connect p { margin: 0; color: #4b5a52; line-height: 1.45; }
    .connect .field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; }
    .connect small { font-weight: 400; color: #5c6b63; }
    .connect input { font: inherit; font-weight: 400; padding: 10px 12px; border-radius: 10px; border: 1px solid #b9c7bf; background: #fff; color: inherit; }
    .connect input:focus { outline: none; border-color: #0e7c52; box-shadow: 0 0 0 3px #0e7c5233; }
    .connect button { font: inherit; font-weight: 600; padding: 10px 16px; border-radius: 999px; border: 0; background: #0e7c52; color: #fff; align-self: flex-start; }
    .connect button:disabled { opacity: 0.7; }
    .connect .error { color: #b3261e; min-height: 1.2em; }
    .sync-chip { position: fixed; left: 14px; bottom: 12px; z-index: 50; font: 600 12px system-ui, sans-serif; padding: 6px 12px; border-radius: 999px; border: 1px solid #b9c7bf; background: #fff; color: #1d2a23; max-width: 50vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sync-chip[data-state='running']::before { content: '⟳ '; }
    .sync-chip[data-state='idle']::before { content: '✓ '; color: #0e7c52; }
    .sync-chip[data-state='problem'] { color: #b3261e; border-color: #e3a7a2; }
    .sync-dialog { border: 0; border-radius: 16px; padding: 24px; width: min(460px, calc(100vw - 32px)); box-sizing: border-box; font: 14px system-ui, sans-serif; }
    .sync-dialog::backdrop { background: #0006; }
    .sync-dialog form { display: flex; flex-direction: column; gap: 14px; }
    .sync-dialog h2 { margin: 0; font-size: 18px; }
    .sync-dialog p { margin: 0; color: #4b5a52; line-height: 1.45; }
    .sync-dialog .field { display: flex; flex-direction: column; gap: 6px; font-weight: 600; }
    .sync-dialog input { font: inherit; font-weight: 400; padding: 10px 12px; border-radius: 10px; border: 1px solid #b9c7bf; }
    .sync-dialog .row { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .sync-dialog button { font: inherit; font-weight: 600; padding: 9px 16px; border-radius: 999px; border: 0; background: #0e7c52; color: #fff; }
    .sync-dialog button.quiet { background: transparent; color: #1d2a23; border: 1px solid #b9c7bf; }
    @media (prefers-color-scheme: dark) {
      .connect p, .connect small { color: #a9b8b0; }
      .connect input { background: #1a221e; border-color: #3b4a42; }
      .connect .error { color: #ffb4ab; }
      .sync-chip { background: #1a221e; color: #e3ebe6; border-color: #3b4a42; }
      .sync-dialog { background: #1a221e; color: #e3ebe6; }
      .sync-dialog p { color: #a9b8b0; }
      .sync-dialog input { background: #111814; color: inherit; border-color: #3b4a42; }
      .sync-dialog button.quiet { color: #e3ebe6; border-color: #3b4a42; }
    }`;
  return css;
}

// The menu of the application, from Rust: another server.
type TauriGlobal = { event: { listen(name: string, then: () => void): Promise<() => void> } };
(window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__?.event.listen('change-server', () => {
  syncing?.stop();
  syncing = null;
  chip.hidden = true;
  forget();
  ask();
});
(window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__?.event.listen('sync-folder', () => void askSync());

const kept = recall();
if (kept) {
  // Asked again at every start: a server moved or a token gone shows the form, with what it said.
  tryServer(kept).then((problem) => (problem ? ask(say(problem)) : open(kept)));
} else ask();
