// A document of the drive open in Rebodocs, over the drive: one just made by
// Upload → New document, or one opened from the viewer. It is a room of the
// collaboration server, so whoever else opens it writes in it at once, each
// with a caret of their own; who may only read it watches. ⌘S keeps it as a
// new version, as everybody leaving does. "PDF" downloads it as one.

import type { FileEntry } from '@rebofiles/core';
import { useActions } from '@rebofiles/react';
import { DocsEditor, type DocsHandle } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Language = 'en' | 'es' | 'zh';
const TEXTS = {
  saving: { en: 'Saving…', es: 'Guardando…', zh: '正在保存…' },
  saved: { en: 'Saved as a new version', es: 'Guardado como versión nueva', zh: '已保存为新版本' },
  watching: { en: 'Only reading: you may not edit it', es: 'Solo lectura: no puedes editarlo', zh: '只读：你不能编辑' },
  back: { en: 'Back to the drive', es: 'Volver al drive', zh: '返回网盘' },
  pdf: { en: 'Download as PDF', es: 'Descargar como PDF', zh: '下载为 PDF' },
};

interface Ticket {
  ticket: string;
  readOnly: boolean;
  name: string;
}

export default function Editor({ file, language, headers, onClose }: { file: FileEntry; url: string; language: Language; headers: () => Record<string, string>; onClose: () => void }) {
  const { upload } = useActions();
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [said, setSaid] = useState('');

  // What lets this person into the document's room, and whether they only watch.
  useEffect(() => {
    let live = true;
    fetch(`/api/collab/ticket?file=${encodeURIComponent(file.id)}`, { headers: headers() })
      .then((answer) => answer.json() as Promise<Ticket>)
      .then((given) => live && setTicket(given));
    return () => {
      live = false;
    };
  }, [file.id, headers]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && event.target === document.body && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const save = async (docx: Uint8Array) => {
    if (ticket?.readOnly) return;
    setSaid(TEXTS.saving[language]);
    await upload(new File([docx as BlobPart], file.name, { type: DOCX }), { file: file.id });
    setSaid(TEXTS.saved[language]);
  };
  const pdf = async () => {
    const editor = handle.current?.editor;
    if (!editor) return;
    const bytes = await editor.exportPdf(file.name.replace(/\.docx$/i, ''));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    link.download = `${file.name.replace(/\.docx$/i, '')}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  };

  const button = { font: 'inherit', padding: '8px 14px', borderRadius: 10, border: '1px solid #dddad3', background: '#fff', cursor: 'pointer' } as const;
  return (
    <div role="dialog" aria-label={file.name} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #eae8e3', font: '14px Inter, system-ui, sans-serif' }}>
        <strong style={{ flex: 1 }}>{file.name}</strong>
        <span style={{ color: '#6b6964' }}>{ticket?.readOnly ? TEXTS.watching[language] : said}</span>
        <button type="button" onClick={() => void pdf()} style={button}>
          {TEXTS.pdf[language]}
        </button>
        <button type="button" onClick={onClose} style={button}>
          {TEXTS.back[language]}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {ticket && <DocsEditor ref={handle} name={file.name} author={ticket.name} locale={language} collab={{ url: location.origin, room: file.id, ticket: ticket.ticket }} onSave={save} />}
      </div>
    </div>
  );
}
