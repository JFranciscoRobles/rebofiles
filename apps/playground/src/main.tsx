// The playground: the whole drive, against the backend of `server/dev.ts`,
// with Word documents previewed and opened in Rebodocs, and decks and
// workbooks drawn by ReboSlides and Rebosheets (`npm run link-engines` first). Saving in the editor
// keeps a new version of the file in the drive.
// `?lang=es` shows it in Spanish, `?view=grid` starts with the grid.
// `?theme=dark` (or `auto`) shows it dark.
// `?as=bea` is the drive as Bea sees it, to share with her and look; a link
// of the drive comes here as `?link=…`, and shows what it reads.
// `?retries=0` gives up a cut upload at once, for its "Try again" to be seen.
// `?chrome=0` is the drive without its own bar and sections, inside a bar of an
// application's (`chrome={false}`), driven by it and telling it where it is;
// `&root=<id>` keeps it in that folder, as the files of one record.

import type { FileEntry } from '@rebofiles/core';
import { type DriveControls, type DriveState, DriveProvider, FileDrive, type Section, SharedLink, createDriveClient } from '@rebofiles/react';
import { compareDocx, newDocx, pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { sheetsFormat } from '@rebofiles/react/rebosheets';
import { slidesFormat } from '@rebofiles/react/reboslides';
import { StrictMode, Suspense, lazy, useRef, useState } from 'react';
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

const bare = params.get('chrome') === '0';

/** The bar of an application around a drive without its own: its sections, its search, what to add, and where it is. */
function HostBar({ controls, state }: { controls: { current: DriveControls | null }; state: DriveState | null }) {
  const sections: [Section, string][] = [
    ['files', 'Files'],
    ['starred', 'Starred'],
    ['received', 'Received'],
    ['shared', 'Shared'],
    ['recent', 'Recent'],
    ['trash', 'Trash'],
  ];
  return (
    <section className="host-bar" aria-label="The application">
      <h1>{state?.path.at(-1)?.name ?? 'Files'}</h1>
      <nav aria-label="Sections">
        {sections.map(([id, label]) => (
          <button key={id} type="button" aria-current={state?.section === id ? 'page' : undefined} onClick={() => controls.current?.go(id)}>
            {label}
          </button>
        ))}
      </nav>
      <input type="search" aria-label="Search the files" onChange={(event) => controls.current?.search(event.target.value)} />
      <button type="button" onClick={() => controls.current?.newFolder()}>
        New folder
      </button>
      <button type="button" onClick={() => controls.current?.requestFiles()}>
        Request files here
      </button>
      <button type="button" onClick={() => controls.current?.share()}>
        Share
      </button>
      <output aria-label="Shown">{state ? `${state.count} shown` : ''}</output>
    </section>
  );
}

/** Decks and workbooks: their thumbnails and their viewers. */
const FORMATS = [slidesFormat, sheetsFormat];

function Playground() {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  const controls = useRef<DriveControls>(null);
  const [state, setState] = useState<DriveState | null>(null);
  return (
    <DriveProvider base="/api/files" client={client} language={language} headers={headers}>
      {bare && <HostBar controls={controls} state={state} />}
      <FileDrive
        chrome={!bare}
        root={params.get('root') ?? undefined}
        controls={controls}
        onState={bare ? setState : undefined}
        theme={theme}
        title={as ? `Playground · ${as}` : 'Playground'}
        defaultView={params.get('view') === 'grid' ? 'grid' : 'list'}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        newDocument={newDocx}
        compareDocument={compareDocx}
        fields="edit"
        thumbDocument={thumbDocx}
        textDocument={textOfDocx}
        pictureDocument={pictureOfDocx}
        formats={FORMATS}
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
