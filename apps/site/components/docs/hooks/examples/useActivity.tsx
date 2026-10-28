'use client';

import { formatDate, useActivity } from '@rebofiles/react';

export default function History({ id }: { id: string }) {
  const { activity } = useActivity(id, 10);
  return (
    <ol>
      {activity.map((done, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: what was done has no id, and two things may be done in the same millisecond: counted from the oldest, as the newest come first
        <li key={`${done.at}-${activity.length - i}`}>
          {done.by} {done.action} “{done.name}” · {formatDate(done.at, 'en')}
        </li>
      ))}
    </ol>
  );
}
