'use client';

import { formatSize, useDrive } from '@rebofiles/react';
import { useEffect, useState } from 'react';

export default function Space() {
  const { client, revision, t, locale } = useDrive();
  const [usage, setUsage] = useState<{ used: number; quota: number | null } | null>(null);
  // Asked again after every change: `revision` goes up with each.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is when to ask again, not what is asked
  useEffect(() => void client.usage().then(setUsage), [client, revision]);
  if (!usage) return null;
  const used = formatSize(usage.used, locale);
  return <p>{usage.quota ? t('usedOf', { used, quota: formatSize(usage.quota, locale) }) : t('used', { used })}</p>;
}
