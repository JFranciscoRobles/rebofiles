// The drive against the bucket of `.env`: the same <FileDrive> as the
// playground, with Word documents previewed and shown in their pages in the
// viewer. What is uploaded here goes straight from the page to the bucket,
// the smaller copies of a picture too.
// `?lang=es` shows it in Spanish, `?view=grid` starts with the grid; without
// them, the drive's settings say.

import { DriveProvider, FileDrive } from '@rebofiles/react';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(location.search);
const lang = params.get('lang');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DriveProvider base="/api/files" language={lang === 'es' || lang === 'en' ? lang : undefined}>
      <FileDrive
        title="Bucket"
        defaultView={params.get('view') === 'grid' ? 'grid' : 'list'}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        thumbDocument={thumbDocx}
        textDocument={textOfDocx}
        pictureDocument={pictureOfDocx}
      />
    </DriveProvider>
  </StrictMode>,
);
