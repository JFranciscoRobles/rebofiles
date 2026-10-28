'use client';

import { useRequests } from '@rebofiles/react';

export default function Requests() {
  const { requests, remind } = useRequests();
  return (
    <ul>
      {requests.map(({ folder, link }) => (
        <li key={link.id}>
          Files asked into <b>{folder.name}</b>, until {link.expires.slice(0, 10)}
          <button type="button" onClick={() => remind(folder.id, link.id)}>
            Remind
          </button>
        </li>
      ))}
      {!requests.length && <li>No requests for files.</li>}
    </ul>
  );
}
