// The playground: the whole drive, against the backend of `server/dev.ts`,
// with Word documents previewed and opened in Rebodocs. Saving in the editor
// keeps a new version of the file in the drive.
// `?lang=es` shows it in Spanish, `?view=grid` starts with the grid.
// `?theme=dark` (or `auto`) shows it dark.
// `?as=bea` is the drive as Bea sees it, to share with her and look; a link
// of the drive comes here as `?link=…`, and shows what it reads.
// `?retries=0` gives up a cut upload at once, for its "Try again" to be seen.

import type { FileEntry } from '@rebofiles/core';
import { DriveProvider, FileDrive, SharedLink, createDriveClient } from '@rebofiles/react';
import { newDocx, pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The editor is large: loaded the first time a document is opened, not with the drive.
const Editor = lazy(() => import('./Editor'));

const params = new URLSearchParams(location.search);
const language = (['en', 'es', 'zh'] as const).find((one) => one === params.get('lang'));
const as = params.get('as');
// Unless given, the drive's settings say it.
const theme = (['light', 'dark', 'auto'].includes(params.get('theme') ?? '') ? params.get('theme') : undefined) as 'light' | 'dark' | 'auto' | undefined;
const link = params.get('link');
const headers = (): Record<string, string> => (as ? { 'x-user': as } : {});
const retries = params.get('retries');
const client = retries === null ? undefined : createDriveClient({ base: '/api/files', headers, retry: { attempts: Number(retries), delay: 200 } });

function Playground() {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  return (
    <DriveProvider base="/api/files" client={client} language={language} headers={headers}>
      <FileDrive
        theme={theme}
        title={as ? `Playground · ${as}` : 'Playground'}
        defaultView={params.get('view') === 'grid' ? 'grid' : 'list'}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        newDocument={newDocx}
        fields="edit"
        thumbDocument={thumbDocx}
        textDocument={textOfDocx}
        pictureDocument={pictureOfDocx}
        onOpenDocument={(file, url) => setOpen({ file, url })}
      />
      {open && (
        <Suspense fallback={null}>
          <Editor file={open.file} url={open.url} language={language ?? 'en'} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </DriveProvider>
  );
}

// The page behind the drive goes with it (index.html).
document.body.dataset.theme = theme ?? 'light';

createRoot(document.getElementById('root')!).render(<StrictMode>{link ? <SharedLink token={link} language={language} theme={theme} /> : <Playground />}</StrictMode>);
