// The playground: the whole drive, against the backend of `server/dev.ts`,
// with Word documents previewed and opened in Rebodocs. Saving in the editor
// keeps a new version of the file in the drive.
// `?lang=es` shows it in Spanish, `?view=grid` starts with the grid.

import type { FileEntry } from '@rebofiles/core';
import { DriveProvider, FileDrive } from '@rebofiles/react';
import { previewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The editor is large: loaded the first time a document is opened, not with the drive.
const Editor = lazy(() => import('./Editor'));

const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'es' ? 'es' : 'en';

function Playground() {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  return (
    <DriveProvider base="/api/files" language={language}>
      <FileDrive title="Playground" defaultView={params.get('view') === 'grid' ? 'grid' : 'list'} previewDocument={previewDocx} onOpenDocument={(file, url) => setOpen({ file, url })} />
      {open && (
        <Suspense fallback={null}>
          <Editor file={open.file} url={open.url} language={language} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </DriveProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
