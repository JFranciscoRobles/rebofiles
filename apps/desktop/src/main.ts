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
  },
}[language];

/** A problem with a server, said in the language of the window. */
const say = (found: { problem: ServerProblem; status?: number }) => TEXTS[found.problem].replace('{status}', String(found.status ?? ''));

let drive: MountedDrive | null = null;

/** The drive of `server`, filling the window. */
function open(server: Server) {
  drive?.destroy();
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
  root.replaceChildren(style(), form);
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
    @media (prefers-color-scheme: dark) {
      .connect p, .connect small { color: #a9b8b0; }
      .connect input { background: #1a221e; border-color: #3b4a42; }
      .connect .error { color: #ffb4ab; }
    }`;
  return css;
}

// The menu of the application, from Rust: another server.
type TauriGlobal = { event: { listen(name: string, then: () => void): Promise<() => void> } };
(window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__?.event.listen('change-server', () => {
  forget();
  ask();
});

const kept = recall();
if (kept) {
  // Asked again at every start: a server moved or a token gone shows the form, with what it said.
  tryServer(kept).then((problem) => (problem ? ask(say(problem)) : open(kept)));
} else ask();
