'use client';

import { usePeople } from '@rebofiles/react';

export default function Who({ query, onPick }: { query: string; onPick: (id: string) => void }) {
  const { people, loading } = usePeople(query);
  return (
    <ul aria-busy={loading}>
      {people.map((person) => (
        <li key={person.id}>
          <button type="button" onClick={() => onPick(person.id)}>
            {person.name} {person.detail && <small>{person.detail}</small>}
          </button>
        </li>
      ))}
    </ul>
  );
}
