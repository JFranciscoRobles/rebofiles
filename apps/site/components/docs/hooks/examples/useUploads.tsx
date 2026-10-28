'use client';

import { formatDuration, formatSize, useUploads } from '@rebofiles/react';

/** The queue is the hook's: one call of it, given to what shows it, so that everything shown is of the same files. */
export function UploadsPanel({ queue, folder }: { queue: ReturnType<typeof useUploads>; folder: string | null }) {
  const { uploads, summary, upload, stop, retry, clear } = queue;
  const send = () => upload([new File([new Uint8Array(24 * 1024 * 1024)], `scan-${uploads.length + 1}.pdf`, { type: 'application/pdf' })], folder);
  return (
    <div>
      <button type="button" onClick={send}>
        Upload a scan of 24 MB
      </button>
      <button type="button" onClick={clear}>
        Clear
      </button>
      <ul>
        {uploads.map((u) => (
          <li key={u.id}>
            {u.name} · {formatSize(u.sent, 'en')} of {formatSize(u.size, 'en')} · {u.state}
            {u.state === 'sending' && (
              <button type="button" onClick={() => stop(u.id)}>
                Stop
              </button>
            )}
            {u.state === 'stopped' && (
              <button type="button" onClick={() => retry(u.id)}>
                Try again
              </button>
            )}
          </li>
        ))}
      </ul>
      {summary.remaining !== undefined && <p>{formatDuration(summary.remaining, 'en')} left</p>}
    </div>
  );
}

export default function Uploads({ folder }: { folder: string | null }) {
  const queue = useUploads();
  return <UploadsPanel queue={queue} folder={folder} />;
}
