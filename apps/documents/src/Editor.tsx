// A document of the drive open in Rebodocs, over the drive: one just made by
// "Create document" or one opened from the viewer. Saving sends it back as a
// new version of the same file, so the drive keeps every save.

import type { FileEntry } from '@rebofiles/core';
import { useActions } from '@rebofiles/react';
import { DocsEditor } from '@rebodocs/react';
import { useEffect, useState } from 'react';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function Editor({ file, url, language, onClose }: { file: FileEntry; url: string; language: 'en' | 'es' | 'zh'; onClose: () => void }) {
  const { upload } = useActions();
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [said, setSaid] = useState('');

  useEffect(() => {
    let live = true;
    fetch(url)
      .then((answer) => answer.arrayBuffer())
      .then((read) => live && setBytes(new Uint8Array(read)));
    return () => {
      live = false;
    };
  }, [url]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && event.target === document.body && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const save = async (docx: Uint8Array) => {
    setSaid({ en: 'Saving…', es: 'Guardando…', zh: '正在保存…' }[language]);
    await upload(new File([docx as BlobPart], file.name, { type: DOCX }), { file: file.id });
    setSaid({ en: 'Saved as a new version', es: 'Guardado como versión nueva', zh: '已保存为新版本' }[language]);
  };

  return (
    <div role="dialog" aria-label={file.name} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #eae8e3', font: '14px Inter, system-ui, sans-serif' }}>
        <strong style={{ flex: 1 }}>{file.name}</strong>
        <span style={{ color: '#6b6964' }}>{said}</span>
        <button type="button" onClick={onClose} style={{ font: 'inherit', padding: '8px 14px', borderRadius: 10, border: '1px solid #dddad3', background: '#fff', cursor: 'pointer' }}>
          {{ en: 'Back to the drive', es: 'Volver al drive', zh: '返回网盘' }[language]}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{bytes && <DocsEditor docx={bytes} name={file.name} locale={language} onSave={save} />}</div>
    </div>
  );
}
