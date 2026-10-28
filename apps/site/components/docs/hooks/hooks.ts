// The hooks of @rebofiles/react, as the explorer shows them. Plain data: what
// runs is in `examples/`, one file each, and the page colours their code when
// the site is built. Each text in each language of the site.

import type { L } from './live';

export type HookKind = 'Read' | 'Change' | 'Together' | 'Records' | 'Drive';
export const HOOK_KINDS: HookKind[] = ['Read', 'Change', 'Together', 'Records', 'Drive'];

export const KIND_NAMES: Record<HookKind | 'All', L> = {
  All: { en: 'All', es: 'Todos', zh: '全部' },
  Read: { en: 'Read', es: 'Leer', zh: '读取' },
  Change: { en: 'Change', es: 'Cambiar', zh: '修改' },
  Together: { en: 'Together', es: 'Juntos', zh: '协作' },
  Records: { en: 'Records', es: 'Registros', zh: '记录' },
  Drive: { en: 'The drive', es: 'El drive', zh: '网盘' },
};

export interface HookDoc {
  name: string;
  /** How it is called, when it takes something. */
  sig: string;
  kind: HookKind;
  short: L;
  description: L;
  returns: { key: string; description: L }[];
  note?: L;
}

const l = (en: string, es: string, zh: string): L => ({ en, es, zh });
const loading = {
  key: 'loading, error',
  description: l('Whether it is still asked; what the server refused', 'Si aún se está pidiendo; lo que el servidor rechazó', '是否仍在请求；服务器拒绝的原因'),
};

