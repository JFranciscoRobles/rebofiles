// Word documents from start to end in the drive, all of them Rebodocs':
// Upload → New document makes an empty one in the folder
// one is in and opens it in Rebodocs' editor, where whoever else opens it
// writes with them at once; each save is a new version, as everybody leaving
// is, and "PDF" downloads it as one. A double click shows a document in its pages, in the viewer, read only, with "Open in
// Rebodocs" to write in it again; the grid shows each one's first page.
// "Compare" in a document's history shows what changed from a version.
// `?lang=es` (or `zh`) shows it in Spanish, `?as=bea` as Bea sees it. A link
// of the drive comes here as `?link=…`: what it reads, or, of a request for
// files, where to send them.

import type { FileEntry } from '@rebofiles/core';
import { DriveProvider, FileDrive, SharedLink } from '@rebofiles/react';
import { compareDocx, newDocx, pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The editor is large: loaded the first time a document is opened, not with the drive.
const Editor = lazy(() => import('./Editor'));

const params = new URLSearchParams(location.search);
const language = (['en', 'es', 'zh'] as const).find((one) => one === params.get('lang'));
const as = params.get('as');
const link = params.get('link');
const headers = (): Record<string, string> => (as ? { 'x-user': as } : {});

function Documents() {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  return (
    <DriveProvider base="/api/files" language={language} headers={headers}>
      <FileDrive
        title={{ en: 'Documents', es: 'Documentos', zh: '文档' }[language ?? 'en']}
        defaultView={params.get('view') === 'list' ? 'list' : 'grid'}
        newDocument={newDocx}
        compareDocument={compareDocx}
        fields="edit"
        viewDocument={viewDocx}
        previewDocument={previewDocx}
        thumbDocument={thumbDocx}
        pictureDocument={pictureOfDocx}
        textDocument={textOfDocx}
        onOpenDocument={(file, url) => setOpen({ file, url })}
      />
      {open && (
        <Suspense fallback={null}>
          <Editor file={open.file} url={open.url} language={language ?? 'en'} headers={headers} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </DriveProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode>{link ? <SharedLink base="/api/files" token={link} language={language} /> : <Documents />}</StrictMode>);
