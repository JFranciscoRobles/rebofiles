// The settings of a drive read from what is given, and the smaller pictures
// of a version: kept, found for a size, brought back with it, and deleted with it.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DriveError,
  addRendition,
  deleteForever,
  getFile,
  moveToTrash,
  readDriveSettings,
  readPersonalSettings,
  renditionFor,
  restoreVersion,
  addVersion,
  settingsFor,
} from '../src';
import { ana, demoDrive, v } from './drive';

describe('the settings', () => {
  it('are the defaults where nothing is said, and what is said over what was', () => {
    expect(readDriveSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const first = readDriveSettings({ brand: '#ABCDEF', images: { sizes: [800, 100, 200, 400] } });
    expect(first.brand).toBe('#abcdef');
    expect(first.images.sizes).toEqual([100, 200, 400, 800]);
    expect(readDriveSettings({ language: 'es' }, first)).toMatchObject({ language: 'es', brand: '#abcdef', images: { sizes: [100, 200, 400, 800] } });
    expect(readDriveSettings({ brand: null }, first).brand).toBeNull();
  });

  it('refuse what cannot be', () => {
    for (const bad of [
      { language: 'fr' },
      { brand: 'red' },
      { images: { sizes: [1, 2, 3] } },
      { images: { sizes: [100, 100, 200, 300] } },
      { images: { quality: 2 } },
      { images: { format: 'gif' } },
      'x',
    ]) {
      expect(() => readDriveSettings(bad), JSON.stringify(bad)).toThrow(DriveError);
    }
  });

  it('are one’s own over the drive’s, with only what one may set', () => {
    const mine = readPersonalSettings({ theme: 'dark', brand: '#000000', language: null });
    expect(mine).toEqual({ theme: 'dark' });
    expect(settingsFor(DEFAULT_SETTINGS, mine)).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
  });
});

describe('the smaller pictures of a version', () => {
  const small = (size: number) => ({ size, width: size, height: size / 2, key: `logo@${size}`, type: 'image/jpeg', bytes: size });

  it('are kept in order of size, one for each, and found for a size', () => {
    let drive = demoDrive();
    const version = getFile(drive, 'logo').versions[0];
    for (const size of [480, 160, 1024, 160]) drive = addRendition(drive, 'logo', version.id, small(size));
    const kept = getFile(drive, 'logo').versions[0];
    expect(kept.renditions?.map((r) => r.size)).toEqual([160, 480, 1024]);
    expect(renditionFor(kept, 300)?.size).toBe(480);
    expect(renditionFor(kept, 2000)).toBeUndefined();
    // Not a change a person made: the file keeps when it was changed.
    expect(getFile(drive, 'logo').modified).toBe(getFile(demoDrive(), 'logo').modified);
  });

  it('come back with the version, and go with the file', () => {
    let drive = demoDrive();
    const first = getFile(drive, 'logo').versions[0];
    drive = addRendition(drive, 'logo', first.id, small(160));
    drive = addVersion(drive, 'logo', v(), ana);
    drive = restoreVersion(drive, 'logo', first.id, 'back', ana);
    expect(getFile(drive, 'logo').versions[0].renditions?.map((r) => r.key)).toEqual(['logo@160']);
    const gone = deleteForever(moveToTrash(drive, 'logo', ana), 'logo');
    expect(gone.keys).toContain('logo@160');
  });
});

describe('the space and the trash', () => {
  it('counts the bytes one owns, every version and picture once, in the trash too', async () => {
    const { addVersion, moveToTrash, restoreVersion, usageOf } = await import('../src');
    let drive = demoDrive();
    const before = usageOf(drive, 'ana');
    drive = addVersion(drive, 'logo', v(500), ana);
    const first = getFile(drive, 'logo').versions[1];
    drive = restoreVersion(drive, 'logo', first.id, 'again', ana);
    // The version brought back shares the bytes of the one it was: counted once.
    expect(usageOf(drive, 'ana')).toBe(before + 500);
    drive = moveToTrash(drive, 'logo', ana);
    expect(usageOf(drive, 'ana')).toBe(before + 500);
    expect(usageOf(drive, 'nobody')).toBe(0);
  });

  it('empties what has been in the trash since before a time, with what is in it', async () => {
    const { moveToTrash, purgeTrash } = await import('../src');
    let drive = moveToTrash(demoDrive(), 'clients', { by: 'ana', at: '2026-01-01T00:00:00.000Z' });
    drive = moveToTrash(drive, 'receipt', { by: 'ana', at: '2026-03-01T00:00:00.000Z' });
    const gone = purgeTrash(drive, '2026-02-01T00:00:00.000Z');
    expect(gone.removed.sort()).toEqual(['clients', 'contract', 'northwind']);
    expect(gone.drive.entries.has('receipt')).toBe(true);
  });

  it('takes a quota and days of the trash, or none', () => {
    expect(readDriveSettings({ quota: 5 * 1024 ** 3, trashDays: 30 })).toMatchObject({ quota: 5 * 1024 ** 3, trashDays: 30 });
    expect(readDriveSettings({ quota: null, trashDays: null }, readDriveSettings({ quota: 2 ** 30 }))).toMatchObject({ quota: null, trashDays: null });
    for (const bad of [{ quota: 10 }, { quota: 'a lot' }, { trashDays: 0 }, { trashDays: 1.5 }]) expect(() => readDriveSettings(bad)).toThrow(DriveError);
  });
});
