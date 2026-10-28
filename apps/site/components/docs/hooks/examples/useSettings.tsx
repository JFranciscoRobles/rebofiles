'use client';

import { useSettings } from '@rebofiles/react';

export default function Preferences() {
  const { mine, drive, canConfigure, saveMine, save } = useSettings();
  if (!mine || !drive) return null;
  return (
    <div>
      <label>
        Language{' '}
        <select value={mine.language ?? drive.language} onChange={(e) => saveMine({ ...mine, language: e.target.value as 'en' | 'es' | 'zh' })}>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="zh">中文</option>
        </select>
      </label>
      {canConfigure && (
        <label>
          Trash kept for{' '}
          <select value={drive.trashDays ?? 0} onChange={(e) => save({ trashDays: Number(e.target.value) || null })}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={0}>ever</option>
          </select>
        </label>
      )}
    </div>
  );
}
