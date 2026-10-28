'use client';

import { formatDate, useNotifications } from '@rebofiles/react';

export default function Bell() {
  const { notifications, unseen, saw } = useNotifications();
  return (
    <div>
      <button type="button" onClick={saw} disabled={!unseen}>
        🔔 {unseen ? `${unseen} new` : 'Nothing new'}
      </button>
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            {n.kind === 'shared' ? `${n.by} shared “${n.name}” with you` : n.kind === 'mentioned' ? `${n.by} named you on “${n.name}”` : `“${n.name}” came in`}
            {' · '}
            {formatDate(n.at, 'en')}
          </li>
        ))}
      </ul>
    </div>
  );
}
