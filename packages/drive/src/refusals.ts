// What the server refused, said in the language of the drive. The server says
// it in English, with the names and the numbers of the case; in another
// language the drive says it by its code, without them. A code of the
// application's own (a `Refused` of its `beforeUpload`, say) is said as the
// server said it: only the application knows its words.

import { RequestError } from './client';

type Said = Record<string, string>;

const es: Said = {
  'signed-out': 'Inicia sesión primero.',
  forbidden: 'No puedes hacer eso aquí.',
  'not-found': 'Eso ya no está.',
  'name-taken': 'Ya hay algo con ese nombre aquí.',
  'invalid-name': 'Ese nombre no se puede usar.',
  'into-itself': 'Una carpeta no puede ir dentro de sí misma.',
  'in-trash': 'Eso está en la papelera.',
  'not-in-trash': 'Eso no está en la papelera.',
  'not-a-folder': 'Eso no es una carpeta.',
  'not-a-file': 'Eso no es un archivo.',
  'no-version': 'Esa versión ya no está.',
  'invalid-share': 'No se puede compartir así.',
  'invalid-settings': 'Esos ajustes no son válidos.',
  'invalid-color': 'Ese color no es uno de la carpeta.',
  'invalid-field': 'Ese campo no es válido.',
  'too-large': 'Es demasiado grande.',
  'over-quota': 'No queda espacio para él.',
  'upload-refused': 'Ese archivo no se puede subir aquí.',
  'cannot-copy': 'Este almacenamiento no copia un archivo tan grande.',
  'upload-gone': 'La subida ya no está: empiézala de nuevo.',
  'upload-finished': 'Esa subida ya terminó.',
  'bad-token': 'Esa subida no es tuya, o caducó.',
  'type-mismatch': 'El archivo no es lo que dice su nombre.',
  'type-refused': 'Aquí no se guardan archivos de ese tipo.',
  'program-refused': 'Aquí no se guardan programas.',
  'virus-found': 'El archivo tiene un virus y no se guardó.',
  'refused-content': 'El archivo se revisó y no se guardó.',
  'not-scanned': 'No se pudo revisar el archivo. Inténtalo de nuevo en un momento.',
  'not-inspected': 'No se pudo revisar el archivo. Inténtalo de nuevo en un momento.',
  'too-large-to-scan': 'Es demasiado grande para revisarlo.',
  'no-link': 'Este enlace ya no funciona.',
  'link-password': 'Este enlace pide su contraseña.',
  'link-password-wrong': 'Esa no es la contraseña.',
  'bad-days': 'Un enlace dura de un día a noventa.',
  'bad-password': 'Una contraseña de cuatro caracteres o más.',
  'too-many': 'Son demasiados a la vez.',
  'rate-limited': 'Demasiadas a la vez: inténtalo de nuevo en un momento.',
  'invalid-comment': 'Un comentario dice algo, de 5000 caracteres como mucho.',
  'no-comment': 'Ese comentario ya no está.',
  'on-hold': 'Está en retención: no se puede mandar a la papelera ni borrar.',
  retained: 'Aún no se puede borrar para siempre: se conserva unos días más.',
  server: 'Algo salió mal en el servidor.',
};

const zh: Said = {
  'signed-out': '请先登录。',
  forbidden: '你无权在此执行该操作。',
  'not-found': '它已经不在了。',
  'name-taken': '这里已有同名项目。',
  'invalid-name': '不能使用这个名称。',
  'into-itself': '文件夹不能移到自身之中。',
  'in-trash': '它在回收站中。',
  'not-in-trash': '它不在回收站中。',
  'not-a-folder': '这不是文件夹。',
  'not-a-file': '这不是文件。',
  'no-version': '该版本已不存在。',
  'invalid-share': '无法这样共享。',
  'invalid-settings': '这些设置无效。',
  'invalid-color': '这不是文件夹可用的颜色。',
  'invalid-field': '该字段无效。',
  'too-large': '文件太大。',
  'over-quota': '空间不足。',
  'upload-refused': '不能在此上传该文件。',
  'cannot-copy': '此存储无法复制这么大的文件。',
  'upload-gone': '上传已不存在：请重新开始。',
  'upload-finished': '该上传已完成。',
  'bad-token': '该上传不属于你，或已过期。',
  'type-mismatch': '文件内容与其名称不符。',
  'type-refused': '这里不保存此类文件。',
  'program-refused': '这里不保存程序。',
  'virus-found': '文件含有病毒，未被保存。',
  'refused-content': '文件经检查后未被保存。',
  'not-scanned': '无法检查该文件，请稍后再试。',
  'not-inspected': '无法检查该文件，请稍后再试。',
  'too-large-to-scan': '文件太大，无法检查。',
  'no-link': '此链接已失效。',
  'link-password': '此链接需要密码。',
  'link-password-wrong': '密码不正确。',
  'bad-days': '链接有效期为一到九十天。',
  'bad-password': '密码至少四个字符。',
  'too-many': '一次太多了。',
  'rate-limited': '请求过于频繁，请稍后再试。',
  'invalid-comment': '评论需要有内容，最多 5000 个字符。',
  'no-comment': '该评论已不存在。',
  'on-hold': '处于保留状态：不能移入回收站或删除。',
  retained: '暂时不能永久删除：还需保留一段时间。',
  server: '服务器出错了。',
};

const REFUSALS: Record<'es' | 'zh', Said> = { es, zh };

/** The codes said in each language, for a test, or for one who adds another. */
export const REFUSAL_CODES = Object.keys(es);

/** What went wrong, as a person of `language` reads it: what the server said, in English; by its code, in another. */
export function refusalText(error: unknown, language: 'en' | 'es' | 'zh'): string {
  const said = error instanceof Error ? error.message : String(error);
  if (language === 'en' || !(error instanceof RequestError)) return said;
  return REFUSALS[language][error.code] ?? said;
}
