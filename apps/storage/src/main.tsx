// The drive against the bucket of `.env`, with everything it does: the same
// <FileDrive> as the playground, Word documents made, previewed, shown in their
// pages, compared between versions and opened in Rebodocs, each save a new
// version; and fields of one's own on each file. What is uploaded goes
// straight from the page to the bucket.
// `?lang=es` (or `zh`) shows it in Spanish, `?view=grid` starts with the grid,
// `?theme=dark` (or `auto`) shows it dark; without them, the drive's settings
// say. `?as=bea` is the drive as Bea sees it, to share with her and look; Bea
// and Carl are in `group:team`. A link of the drive comes here as `?link=…`,
// and shows only what it reads, its password asked first when it has one.

import type { FileEntry } from '@rebofiles/core';
import { DriveProvider, FileDrive, SharedLink } from '@rebofiles/react';
import { compareDocx, newDocx, pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The editor is large: loaded the first time a document is opened, not with the drive.
const Editor = lazy(() => import('./Editor'));

const params = new URLSearchParams(location.search);
const language = (['en', 'es', 'zh'] as const).find((one) => one === params.get('lang'));
const theme = (['light', 'dark', 'auto'].includes(params.get('theme') ?? '') ? params.get('theme') : undefined) as 'light' | 'dark' | 'auto' | undefined;
const as = params.get('as');
const link = params.get('link');
const headers = (): Record<string, string> => (as ? { 'x-user': as } : {});

function Bucket() {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  return (
    <DriveProvider base="/api/files" language={language} headers={headers}>
      <FileDrive
        title={as ? `Bucket · ${as}` : 'Bucket'}
        theme={theme}
        defaultView={params.get('view') === 'grid' ? 'grid' : 'list'}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        newDocument={newDocx}
        compareDocument={compareDocx}
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

createRoot(document.getElementById('root')!).render(<StrictMode>{link ? <SharedLink base="/api/files" token={link} language={language} theme={theme} /> : <Bucket />}</StrictMode>);
