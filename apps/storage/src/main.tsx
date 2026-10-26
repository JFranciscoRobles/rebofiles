// The drive against the bucket of `.env`: the same <FileDrive> as the
// playground, with Word documents previewed. What is uploaded here goes
// straight from the page to the bucket.
// `?lang=es` shows it in Spanish, `?view=grid` starts with the grid.

import { DriveProvider, FileDrive } from '@rebofiles/react';
import { previewDocx } from '@rebofiles/react/rebodocs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(location.search);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DriveProvider base="/api/files" language={params.get('lang') === 'es' ? 'es' : 'en'}>
      <FileDrive title="Bucket" defaultView={params.get('view') === 'grid' ? 'grid' : 'list'} previewDocument={previewDocx} />
    </DriveProvider>
  </StrictMode>,
);
