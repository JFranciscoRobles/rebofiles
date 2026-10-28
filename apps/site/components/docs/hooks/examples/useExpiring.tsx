'use client';

import { useExpiring } from '@rebofiles/react';

export default function Expiring({ days }: { days: number }) {
  const { files } = useExpiring(days);
  return (
    <ul>
      {files.map(({ entry, days: left }) => (
        <li key={entry.id} style={{ color: left < 0 ? 'crimson' : left <= 7 ? 'darkorange' : undefined }}>
          {entry.name}: {left < 0 ? `expired ${-left} days ago` : left === 0 ? 'expires today' : `${left} days left`}
        </li>
      ))}
      {!files.length && <li>Nothing expires within {days} days.</li>}
    </ul>
  );
}
