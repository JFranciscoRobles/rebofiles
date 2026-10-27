// The languages of the site: English at the addresses it has always had, and
// Spanish and Mandarin under /es/ and /zh/. What the frame, the landing and
// the demos say is here, in each; what the pages of the documentation say is
// in their own modules, one for each language.

export const LOCALES = ['en', 'es', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
/** The ones with a prefix of their own: English has none. */
export const PREFIXED = ['es', 'zh'] as const satisfies readonly Locale[];

export const LOCALE_INFO: Record<Locale, { name: string; html: string; og: string; hreflang: string }> = {
  en: { name: 'English', html: 'en', og: 'en_US', hreflang: 'en' },
  es: { name: 'Español', html: 'es', og: 'es_ES', hreflang: 'es' },
  zh: { name: '中文', html: 'zh-Hans', og: 'zh_CN', hreflang: 'zh-Hans' },
};

export const isLocale = (value: string | undefined): value is Locale => LOCALES.includes(value as Locale);

/** An address of the site in a language: `/docs/react/` in English, `/es/docs/react/` in Spanish. */
export const localePath = (locale: Locale, path: string) => (locale === 'en' ? path : `/${locale}${path === '/' ? '/' : path}`);

/** The language an address is in, and the address without it. */
export function splitPath(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split('/');
  if (isLocale(first) && first !== 'en') return { locale: first, path: `/${rest.join('/')}` };
  return { locale: 'en', path: pathname || '/' };
}

/** The same page in every language, for hreflang and the sitemap. */
export const alternatesOf = (path: string) => ({
  ...Object.fromEntries(LOCALES.map((locale) => [LOCALE_INFO[locale].hreflang, localePath(locale, path)])),
  'x-default': path,
});

type Feature = [title: string, text: string];

export interface Dictionary {
  nav: { demo: string; docs: string; status: string; getStarted: string; home: string; language: string };
  footer: { statusRoadmap: string; suite: string; license: string; llms: string };
  badge: string;
  home: {
    title: string;
    description: string;
    newBadge: string;
    newLine: string;
    h1: [before: string, marked: string, after: string];
    lead: string;
    tryBelow: string;
    whatItDoes: string;
    tags: string[];
    demoPill: string;
    demoTitle: string;
    demoLead: string;
    demoNote: string;
    demoLink: string;
    featuresPill: string;
    featuresTitle: string;
    features: Feature[];
    comingIn: (version: string) => string;
    devPill: string;
    devTitle: string;
    devLead: string;
    readGuide: string;
    examples: string;
    samples: string[];
    packagesPill: string;
    packagesTitle: string;
    packagesLead: string;
    seeOnNpm: string;
    notOnNpm: string;
    packageCols: [string, string, string];
    packages: Record<string, { what: string; tag: string }>;
    statusPill: string;
    statusBig: [string, string];
    statusHand: string;
    statusTitle: string;
    statusText: (tests: number, published: string | null) => string;
    statusLink: string;
    install: { packages: string; copy: string; copied: string; soon: (version: string) => string };
  };
  docs: {
    docs: string;
    pages: string;
    close: string;
    api: string;
    onThisPage: string;
    tip: string;
    previous: string;
    next: string;
    helpful: string;
    thanksYes: string;
    thanksNo: string;
    yes: string;
    notReally: string;
    edit: string;
    documentation: string;
    englishOnly: string;
  };
  search: {
    button: string;
    dialog: string;
    label: string;
    placeholder: string;
    results: string;
    nothing: (query: string) => string;
    tryThis: string;
    move: string;
    open: string;
    close: string;
    count: (n: number, typed: boolean) => string;
    groups: Record<'Page' | 'Section' | 'Package' | 'Component' | 'Prop' | 'Hook' | 'Function' | 'Route' | 'Tool', string>;
  };
  demo: {
    title: string;
    description: string;
    h1: string;
    back: string;
    which: string;
    tabs: Record<'included' | 'compact' | 'headless', { label: string; short: string; note: string }>;
  };
  groups: Record<string, string>;
  pages: Record<string, string>;
}

const en: Dictionary = {
  nav: { demo: 'Demo', docs: 'Docs', status: 'Status', getStarted: 'Get started', home: 'Home', language: 'Language' },
  footer: { statusRoadmap: 'Status & roadmap', suite: 'Part of the Rebo suite:', license: 'Open source under the MIT license.', llms: 'The documentation for language models' },
  badge: 'Open source · MIT',
  home: {
    title: 'ReboFiles: the file drive you build into your app',
    description: 'An open-source file manager for your app, on your own storage: folders, uploads, previews, versions, sharing and a trash, with Word documents opened in Rebodocs.',
    newBadge: 'New',
    newLine: 'Requests that collect documents, Word versions compared, starred files and webhooks',
    h1: ['The file drive you', 'build into', 'your app.'],
    lead: 'A file manager for the browser, on your own storage. Upload, organise and preview files, with folders, versions and a trash — in packages you take one at a time.',
    tryBelow: 'Try it below',
    whatItDoes: 'What it does',
    tags: [
      'Upload & download',
      'Uploads that resume',
      'Whole folders',
      'Time left for each file',
      'Folders & search',
      'Search inside files',
      'DOCX · PDF · image previews',
      'A viewer',
      'Open in Rebodocs',
      'Versions',
      'Trash',
      'Download as .zip',
      'Duplicates caught',
      'Activity',
      'Folder colours',
      'S3 · R2 · MinIO · disk',
      'Your own authorize()',
      'Sharing & links',
      'Links with a password',
      'Quotas',
      'MCP for assistants',
      'Desktop app & folder sync',
      'Changes as they happen',
      'Folders of thousands',
      'Comments',
      'Groups',
      'PDF thumbnails',
      'Virus & type checks',
      'Retention & legal hold',
      'Rate limits',
      'Keyboard & screen readers',
      'Dark theme',
      'English, Spanish & Chinese',
      'Requests for files',
      'Templates, QR and reminders',
      'Documents checked, dates that expire',
      'Received, accepted or returned',
      'Copies',
      'Starred',
      'Notifications',
      'Fields of your app',
      'Shares that end',
      'Word: new, compare, PDF',
      'Excel previews',
      'OCR',
      'GCS · Azure',
      'Webhooks',
    ],
    demoPill: 'Live demo',
    demoTitle: 'This is the drive. Click around.',
    demoLead:
      'Open folders, search, upload a few files and watch each go, preview them, open a .docx in Rebodocs, colour a folder, restore an old version, send it to the trash and bring it back. Nothing leaves the browser.',
    demoNote: 'Claude’s rename goes through the MCP tools of @rebofiles/mcp and Rebodocs, here in the page. Same drive, your own UI →',
    demoLink: 'see it in another look, built with the headless hooks',
    featuresPill: 'Features',
    featuresTitle: 'A drive you can trust with real files.',
    features: [
      [
        'Uploads you can watch',
        'Straight to your bucket in parts, three files at once, each with how fast it goes and how long it has left. Whole folders as they were, and one cut goes on from where it was.',
      ],
      [
        'Search, inside files too',
        'By name without minding case or accents, and by what is written in text, Word, Excel and PDF files, and in pictures and scans by OCR, with the words found shown in the row.',
      ],
      [
        'Previews and a viewer',
        'Word documents page by page with Rebodocs’ zoom, PDFs, pictures, video, audio, Excel sheets and text, over the drive with the arrows to go on. Pictures in four sizes, blurred while they come; a PDF’s first page and a video’s frame drawn by the server.',
      ],
      [
        'Word, with Rebodocs',
        'A new document from the Upload menu, opened in the Rebodocs editor, every save a new version; two versions compared, what changed marked; and a document downloaded as a PDF.',
      ],
      [
        'Sharing and permissions',
        'Viewer, commenter and editor, on a folder and all that is in it, for a person or a group of your app, for good or for a while. Links that expire, with a password or for one download. Your backend can still say no.',
      ],
      ['Versions and copies', 'Every save keeps the file before it. Restore an old one in one click, without sending its bytes again; make a copy, its bytes copied in the storage.'],
      ['Duplicates caught', 'The same file uploaded again, or another of a name already there, is asked about first: replace it as a new version, keep both, or skip.'],
      [
        'Trash and space',
        'Deleted files wait in the trash, folders with what is in them, and it empties itself after the days you choose. A quota for each person, and the space they use beside the drive.',
      ],
      ['Activity', 'Who uploaded, renamed, moved, shared or deleted what, in the details of each file and folder, kept by your database.'],
      ['Download as .zip', 'Several picked, a folder or a shared link’s folder in one archive, made in the page as the files come; what could not be read is said, to get on its own.'],
      ['Your storage', 'S3, Cloudflare R2, MinIO, Google Cloud Storage, Azure or a disk, with no SDK. The bytes never pass through anyone else.'],
      ['A desktop app, and sync', 'The drive in a window of its own, with Tauri, and a folder of the computer kept the same as the drive, both ways: only the parts of a file that changed are sent.'],
      ['Keyboard', 'The arrows, Enter, Delete and F2 in the list, a menu for each entry, ⌘Z to undo, dialogs that keep the focus, and a screen reader told where it is. Checked with axe.'],
      ['Your style', 'Light or dark, your brand’s colour, folders in colours and the list in any order, all from its settings; or build your own UI with the headless hooks.'],
      ['AI assistants', 'Claude finds, reads, searches inside, writes, renames, comments and files documents through an MCP server, with the user’s own rights, and nothing it does is for good.'],
      ['As it happens', 'What someone else changes shows in a moment, without loading again; a folder of thousands scrolls as one of ten. The server reads a piece of the drive at a time.'],
      ['Comments', 'Threads on a file or a folder, replies, resolved when done, and @ to name someone, who your app tells.'],
      ['Kept safe', 'Programs and files that are not what they say refused, viruses with ClamAV, limits on who asks too often, a minimum of days, legal holds, and everything of a person exported.'],
      [
        'Requests for files',
        'A link that collects the documents you name, from someone with no account: each in its place, photos from a phone made one PDF, in a folder for each person, named by your pattern. You accept each, or return it with a reason. From a template, with a QR code for a phone, reminders by mail, what came checked against what was asked, and a word before it expires.',
      ],
      ['Starred and told', 'Each person’s starred files, and a bell that tells them what was shared with them, who named them in a comment, and what came through their requests.'],
      [
        'Built for your app',
        'Fields of your own on each file, to tie it to your records; webhooks signed for each change; and for who looks after it, the space of each person and the activity of the whole drive.',
      ],
    ],
    comingIn: (version) => `Coming in ${version}`,
    devPill: 'For developers',
    devTitle: 'It feels like part of your app — because it is.',
    devLead: 'It mounts in your page, uses your fonts and your language, and sends bytes straight to your bucket. Where files live and who can open them stays your app’s business.',
    readGuide: 'Read the guide',
    examples: 'Examples',
    samples: ['React', 'Your UI', 'Server', 'With Rebodocs', 'In the page'],
    packagesPill: 'Packages',
    packagesTitle: 'Take what you need.',
    packagesLead: 'The core has no DOM, so the same file model runs in your server, your browser and your desktop.',
    seeOnNpm: 'See them on npm →',
    notOnNpm: 'All are written; none is on npm yet.',
    packageCols: ['Package', 'What it does', 'Runs in'],
    packages: {
      '@rebofiles/core': { what: 'The file model: folders, names, versions, the trash and search. No dependencies.', tag: 'No DOM' },
      '@rebofiles/drive': { what: 'The whole drive with no framework, mounted on an element, and the client it is built on.', tag: 'No framework' },
      '@rebofiles/react': { what: 'The drive as a React component, or as headless hooks, with uploads and previews inside.', tag: 'React' },
      '@rebofiles/server': { what: 'The routes, authorize(), signed addresses, the bytes on S3, GCS, Azure or a disk and the metadata in SQLite or Postgres.', tag: 'Node' },
      '@rebofiles/sync': { what: 'A folder of the computer kept as a folder of the drive, both ways, in the desktop app and as a command.', tag: 'Sync' },
      '@rebofiles/mcp': {
        what: 'Tools for an AI assistant to list, search, read, write, rename, move and trash files, and with Rebodocs to edit Word documents, with the user’s own rights.',
        tag: 'MCP',
      },
    },
    statusPill: 'Where it stands',
    statusBig: ['Your files.', 'Your storage.'],
    statusHand: 'the bytes never pass through anyone else',
    statusTitle: 'Early, open, and built on Rebodocs.',
    statusText: (tests, published) =>
      `A file manager with its own file model that keeps your files where you put them, previews Word documents with the Rebodocs engine and opens every .docx in its editor. ${tests} automated tests pass; ${published ? `the packages are on npm at ${published}` : 'nothing is on npm yet'}. Open source under MIT.`,
    statusLink: 'What’s checked, what’s missing →',
    install: { packages: 'Packages', copy: 'Copy', copied: 'Copied', soon: (version) => `Not on npm yet · v${version} soon` },
  },
  docs: {
    docs: 'Docs',
    pages: 'Pages of the documentation',
    close: 'Close',
    api: 'API',
    onThisPage: 'On this page',
    tip: 'tip: press ⌘K to jump to any prop or route',
    previous: '← Previous',
    next: 'Next →',
    helpful: 'Was this page helpful?',
    thanksYes: 'Thanks — glad it helped.',
    thanksNo: 'Thanks — we will make it clearer.',
    yes: 'Yes',
    notReally: 'Not really',
    edit: 'Edit this page',
    documentation: 'Documentation',
    englishOnly: '',
  },
  search: {
    button: 'Search docs, props, routes…',
    dialog: 'Search the documentation',
    label: 'Search',
    placeholder: 'Search pages, props, hooks, routes…',
    results: 'Results',
    nothing: (query) => `Nothing found for “${query}”.`,
    tryThis: 'Try a hook, a prop, a route or a word of a page: useUploads, quota, /zip…',
    move: 'to move',
    open: 'to open',
    close: 'to close',
    count: (n, typed) => (typed ? `${n} ${n === 1 ? 'result' : 'results'}` : `${n} pages`),
    groups: {
      Page: 'Pages',
      Section: 'Sections',
      Component: 'Components',
      Hook: 'Hooks',
      Prop: 'Props and options',
      Function: 'Client and functions',
      Route: 'HTTP routes',
      Package: 'Packages',
      Tool: 'Tools for an assistant',
    },
  },
  demo: {
    title: 'Demo',
    description: 'The drive in your browser, three ways: the interface that comes with it, its compact layout, and one of your own built on the headless hooks. Nothing leaves the page.',
    h1: 'The demo of ReboFiles',
    back: 'Back to the site',
    which: 'Which interface',
    tabs: {
      included: { label: 'The included one', short: 'Included', note: '<FileDrive> as it comes: Word documents opened in Rebodocs, and Claude at work through MCP a few seconds in.' },
      compact: { label: 'Compact', short: 'Compact', note: '<FileDrive layout="compact">: no column on the left; New and the places in a strip over the list.' },
      headless: { label: 'Your own interface', short: 'Your own', note: 'A creative suite’s look, built on the hooks: DriveProvider, useEntries, useEntry, useActions, useUploads…' },
    },
  },
  groups: { Start: 'Start', 'Put it in your app': 'Put it in your app', Files: 'Files', 'The server': 'The server', Together: 'Together', Reference: 'Reference' },
  pages: {},
};

const es: Dictionary = {
  nav: { demo: 'Demo', docs: 'Documentación', status: 'Estado', getStarted: 'Empezar', home: 'Inicio', language: 'Idioma' },
  footer: { statusRoadmap: 'Estado y hoja de ruta', suite: 'Parte de la suite Rebo:', license: 'Código abierto con licencia MIT.', llms: 'La documentación para modelos de lenguaje' },
  badge: 'Código abierto · MIT',
  home: {
    title: 'ReboFiles: el drive de archivos que integras en tu app',
    description: 'Un gestor de archivos de código abierto para tu app, en tu propio almacenamiento: carpetas, subidas, vistas previas, versiones, compartir y papelera, y Word en Rebodocs.',
    newBadge: 'Nuevo',
    newLine: 'Solicitudes que reúnen documentos, versiones de Word comparadas, destacados y webhooks',
    h1: ['El drive de archivos que', 'integras en', 'tu app.'],
    lead: 'Un gestor de archivos para el navegador, en tu propio almacenamiento. Sube, organiza y previsualiza archivos, con carpetas, versiones y papelera, en paquetes que tomas de uno en uno.',
    tryBelow: 'Pruébalo abajo',
    whatItDoes: 'Qué hace',
    tags: [
      'Subir y descargar',
      'Subidas que se reanudan',
      'Carpetas enteras',
      'Tiempo restante de cada archivo',
      'Carpetas y búsqueda',
      'Búsqueda dentro de archivos',
      'Vista previa de DOCX · PDF · imágenes',
      'Un visor',
      'Abrir en Rebodocs',
      'Versiones',
      'Papelera',
      'Descargar como .zip',
      'Duplicados detectados',
      'Actividad',
      'Colores de carpeta',
      'S3 · R2 · MinIO · disco',
      'Tu propio authorize()',
      'Compartir y enlaces',
      'Enlaces con contraseña',
      'Cuotas',
      'MCP para asistentes',
      'App de escritorio y sincronización',
      'Cambios en vivo',
      'Carpetas de miles',
      'Comentarios',
      'Grupos',
      'Miniaturas de PDF',
      'Revisión de virus y tipos',
      'Retención y bloqueo legal',
      'Límites de peticiones',
      'Teclado y lectores de pantalla',
      'Tema oscuro',
      'Inglés, español y chino',
      'Solicitudes de archivos',
      'Plantillas, QR y recordatorios',
      'Documentos revisados, fechas que vencen',
      'Recibidos: aceptar o devolver',
      'Copias',
      'Destacados',
      'Notificaciones',
      'Campos de tu app',
      'Compartir por un tiempo',
      'Word: nuevo, comparar, PDF',
      'Vista de Excel',
      'OCR',
      'GCS · Azure',
      'Webhooks',
    ],
    demoPill: 'Demo en vivo',
    demoTitle: 'Este es el drive. Explóralo.',
    demoLead:
      'Abre carpetas, busca, sube algunos archivos y mira cómo avanza cada uno, previsualízalos, abre un .docx en Rebodocs, colorea una carpeta, restaura una versión antigua, mándala a la papelera y recupérala. Nada sale del navegador.',
    demoNote: 'El cambio de nombre de Claude pasa por las herramientas MCP de @rebofiles/mcp y Rebodocs, aquí en la página. El mismo drive, tu propia interfaz →',
    demoLink: 'míralo con otro aspecto, hecho con los hooks headless',
    featuresPill: 'Funciones',
    featuresTitle: 'Un drive al que puedes confiar archivos reales.',
    features: [
      [
        'Subidas que puedes seguir',
        'Directo a tu bucket en partes, tres archivos a la vez, cada uno con su velocidad y el tiempo que le queda. Carpetas enteras tal como estaban, y una subida cortada sigue desde donde iba.',
      ],
      [
        'Búsqueda, también dentro',
        'Por nombre sin importar mayúsculas ni acentos, y por lo que está escrito en archivos de texto, Word, Excel y PDF, y en imágenes y escaneos con OCR, con las palabras encontradas en la fila.',
      ],
      [
        'Vistas previas y un visor',
        'Documentos de Word página a página con el zoom de Rebodocs, PDF, imágenes, vídeo, audio, hojas de Excel y texto, sobre el drive con flechas para seguir. Imágenes en cuatro tamaños, difuminadas mientras llegan; la primera página de un PDF y un fotograma de un vídeo, dibujados por el servidor.',
      ],
      [
        'Word, con Rebodocs',
        'Un documento nuevo desde el menú Subir, abierto en el editor de Rebodocs, cada guardado una versión nueva; dos versiones comparadas, con lo que cambió marcado; y un documento descargado como PDF.',
      ],
      [
        'Compartir y permisos',
        'Lector, comentarista y editor, en una carpeta y todo lo que contiene, para una persona o un grupo de tu app, para siempre o por un tiempo. Enlaces que caducan, con contraseña o de una sola descarga. Tu backend siempre puede decir que no.',
      ],
      ['Versiones y copias', 'Cada guardado conserva el archivo anterior. Restaura uno antiguo con un clic, sin volver a enviar sus bytes; haz una copia, sus bytes copiados en el almacenamiento.'],
      ['Duplicados detectados', 'El mismo archivo subido otra vez, u otro con un nombre que ya existe, se pregunta antes: reemplazarlo como nueva versión, conservar ambos u omitirlo.'],
      ['Papelera y espacio', 'Lo borrado espera en la papelera, las carpetas con su contenido, y se vacía sola tras los días que elijas. Una cuota por persona, y el espacio que usa junto al drive.'],
      ['Actividad', 'Quién subió, renombró, movió, compartió o borró qué, en los detalles de cada archivo y carpeta, guardado por tu base de datos.'],
      [
        'Descargar como .zip',
        'Varios elegidos, una carpeta o la carpeta de un enlace compartido en un solo archivo, hecho en la página a medida que llegan; lo que no se pudo leer se avisa, para bajarlo aparte.',
      ],
      ['Tu almacenamiento', 'S3, Cloudflare R2, MinIO, Google Cloud Storage, Azure o un disco, sin SDK. Los bytes nunca pasan por nadie más.'],
      [
        'Una app de escritorio, y sincronización',
        'El drive en su propia ventana, con Tauri, y una carpeta de la computadora igual que el drive en los dos sentidos: de un archivo solo viajan las partes que cambiaron.',
      ],
      [
        'Teclado',
        'Flechas, Enter, Supr y F2 en la lista, un menú para cada elemento, ⌘Z para deshacer, diálogos que retienen el foco y un lector de pantalla que sabe dónde está. Comprobado con axe.',
      ],
      ['Tu estilo', 'Claro u oscuro, el color de tu marca, carpetas de colores y la lista en cualquier orden, todo desde sus ajustes; o construye tu propia interfaz con los hooks headless.'],
      [
        'Asistentes de IA',
        'Claude encuentra, lee, busca dentro, escribe, renombra, comenta y archiva documentos mediante un servidor MCP, con los permisos del usuario, y nada de lo que hace es definitivo.',
      ],
      ['En el momento', 'Lo que cambia otra persona aparece al instante, sin recargar; una carpeta de miles se desplaza como una de diez. El servidor lee el drive por partes.'],
      ['Comentarios', 'Hilos en un archivo o carpeta, respuestas, resueltos al terminar, y @ para nombrar a alguien, a quien avisa tu app.'],
      ['A salvo', 'Programas y archivos que no son lo que dicen rechazados, virus con ClamAV, límites a quien pide demasiado, un mínimo de días, retención legal, y todo lo de una persona exportado.'],
      [
        'Solicitudes de archivos',
        'Un enlace que reúne los documentos que nombras, de alguien sin cuenta: cada uno en su lugar, las fotos de un teléfono unidas en un PDF, en una carpeta por persona, con el nombre que elijas. Aceptas cada uno, o lo devuelves con un motivo. Desde una plantilla, con un QR para el teléfono, recordatorios por correo, lo recibido revisado contra lo pedido y aviso antes de que venza.',
      ],
      ['Destacados y avisos', 'Los archivos que cada persona destaca, y una campana que le avisa lo que le compartieron, quién la nombró en un comentario y lo que llegó por sus solicitudes.'],
      [
        'Hecho para tu app',
        'Campos propios en cada archivo, para atarlo a tus registros; webhooks firmados de cada cambio; y para quien lo administra, el espacio de cada persona y la actividad de todo el drive.',
      ],
    ],
    comingIn: (version) => `Llega en ${version}`,
    devPill: 'Para desarrolladores',
    devTitle: 'Se siente parte de tu app, porque lo es.',
    devLead: 'Se monta en tu página, usa tus fuentes y tu idioma, y envía los bytes directo a tu bucket. Dónde viven los archivos y quién puede abrirlos sigue siendo cosa de tu app.',
    readGuide: 'Lee la guía',
    examples: 'Ejemplos',
    samples: ['React', 'Tu interfaz', 'Servidor', 'Con Rebodocs', 'En la página'],
    packagesPill: 'Paquetes',
    packagesTitle: 'Toma lo que necesites.',
    packagesLead: 'El núcleo no depende del DOM, así que el mismo modelo de archivos funciona en tu servidor, tu navegador y tu escritorio.',
    seeOnNpm: 'Velos en npm →',
    notOnNpm: 'Todos están escritos; ninguno está en npm todavía.',
    packageCols: ['Paquete', 'Qué hace', 'Dónde corre'],
    packages: {
      '@rebofiles/core': { what: 'El modelo de archivos: carpetas, nombres, versiones, la papelera y la búsqueda. Sin dependencias.', tag: 'Sin DOM' },
      '@rebofiles/drive': { what: 'El drive completo sin framework, montado en un elemento, y el cliente sobre el que está hecho.', tag: 'Sin framework' },
      '@rebofiles/react': { what: 'El drive como componente de React, o como hooks headless, con subidas y vistas previas dentro.', tag: 'React' },
      '@rebofiles/server': { what: 'Las rutas, authorize(), direcciones firmadas, los bytes en S3, GCS, Azure o un disco y los metadatos en SQLite o Postgres.', tag: 'Node' },
      '@rebofiles/sync': { what: 'Una carpeta de la computadora igual que una del drive, en los dos sentidos, en la app de escritorio y como comando.', tag: 'Sync' },
      '@rebofiles/mcp': {
        what: 'Herramientas para que un asistente de IA liste, busque, lea, escriba, renombre, mueva y mande a la papelera, y con Rebodocs edite documentos de Word, con los permisos del usuario.',
        tag: 'MCP',
      },
    },
    statusPill: 'Dónde está',
    statusBig: ['Tus archivos.', 'Tu almacenamiento.'],
    statusHand: 'los bytes nunca pasan por nadie más',
    statusTitle: 'Temprano, abierto y construido sobre Rebodocs.',
    statusText: (tests, published) =>
      `Un gestor de archivos con su propio modelo que guarda tus archivos donde los pones, previsualiza documentos de Word con el motor de Rebodocs y abre cada .docx en su editor. Pasan ${tests} tests automáticos; ${published ? `los paquetes están en npm en la ${published}` : 'todavía nada está en npm'}. Código abierto con licencia MIT.`,
    statusLink: 'Qué está comprobado y qué falta →',
    install: { packages: 'Paquetes', copy: 'Copiar', copied: 'Copiado', soon: (version) => `Aún no está en npm · v${version} pronto` },
  },
  docs: {
    docs: 'Docs',
    pages: 'Páginas de la documentación',
    close: 'Cerrar',
    api: 'API',
    onThisPage: 'En esta página',
    tip: 'consejo: pulsa ⌘K para saltar a cualquier prop o ruta',
    previous: '← Anterior',
    next: 'Siguiente →',
    helpful: '¿Te sirvió esta página?',
    thanksYes: 'Gracias, nos alegra que te sirviera.',
    thanksNo: 'Gracias, la haremos más clara.',
    yes: 'Sí',
    notReally: 'No mucho',
    edit: 'Editar esta página',
    documentation: 'Documentación',
    englishOnly: 'Las descripciones de la referencia salen del código, en inglés.',
  },
  search: {
    button: 'Busca en la documentación…',
    dialog: 'Buscar en la documentación',
    label: 'Buscar',
    placeholder: 'Busca páginas, props, hooks, rutas…',
    results: 'Resultados',
    nothing: (query) => `No se encontró nada para «${query}».`,
    tryThis: 'Prueba un hook, una prop, una ruta o una palabra de una página: useUploads, quota, /zip…',
    move: 'para moverte',
    open: 'para abrir',
    close: 'para cerrar',
    count: (n, typed) => (typed ? `${n} ${n === 1 ? 'resultado' : 'resultados'}` : `${n} páginas`),
    groups: {
      Page: 'Páginas',
      Section: 'Secciones',
      Component: 'Componentes',
      Hook: 'Hooks',
      Prop: 'Props y opciones',
      Function: 'Cliente y funciones',
      Route: 'Rutas HTTP',
      Package: 'Paquetes',
      Tool: 'Herramientas para un asistente',
    },
  },
  demo: {
    title: 'Demo',
    description: 'El drive en tu navegador, de tres formas: la interfaz que trae, su diseño compacto y una propia hecha con los hooks headless. Nada sale de la página.',
    h1: 'La demo de ReboFiles',
    back: 'Volver al sitio',
    which: 'Qué interfaz',
    tabs: {
      included: { label: 'La incluida', short: 'Incluida', note: '<FileDrive> tal como viene: documentos de Word abiertos en Rebodocs, y Claude trabajando por MCP a los pocos segundos.' },
      compact: { label: 'Compacta', short: 'Compacta', note: '<FileDrive layout="compact">: sin columna a la izquierda; Nuevo y los lugares en una franja sobre la lista.' },
      headless: { label: 'Tu propia interfaz', short: 'La tuya', note: 'Con aspecto de suite creativa, hecha con los hooks: DriveProvider, useEntries, useEntry, useActions, useUploads…' },
    },
  },
  groups: { Start: 'Empezar', 'Put it in your app': 'Ponlo en tu app', Files: 'Archivos', 'The server': 'El servidor', Together: 'En equipo', Reference: 'Referencia' },
  pages: {
    index: 'Qué es ReboFiles',
    'getting-started': 'Primeros pasos',
    demos: 'Demos para ejecutar',
    react: 'Componente de React',
    hooks: 'Headless: tu propia interfaz',
    vanilla: 'Sin framework',
    styling: 'Estilos y temas',
    accessibility: 'Teclado y accesibilidad',
    languages: 'Idiomas',
    uploads: 'Subidas',
    previews: 'Vistas previas y el visor',
    search: 'Búsqueda',
    live: 'Cambios en vivo y carpetas grandes',
    comments: 'Comentarios',
    organizing: 'Destacados y campos',
    versions: 'Versiones, papelera y espacio',
    zip: 'Descargar como .zip',
    word: 'Documentos de Word',
    server: 'La ruta',
    frameworks: 'Frameworks e inicio de sesión',
    authorize: 'Quién puede hacer qué',
    storage: 'Almacenamiento: S3, GCS, Azure y disco',
    'checking-uploads': 'Revisar las subidas',
    metadata: 'Metadatos: SQLite y Postgres',
    schema: 'Esquema de la base de datos',
    sharing: 'Compartir y enlaces',
    activity: 'Actividad y notificaciones',
    observability: 'Ganchos, registros y límites',
    retention: 'Retención, bloqueos y exportación',
    desktop: 'Escritorio y otros orígenes',
    sync: 'Sincronizar una carpeta',
    production: 'Ir a producción',
    assistants: 'Asistentes de IA (MCP)',
    packages: 'Paquetes',
    components: 'Componentes y hooks',
    client: 'API del cliente',
    routes: 'Rutas HTTP',
    status: 'Estado y hoja de ruta',
  },
};

const zh: Dictionary = {
  nav: { demo: '演示', docs: '文档', status: '状态', getStarted: '开始使用', home: '首页', language: '语言' },
  footer: { statusRoadmap: '状态与路线图', suite: 'Rebo 套件的一员：', license: '基于 MIT 许可证开源。', llms: '面向大语言模型的文档' },
  badge: '开源 · MIT',
  home: {
    title: 'ReboFiles：嵌入你应用中的文件网盘',
    description: '为你的应用打造的开源文件管理器，数据存放在你自己的存储中：文件夹、上传、预览、版本、共享与回收站，Word 文档可在 Rebodocs 中打开编辑。',
    newBadge: '新',
    newLine: '收集文件的请求、Word 版本比较、星标与 webhook',
    h1: ['嵌入你', '应用之中', '的文件网盘。'],
    lead: '面向浏览器的文件管理器，使用你自己的存储。上传、整理和预览文件，支持文件夹、版本与回收站——以独立的包按需引入。',
    tryBelow: '在下方试用',
    whatItDoes: '功能一览',
    tags: [
      '上传与下载',
      '断点续传',
      '整个文件夹上传',
      '每个文件的剩余时间',
      '文件夹与搜索',
      '文件内容搜索',
      'DOCX · PDF · 图片预览',
      '查看器',
      '在 Rebodocs 中打开',
      '版本',
      '回收站',
      '打包下载 .zip',
      '重复文件检测',
      '动态记录',
      '文件夹颜色',
      'S3 · R2 · MinIO · 本地磁盘',
      '你自己的 authorize()',
      '共享与链接',
      '带密码的链接',
      '存储配额',
      '面向 AI 助手的 MCP',
      '桌面应用与文件夹同步',
      '实时更改',
      '上千个文件的文件夹',
      '评论',
      '群组',
      'PDF 缩略图',
      '病毒与类型检查',
      '保留与法律保留',
      '请求频率限制',
      '键盘与屏幕阅读器',
      '深色主题',
      '英文、西班牙文与中文',
      '文件收集',
      '模板、二维码与提醒',
      '文件检查与到期日期',
      '已收到：接受或退回',
      '副本',
      '星标',
      '通知',
      '应用自有字段',
      '限时共享',
      'Word：新建、比较、PDF',
      'Excel 预览',
      'OCR',
      'GCS · Azure',
      'Webhook',
    ],
    demoPill: '在线演示',
    demoTitle: '这就是网盘，随便点点看。',
    demoLead: '打开文件夹、搜索、上传几个文件并看着它们逐个完成，预览它们，在 Rebodocs 中打开 .docx，给文件夹上色，恢复旧版本，把文件移到回收站再找回来。所有操作都不离开浏览器。',
    demoNote: 'Claude 的重命名通过 @rebofiles/mcp 和 Rebodocs 的 MCP 工具完成，就在这个页面里。同一个网盘，你自己的界面 →',
    demoLink: '看看用 headless hooks 打造的另一种外观',
    featuresPill: '功能',
    featuresTitle: '一个可以放心交付真实文件的网盘。',
    features: [
      ['看得见的上传', '分片直传到你的存储桶，同时三个文件，每个都显示速度和剩余时间。整个文件夹保持原有结构上传，中断后从断点继续。'],
      ['搜索，也搜内容', '按名称搜索，不区分大小写和重音；也能搜索文本、Word、Excel 和 PDF 文件中的文字，以及通过 OCR 识别的图片和扫描件，并在列表中显示命中的词句。'],
      [
        '预览与查看器',
        'Word 文档借助 Rebodocs 的缩放逐页查看，还有 PDF、图片、视频、音频、Excel 工作表和文本，覆盖在网盘之上，用方向键切换。图片生成四种尺寸，加载时先显示模糊占位图；PDF 的第一页和视频的一帧由服务器绘制。',
      ],
      ['Word，借助 Rebodocs', '从“上传”菜单新建文档，在 Rebodocs 编辑器中打开，每次保存都是新版本；比较两个版本并标出变化；还可下载为 PDF。'],
      ['共享与权限', '查看者、评论者和编辑者，作用于文件夹及其全部内容，可共享给个人或你应用中的群组，永久或限时。可设置有效期、密码或仅限一次下载的链接。你的后端始终拥有最终否决权。'],
      ['版本与副本', '每次保存都会保留之前的文件。一键恢复旧版本，无需重新上传文件内容；创建副本时，内容在存储中直接复制。'],
      ['重复文件检测', '再次上传同一文件，或上传同名文件时，会先询问：作为新版本替换、两者都保留，或跳过。'],
      ['回收站与空间', '删除的文件会留在回收站，文件夹连同其内容一起，并在你设定的天数后自动清空。可为每个人设置配额，并在网盘旁显示已用空间。'],
      ['动态记录', '谁上传、重命名、移动、共享或删除了什么，都显示在每个文件和文件夹的详情中，由你的数据库保存。'],
      ['打包下载 .zip', '多选的文件、一个文件夹或共享链接中的文件夹打包成一个压缩包，在页面中边下载边生成；无法读取的文件会提示出来，方便单独下载。'],
      ['你的存储', 'S3、Cloudflare R2、MinIO、Google Cloud Storage、Azure 或本地磁盘，无需 SDK。文件内容绝不经过任何第三方。'],
      ['桌面应用与同步', '基于 Tauri 以独立窗口运行网盘，并让电脑上的文件夹与网盘双向保持一致：文件只传输更改的部分。'],
      ['键盘操作', '列表中可用方向键、Enter、Delete 和 F2，每个条目都有菜单，⌘Z 撤销，对话框保持焦点，屏幕阅读器能获知当前位置。通过 axe 检查。'],
      ['你的风格', '浅色或深色、品牌主色、彩色文件夹和任意排序，全部在设置中完成；也可以用 headless hooks 构建你自己的界面。'],
      ['AI 助手', 'Claude 可以通过 MCP 服务器查找、阅读、搜索内容、写入、重命名、评论和归档文档，权限与用户本人一致，而且它的任何操作都可以撤回。'],
      ['实时', '他人的更改片刻即现，无需刷新；上千个文件的文件夹滚动起来与十个一样流畅。服务器按需读取网盘。'],
      ['评论', '文件或文件夹上的讨论串、回复、处理后标记为已解决，并可用 @ 提到某人，由你的应用通知对方。'],
      ['安全可靠', '拒绝程序和名不副实的文件，用 ClamAV 查杀病毒，限制请求过于频繁的人，设置最少保留天数和法律保留，并可导出某人的全部数据。'],
      [
        '文件收集',
        '一个链接即可向无需帐户的人收集你列出的文件：每项各有位置，手机照片合并为一个 PDF，每人一个文件夹，按你的规则命名。你可逐个接受，或附原因退回。可从模板创建，附手机二维码、邮件提醒，收到的文件与要求比对，到期前提醒。',
      ],
      ['星标与通知', '每个人可为文件加星标；铃铛会告诉他们谁与其共享了内容、谁在评论中提到了他们，以及通过收集收到了什么。'],
      ['为你的应用而建', '每个文件可带自有字段，与你的记录关联；每次更改发送签名的 webhook；管理员可查看每人的空间和整个网盘的动态。'],
    ],
    comingIn: (version) => `将于 ${version} 推出`,
    devPill: '面向开发者',
    devTitle: '它就像你应用的一部分——因为它本来就是。',
    devLead: '它挂载在你的页面中，使用你的字体和语言，并把文件内容直接传到你的存储桶。文件存放在哪里、谁能打开，仍由你的应用决定。',
    readGuide: '阅读指南',
    examples: '示例',
    samples: ['React', '你的界面', '服务器', '配合 Rebodocs', '纯页面内'],
    packagesPill: '包',
    packagesTitle: '按需取用。',
    packagesLead: '核心不依赖 DOM，因此同一个文件模型可以在你的服务器、浏览器和桌面端运行。',
    seeOnNpm: '在 npm 上查看 →',
    notOnNpm: '全部已编写完成，但尚未发布到 npm。',
    packageCols: ['包', '作用', '运行环境'],
    packages: {
      '@rebofiles/core': { what: '文件模型：文件夹、名称、版本、回收站和搜索。零依赖。', tag: '无 DOM' },
      '@rebofiles/drive': { what: '不依赖框架的完整网盘，挂载到一个元素上，以及它所基于的客户端。', tag: '无框架' },
      '@rebofiles/react': { what: '以 React 组件或 headless hooks 形式提供的网盘，内置上传与预览。', tag: 'React' },
      '@rebofiles/server': { what: '路由、authorize()、签名地址、存放在 S3、GCS、Azure 或磁盘上的文件内容，以及存放在 SQLite 或 Postgres 中的元数据。', tag: 'Node' },
      '@rebofiles/sync': { what: '让电脑上的文件夹与网盘文件夹双向保持一致，可用于桌面应用，也可作为命令。', tag: '同步' },
      '@rebofiles/mcp': { what: '供 AI 助手使用的工具：列出、搜索、阅读、写入、重命名、移动文件和移入回收站，配合 Rebodocs 还能编辑 Word 文档，权限与用户本人一致。', tag: 'MCP' },
    },
    statusPill: '当前进展',
    statusBig: ['你的文件。', '你的存储。'],
    statusHand: '文件内容绝不经过任何第三方',
    statusTitle: '早期、开放，构建于 Rebodocs 之上。',
    statusText: (tests, published) =>
      `一个拥有自己文件模型的文件管理器：文件放在你指定的位置，用 Rebodocs 引擎预览 Word 文档，并在其编辑器中打开每个 .docx。${tests} 个自动化测试全部通过；${published ? `各个包已以 ${published} 发布到 npm` : '目前尚未发布到 npm'}。基于 MIT 许可证开源。`,
    statusLink: '已验证的与尚缺的 →',
    install: { packages: '包', copy: '复制', copied: '已复制', soon: (version) => `尚未发布到 npm · v${version} 即将推出` },
  },
  docs: {
    docs: '文档',
    pages: '文档页面',
    close: '关闭',
    api: 'API',
    onThisPage: '本页内容',
    tip: '提示：按 ⌘K 可跳转到任意属性或路由',
    previous: '← 上一页',
    next: '下一页 →',
    helpful: '这一页对你有帮助吗？',
    thanksYes: '谢谢，很高兴对你有帮助。',
    thanksNo: '谢谢，我们会把它写得更清楚。',
    yes: '有帮助',
    notReally: '不太有',
    edit: '编辑此页',
    documentation: '文档',
    englishOnly: '参考表中的说明来自代码，为英文。',
  },
  search: {
    button: '搜索文档、属性、路由…',
    dialog: '搜索文档',
    label: '搜索',
    placeholder: '搜索页面、属性、hooks、路由…',
    results: '结果',
    nothing: (query) => `没有找到与“${query}”相关的内容。`,
    tryThis: '试试一个 hook、属性、路由或页面中的词：useUploads、quota、/zip…',
    move: '移动',
    open: '打开',
    close: '关闭',
    count: (n, typed) => (typed ? `${n} 个结果` : `${n} 个页面`),
    groups: {
      Page: '页面',
      Section: '章节',
      Component: '组件',
      Hook: 'Hooks',
      Prop: '属性与选项',
      Function: '客户端与函数',
      Route: 'HTTP 路由',
      Package: '包',
      Tool: '助手工具',
    },
  },
  demo: {
    title: '演示',
    description: '在浏览器中体验网盘的三种形态：自带的界面、紧凑布局，以及用 headless hooks 打造的自定义界面。所有内容都不离开页面。',
    h1: 'ReboFiles 演示',
    back: '返回网站',
    which: '选择界面',
    tabs: {
      included: { label: '自带界面', short: '自带', note: '开箱即用的 <FileDrive>：Word 文档在 Rebodocs 中打开，几秒后 Claude 会通过 MCP 开始工作。' },
      compact: { label: '紧凑布局', short: '紧凑', note: '<FileDrive layout="compact">：左侧没有侧栏，“新建”和各个位置排成一条，位于列表上方。' },
      headless: { label: '你自己的界面', short: '自定义', note: '创意套件风格的外观，基于 hooks 构建：DriveProvider、useEntries、useEntry、useActions、useUploads…' },
    },
  },
  groups: { Start: '开始', 'Put it in your app': '集成到你的应用', Files: '文件', 'The server': '服务器', Together: '协作', Reference: '参考' },
  pages: {
    index: '什么是 ReboFiles',
    'getting-started': '快速开始',
    demos: '可运行的演示',
    react: 'React 组件',
    hooks: 'Headless：你自己的界面',
    vanilla: '不使用框架',
    styling: '样式与主题',
    accessibility: '键盘与无障碍',
    languages: '语言',
    uploads: '上传',
    previews: '预览与查看器',
    search: '搜索',
    live: '实时更改与大文件夹',
    comments: '评论',
    organizing: '星标与字段',
    versions: '版本、回收站与空间',
    zip: '打包下载 .zip',
    word: 'Word 文档',
    server: '路由',
    frameworks: '框架与登录',
    authorize: '谁可以做什么',
    storage: '存储：S3、GCS、Azure 与磁盘',
    'checking-uploads': '检查上传',
    metadata: '元数据：SQLite 与 Postgres',
    schema: '数据库结构',
    sharing: '共享与链接',
    activity: '动态与通知',
    observability: '钩子、日志与限制',
    retention: '保留、法律保留与导出',
    desktop: '桌面端与其他来源',
    sync: '同步文件夹',
    production: '上线生产环境',
    assistants: 'AI 助手（MCP）',
    packages: '包',
    components: '组件与 hooks',
    client: '客户端 API',
    routes: 'HTTP 路由',
    status: '状态与路线图',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, es, zh };
export const dict = (locale: Locale) => DICTIONARIES[locale];
