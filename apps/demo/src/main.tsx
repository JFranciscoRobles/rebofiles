// The demo alone, in a frame like the landing's. `?lang=es`, `?view=grid`,
// `?claude=0` to leave Claude out.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoDrive } from './DemoDrive';

const params = new URLSearchParams(location.search);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ maxWidth: 1180, margin: '24px auto', padding: 14, borderRadius: 24, background: '#f7f6f3', border: '1px solid #eae8e3' }}>
      <div style={{ height: 600 }}>
        <DemoDrive
          language={params.get('lang') === 'es' ? 'es' : params.get('lang') === 'zh' ? 'zh' : 'en'}
          defaultView={params.get('view') === 'grid' ? 'grid' : 'list'}
          claudeActivity={params.get('claude') !== '0'}
        />
      </div>
    </div>
  </StrictMode>,
);
