'use client';

import { formatSize, useEntries } from '@rebofiles/react';

export default function Folder({ folder, onOpen }: { folder: string | null; onOpen: (folder: string | null) => void }) {
  const { entries, path, loading } = useEntries({ section: 'files', folder });
  return (
    <div aria-busy={loading}>
      <nav className="text-sm">
        <button type="button" onClick={() => onOpen(null)}>
          My files
        </button>
        {path.map((step) => (
          <button key={step.id} type="button" onClick={() => onOpen(step.id)}>
            › {step.name}
          </button>
        ))}
      </nav>
      <ul>
        {entries.map((entry) =>
          entry.kind === 'folder' ? (
            <li key={entry.id}>
              <button type="button" onClick={() => onOpen(entry.id)}>
                📁 {entry.name}
              </button>
            </li>
          ) : (
            <li key={entry.id}>
              {entry.name} · {formatSize(entry.versions[0].size, 'en')}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
