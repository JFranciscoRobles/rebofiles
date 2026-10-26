// The drive of the landing: Acme's files, kept in the page, with Word
// documents previewed and opened in Rebodocs, and Claude renaming a contract
// through MCP a few seconds in. The landing puts this in its frame; `main.tsx`
// shows it alone.

import { rename } from '@rebofiles/core';
import type { FileEntry } from '@rebofiles/core';
import { DriveProvider, FileDrive, type MemoryClient, createMemoryClient, useDrive } from '@rebofiles/react';
import { previewDocx } from '@rebofiles/react/rebodocs';
import { Suspense, lazy, useEffect, useState } from 'react';
import { CONTRACT, YOU, seed } from './seed';

const Editor = lazy(() => import('./Editor'));

export interface DemoDriveProps {
  defaultView?: 'list' | 'grid';
  /** Claude renames a contract three seconds in, and says so in a card. */
  claudeActivity?: boolean;
  language?: 'en' | 'es';
}

export function DemoDrive({ defaultView = 'list', claudeActivity = true, language = 'en' }: DemoDriveProps) {
  const [client, setClient] = useState<MemoryClient | null>(null);
  useEffect(() => {
    let live = true;
    seed().then(({ drive, blobs }) => live && setClient(createMemoryClient({ drive, blobs, user: YOU, label: 's3://acme-files', top: 'everyone' })));
    return () => {
      live = false;
    };
  }, []);
  if (!client) return <div style={{ height: '100%', background: '#fff', borderRadius: 14, border: '1px solid #eae8e3' }} />;
  return (
    <DriveProvider client={client} language={language}>
      <Demo client={client} defaultView={defaultView} claudeActivity={claudeActivity} language={language} />
    </DriveProvider>
  );
}

function Demo({ client, defaultView, claudeActivity, language }: Required<DemoDriveProps> & { client: MemoryClient }) {
  const [open, setOpen] = useState<{ file: FileEntry; url: string } | null>(null);
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <FileDrive title="Acme Files" defaultView={defaultView} previewDocument={previewDocx} onOpenDocument={(file, url) => setOpen({ file, url })} />
      {claudeActivity && <Claude client={client} language={language} />}
      {open && (
        <Suspense fallback={null}>
          <Editor file={open.file} url={open.url} language={language} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </div>
  );
}

const SAID = {
  en: 'Renamed contract-final(2).docx → contract-northwind.docx, per the client on page 1.',
  es: 'Cambió el nombre de contract-final(2).docx a contract-northwind.docx, por el cliente de la página 1.',
};

/** What an assistant does through MCP, as the drive sees it: a change by someone else, and a card that says what. */
function Claude({ client, language }: { client: MemoryClient; language: 'en' | 'es' }) {
  const { changed } = useDrive();
  const [said, setSaid] = useState('');
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        client.apply((drive, context) => rename(drive, CONTRACT, 'contract-northwind.docx', context), 'Claude');
        changed();
        setSaid(SAID[language]);
      } catch {
        // Renamed or moved by the person meanwhile: Claude leaves it as it is.
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [client, changed, language]);
  if (!said || closed) return null;
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        right: -12,
        bottom: -22,
        zIndex: 7,
        width: 280,
        padding: '12px 14px',
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 16px 36px rgba(47,46,43,.14)',
        font: '14px/1.45 Inter, system-ui, sans-serif',
        color: '#2f2e2b',
        animation: 'rf-pop .5s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#fcebdd', color: '#a4521c', fontWeight: 700 }}>C</span>
        <span style={{ flex: 1 }}>Claude · via MCP</span>
        <button
          type="button"
          aria-label={language === 'es' ? 'Cerrar' : 'Close'}
          onClick={() => setClosed(true)}
          style={{ border: 0, background: 'none', cursor: 'pointer', color: '#9b9890', fontSize: 18, lineHeight: 1, padding: 4, borderRadius: 6 }}
        >
          ×
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#4a4843' }}>{said}</div>
    </div>
  );
}
