'use client';

import { formatDate, useEntry } from '@rebofiles/react';

export default function Details({ id }: { id: string }) {
  const found = useEntry(id);
  if (!found) return <p>Loading…</p>;
  const { entry, path, trashed } = found;
  return (
    <div>
      <h4>{entry.name}</h4>
      <p>
        {path.map((folder) => folder.name).join(' / ') || 'My files'}
        {trashed && ' · in the trash'}
      </p>
      <p>
        By {entry.owner}, {formatDate(entry.modified, 'en')}
      </p>
    </div>
  );
}
