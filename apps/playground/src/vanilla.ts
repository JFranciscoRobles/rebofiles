// The playground without a framework: the drive of @rebofiles/drive mounted
// on an element, against the same backend, and no React in the page.
// `?as=bea`, `?lang=es` and `?theme=dark` as on the other page.

import { mountDrive } from '@rebofiles/drive';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/drive/rebodocs';

const params = new URLSearchParams(location.search);
const as = params.get('as');
const theme = (['dark', 'auto'].includes(params.get('theme') ?? '') ? params.get('theme') : 'light') as 'light' | 'dark' | 'auto';
document.body.dataset.theme = theme;

mountDrive(document.getElementById('root')!, {
  base: '/api/files',
  headers: (): Record<string, string> => (as ? { 'x-user': as } : {}),
  language: params.get('lang') === 'es' ? 'es' : 'en',
  title: as ? `Without a framework · ${as}` : 'Without a framework',
  theme,
  previewDocument: previewDocx,
  viewDocument: viewDocx,
  thumbDocument: thumbDocx,
  textDocument: textOfDocx,
  pictureDocument: pictureOfDocx,
});
