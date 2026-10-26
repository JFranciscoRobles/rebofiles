// The drive of the landing: Acme's files, kept in the page, with Word
// documents previewed and opened in Rebodocs, and Claude renaming a contract
// through MCP a few seconds in: the calls an assistant makes, answered by the
// tools of @rebofiles/mcp and Rebodocs' as on a server, over the drive in the
// page. The landing puts this in its frame; `main.tsx` shows it alone.

import type { FileEntry } from '@rebofiles/core';
import { answer, driveAt } from '@rebofiles/mcp';
import { DriveProvider, FileDrive, type MemoryClient, createMemoryClient, useDrive } from '@rebofiles/react';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';
import { Suspense, lazy, useEffect, useState } from 'react';
import { BASE, routesOver } from './routes';
import { YOU, seed } from './seed';

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
      <FileDrive
        title="Acme Files"
        defaultView={defaultView}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        thumbDocument={thumbDocx}
        textDocument={textOfDocx}
        pictureDocument={pictureOfDocx}
        onOpenDocument={(file, url) => setOpen({ file, url })}
      />
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
  en: (to: string) => `Renamed to ${to}, after the client on page 1.`,
  es: (to: string) => `Le cambió el nombre a ${to}, por el cliente de la página 1.`,
};

type Step = { tool: string; said: string };

/**
 * An assistant at work, as the drive sees it: the messages Claude would send to the MCP server, each answered by the
 * real tools over the drive in the page, as Claude. Its thinking is scripted; what it asks and is told is not.
 */
function Claude({ client, language }: { client: MemoryClient; language: 'en' | 'es' }) {
  const { changed } = useDrive();
  const [steps, setSteps] = useState<Step[]>([]);
  const [said, setSaid] = useState('');
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let live = true;
    const drive = driveAt({ base: BASE, fetch: routesOver(client, 'Claude') });
    let id = 0;
    const call = async (name: string, args: Record<string, unknown>) => {
      const answered = await answer({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }, drive);
      const result = answered?.result as { content: { text: string }[]; structuredContent: Record<string, unknown>; isError: boolean } | undefined;
      if (!result || result.isError) throw new Error(result?.content[0].text ?? 'No answer.');
      return result;
    };
    const step = (tool: string, text: string) => live && setSteps((all) => [...all, { tool, said: text }]);
    const work = async () => {
      const found = (await call('search', { query: 'contract final' })).structuredContent.entries as { id: string; name: string }[];
      const contract = found.find((entry) => entry.name.endsWith('.docx'));
      if (!contract || !live) return;
      step('search', contract.name);
      const read = (await call('read_document', { document: contract.id })).content[0].text;
      const party = /between .+? and ([^\s,.]+(?: [A-Z][\w.]*)*)/.exec(read)?.[1];
      if (!party || !live) return;
      step('read_document', party);
      const name = `contract-${party.split(' ')[0].toLowerCase()}.docx`;
      await call('rename', { id: contract.id, name });
      changed();
      step('rename', name);
      if (live) setSaid(SAID[language](name));
    };
    const timer = setTimeout(() => {
      // Renamed, moved or trashed by the person meanwhile: Claude leaves it as it is.
      work().catch(() => undefined);
    }, 3000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, changed, language]);
  if (!steps.length || closed) return null;
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
      <ol aria-label={language === 'es' ? 'Herramientas usadas' : 'Tools used'} style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
        {steps.map((s) => (
          <li key={s.tool} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6b6963' }}>
            <code style={{ font: '500 11.5px ui-monospace, SFMono-Regular, Menlo, monospace', color: '#a4521c' }}>{s.tool}</code>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.said}</span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 6, fontSize: 13, color: '#4a4843' }}>{said}</div>
    </div>
  );
}
