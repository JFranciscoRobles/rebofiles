'use client';

import { useTextSearch } from '@rebofiles/react';

export default function Found({ query }: { query: string }) {
  const { results, loading } = useTextSearch(query);
  if (!query.trim()) return <p>Type a word written in a file.</p>;
  if (loading) return <p>Looking…</p>;
  return (
    <ul>
      {results.map(({ entry, snippet }) => (
        <li key={entry.id}>
          <strong>{entry.name}</strong>
          <p>…{snippet}…</p>
        </li>
      ))}
      {!results.length && <li>Nothing has it written.</li>}
    </ul>
  );
}