export const HOOKS: HookDoc[] = [
  {
    name: 'useEntries',
    sig: "useEntries({ section: 'files', folder })",
    kind: 'Read',
    short: l('A folder, a section, a search', 'Una carpeta, una sección, una búsqueda', '文件夹、分区、搜索'),
    description: l(
      'What a list shows: a folder, Recent, Starred, what came through requests, Shared with me, the trash or a search, asked again after every change.',
      'Lo que muestra una lista: una carpeta, Recientes, Destacados, lo recibido por solicitudes, Compartido conmigo, la papelera o una búsqueda, pedido de nuevo tras cada cambio.',
      '列表显示的内容：文件夹、最近、星标、通过请求收到的文件、与我共享、回收站或搜索结果，每次变更后重新获取。',
    ),
    returns: [
      { key: 'entries', description: l('The folders and files, folders first', 'Las carpetas y archivos, primero las carpetas', '文件夹和文件，文件夹在前') },
      { key: 'path', description: l('For a folder, the folders from the top down to it', 'En una carpeta, las carpetas desde arriba hasta ella', '对于文件夹，从顶层到它的各级文件夹') },
      loading,
      { key: 'refresh()', description: l('Ask again now', 'Pedir de nuevo ahora', '立即重新获取') },
    ],
    note: l(
      'The last view’s entries stay shown while the next loads, with loading true: not taken for the new one’s.',
      'Las entradas de la vista anterior se quedan mientras carga la siguiente, con loading en true: no se toman por las de la nueva.',
      '下一个视图加载时仍显示上一个视图的条目，且 loading 为 true：不会被当作新视图的内容。',
    ),
  },
  {
    name: 'useEntry',
    sig: 'useEntry(id)',
    kind: 'Read',
    short: l('One entry as it is now', 'Una entrada tal como está', '某个条目的当前状态'),
    description: l(
      'One entry as the server says it is now, and the folders above it.',
      'Una entrada tal como el servidor dice que está ahora, y las carpetas por encima.',
      '服务器所说的某个条目的当前状态，以及其上层文件夹。',
    ),
    returns: [
      { key: 'entry', description: l('The folder or the file, with its versions', 'La carpeta o el archivo, con sus versiones', '文件夹或文件，包括其版本') },
      { key: 'path', description: l('The folders above it', 'Las carpetas por encima', '其上层文件夹') },
      { key: 'trashed', description: l('Whether it is in the trash', 'Si está en la papelera', '是否在回收站中') },
    ],
    note: l('The whole answer is null while it loads, or when there is none.', 'La respuesta entera es null mientras carga, o si no existe.', '加载中或不存在时，整个返回值为 null。'),
  },
  {
    name: 'useTextSearch',
    sig: 'useTextSearch(query)',
    kind: 'Read',
    short: l('By what is written inside', 'Por lo que está escrito dentro', '按内容搜索'),
    description: l(
      'The files with these words written inside, each with a piece of its text around them. Nothing is asked for an empty query.',
      'Los archivos con estas palabras escritas dentro, cada uno con un trozo de su texto. Una búsqueda vacía no pide nada.',
      '内容中包含这些文字的文件，每个附带一段上下文。查询为空时不发出请求。',
    ),
    returns: [{ key: 'results', description: l('Each { entry, snippet }', 'Cada { entry, snippet }', '每项为 { entry, snippet }') }, loading],
  },
  {
    name: 'useActivity',
    sig: 'useActivity(id, limit?)',
    kind: 'Read',
    short: l('Who did what to it', 'Quién hizo qué', '谁做了什么'),
    description: l(
      'What was done to an entry, by whom and when, the newest first.',
      'Lo que se hizo a una entrada, quién y cuándo, lo más nuevo primero.',
      '对某个条目做过的操作、操作者和时间，最新的在前。',
    ),
    returns: [{ key: 'activity', description: l('Each { at, by, action, name }', 'Cada { at, by, action, name }', '每项为 { at, by, action, name }') }, loading],
  },
  {
    name: 'useActions',
    sig: 'useActions()',
    kind: 'Change',
    short: l('What changes the drive', 'Lo que cambia el drive', '修改网盘'),
    description: l(
      'Every change, each a promise, telling every hook to ask again when it is done. A refusal of the server is a RequestError with its message.',
      'Cada cambio, cada uno una promesa, que avisa a todos los hooks al terminar. Un rechazo del servidor es un RequestError con su mensaje.',
      '每个修改都是一个 Promise，完成后通知所有 hooks 重新获取。服务器的拒绝是带有消息的 RequestError。',
    ),
    returns: [
      { key: 'createFolder, rename, move', description: l('Folders and names', 'Carpetas y nombres', '文件夹和名称') },
      { key: 'moveToTrash, restore, deleteForever, emptyTrash', description: l('The trash', 'La papelera', '回收站') },
      {
        key: 'copy, star, setColor, setFields',
        description: l('A copy, starred, a folder’s colour, fields of your own', 'Una copia, destacado, el color de una carpeta, campos propios', '副本、星标、文件夹颜色、自定义字段'),
      },
      { key: 'share, unshare, createLink, removeLink', description: l('With someone, or by a link', 'Con alguien, o por un enlace', '与某人共享，或通过链接') },
      {
        key: 'upload, restoreVersion, review, url',
        description: l('Files, their versions, what came through a request', 'Archivos, sus versiones, lo recibido por una solicitud', '文件、版本、通过请求收到的文件'),
      },
    ],
  },
  {
    name: 'useUploads',
    sig: 'useUploads({ check })',
    kind: 'Change',
    short: l('Files going up', 'Archivos subiendo', '正在上传的文件'),
    description: l(
      'Files sent three at a time, in parts, with how far each has gone, how fast and how long it has left. With check, each looked for in the drive first.',
      'Archivos enviados de tres en tres, en partes, con cuánto lleva cada uno, a qué velocidad y cuánto le queda. Con check, cada uno se busca antes en el drive.',
      '文件每次三个、分片上传，显示每个文件的进度、速度和剩余时间。启用 check 时会先在网盘中查找。',
    ),
    returns: [
      { key: 'uploads', description: l('Each { name, size, sent, state, remaining }', 'Cada { name, size, sent, state, remaining }', '每项为 { name, size, sent, state, remaining }') },
      { key: 'summary', description: l('All of them together', 'Todos juntos', '全部汇总') },
      { key: 'upload(files, folder)', description: l('Send these', 'Enviar estos', '上传这些文件') },
      { key: 'retry, stop, stopAll, decide, dismiss, clear', description: l('What a panel of uploads does', 'Lo que hace un panel de subidas', '上传面板的操作') },
    ],
  },
  {
    name: 'useComments',
    sig: 'useComments(id)',
    kind: 'Together',
    short: l('What is said of an entry', 'Lo que se dice de una entrada', '对条目的评论'),
    description: l(
      'What is said of an entry, each thread with its replies under it, and saying more.',
      'Lo que se dice de una entrada, cada hilo con sus respuestas debajo, y decir más.',
      '对某个条目的评论，每个讨论串下附有回复，以及发表新评论。',
    ),
    returns: [
      { key: 'comments', description: l('Each { id, by, text, replyTo, resolved }', 'Cada { id, by, text, replyTo, resolved }', '每项为 { id, by, text, replyTo, resolved }') },
      loading,
      { key: 'add, edit, resolve, remove', description: l('Saying, changing, closing, taking back', 'Decir, cambiar, cerrar, quitar', '发表、编辑、解决、删除') },
    ],
  },
  {
    name: 'useNotifications',
    sig: 'useNotifications()',
    kind: 'Together',
    short: l('What one was told', 'Lo que se le dijo a uno', '收到的通知'),
    description: l(
      'Shared with them, named in a comment, a file come through a request, one about to expire: the newest first, and how many are new.',
      'Compartido con ellos, nombrados en un comentario, un archivo llegado por una solicitud, uno por vencer: lo más nuevo primero, y cuántas son nuevas.',
      '与其共享、在评论中被提及、通过请求收到文件、文件即将到期：最新的在前，以及新通知的数量。',
    ),
    returns: [
      { key: 'notifications', description: l('Each { kind, name, by, at }', 'Cada { kind, name, by, at }', '每项为 { kind, name, by, at }') },
      { key: 'unseen', description: l('How many are new', 'Cuántas son nuevas', '新通知数量') },
      loading,
      { key: 'saw()', description: l('Say they were seen', 'Decir que se vieron', '标记为已读') },
    ],
  },
  {
    name: 'useRequests',
    sig: 'useRequests()',
    kind: 'Together',
    short: l('Requests for files made', 'Solicitudes de archivos hechas', '发出的文件请求'),
    description: l(
      'The requests for files one has made, each with its folder, its link and its token; and reminding whom one was sent to.',
      'Las solicitudes de archivos que uno ha hecho, cada una con su carpeta, su enlace y su token; y recordar a quien se envió.',
      '自己发出的文件请求，每个附带文件夹、链接和令牌；以及提醒收件人。',
    ),
    returns: [
      { key: 'requests', description: l('Each { folder, link, token }', 'Cada { folder, link, token }', '每项为 { folder, link, token }') },
      loading,
      { key: 'remind(folder, link)', description: l('Send a reminder now, by your server’s mail', 'Enviar un recordatorio ahora, por el correo de tu servidor', '立即通过服务器邮件发送提醒') },
    ],
  },
  {
    name: 'usePeople',
    sig: 'usePeople(query)',
    kind: 'Together',
    short: l('Who to share with', 'Con quién compartir', '可共享的人'),
    description: l(
      'Who matches what is typed, from your directory, as the server is given it. Nothing is asked for an empty query.',
      'Quién coincide con lo escrito, de tu directorio, tal como se le da al servidor. Una búsqueda vacía no pide nada.',
      '与输入内容匹配的人，来自你提供给服务器的目录。查询为空时不发出请求。',
    ),
    returns: [{ key: 'people', description: l('Each { id, name, detail }', 'Cada { id, name, detail }', '每项为 { id, name, detail }') }, loading],
  },
  {
    name: 'useExpiring',
    sig: 'useExpiring(days?)',
    kind: 'Records',
    short: l('About to expire', 'Por vencer', '即将到期'),
    description: l(
      'The files whose field expires comes within so many days (15 unless said), or passed: the soonest first. For documents that run out: a passport, a licence, an insurance.',
      'Los archivos cuyo campo expires llega en tantos días (15 si no se dice), o ya pasó: los más próximos primero. Para documentos que vencen: un pasaporte, una licencia, un seguro.',
      '字段 expires 在若干天内（默认 15 天）到期或已过期的文件，最近的在前。适用于会过期的文件：护照、执照、保险。',
    ),
    returns: [{ key: 'files', description: l('Each { entry, expires, days }', 'Cada { entry, expires, days }', '每项为 { entry, expires, days }') }, loading],
  },
  {
    name: 'useWithField',
    sig: 'useWithField(name, value)',
    kind: 'Records',
    short: l('The files of one record', 'Los archivos de un registro', '某条记录的文件'),
    description: l(
      'The entries with a field of this value, wherever they are: the files of one client, one property, one case of yours.',
      'Las entradas con un campo de este valor, estén donde estén: los archivos de un cliente, una propiedad, un caso tuyo.',
      '某字段等于此值的条目，无论在哪里：你某个客户、某处房产或某个案件的文件。',
    ),
    returns: [{ key: 'entries', description: l('The entries found', 'Las entradas encontradas', '找到的条目') }, loading],
  },
  {
    name: 'useSettings',
    sig: 'useSettings()',
    kind: 'Drive',
    short: l('Settings, the drive’s and one’s own', 'Ajustes, del drive y propios', '网盘设置和个人设置'),
    description: l(
      'The drive’s settings and the person’s own, for a panel of settings of yours.',
      'Los ajustes del drive y los de la persona, para un panel de ajustes tuyo.',
      '网盘的设置和个人设置，用于你自己的设置面板。',
    ),
    returns: [
      { key: 'drive, mine', description: l('The drive’s, and one’s own language and theme', 'Los del drive, y el idioma y tema propios', '网盘的设置，以及个人的语言和主题') },
      { key: 'canConfigure', description: l('Whether one may change the drive’s', 'Si uno puede cambiar los del drive', '是否可以修改网盘设置') },
      { key: 'save, saveMine', description: l('Saving each', 'Guardar cada uno', '分别保存') },
    ],
  },
  {
    name: 'useDrive',
    sig: 'useDrive()',
    kind: 'Drive',
    short: l('The provider itself', 'El propio provider', 'provider 本身'),
    description: l(
      'The client with every route of the server, a number that goes up after each change, and the drive’s words: for what has no hook of its own.',
      'El cliente con cada ruta del servidor, un número que sube tras cada cambio, y las palabras del drive: para lo que no tiene hook propio.',
      '包含服务器每条路由的客户端、每次变更后递增的数字，以及网盘的文字：用于没有专门 hook 的功能。',
    ),
    returns: [
      { key: 'client', description: l('Every route as a function', 'Cada ruta como una función', '以函数形式提供的每条路由') },
      { key: 'revision, changed()', description: l('When to ask again; telling every hook to', 'Cuándo pedir de nuevo; avisar a todos los hooks', '何时重新获取；通知所有 hooks') },
      { key: 't, locale, language', description: l('The drive’s words, in the language shown', 'Las palabras del drive, en el idioma mostrado', '网盘的文字，使用当前显示的语言') },
    ],
  },
];

/** The address of a hook's tab, for ⌘K and shared links. */
export const hookHash = (name: string) => `hooks-${name}`;
