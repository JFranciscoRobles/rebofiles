'use client';

import { useWithField } from '@rebofiles/react';

export default function Record({ client }: { client: string }) {
  const { entries } = useWithField('client', client);
  return (
    <div>
      <h4>Files of {client}</h4>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>{entry.name}</li>
        ))}
      </ul>
    </div>
  );
}
