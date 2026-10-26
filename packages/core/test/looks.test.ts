// How an entry looks, beside what it is: a folder's colour, and the tiny
// picture shown blurred while a picture comes.

import { describe, expect, it } from 'vitest';
import { type FileEntry, type FolderEntry, PLACEHOLDER_MOST, restoreVersion, setColor, setPlaceholder, addVersion } from '../src';
import { ana, demoDrive, v } from './drive';

const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('a folder’s colour', () => {
  it('is one of the drive’s, or its own again, and does not change when it was modified', () => {
    let drive = setColor(demoDrive(), 'clients', 'teal');
    const folder = drive.entries.get('clients') as FolderEntry;
    expect(folder.color).toBe('teal');
    expect(folder.modified).toBe(ana.at);
    expect(setColor(drive, 'clients', 'teal')).toBe(drive);
    drive = setColor(drive, 'clients', null);
    expect(drive.entries.get('clients')).not.toHaveProperty('color');
    expect(() => setColor(drive, 'clients', 'chartreuse' as never)).toThrow('not a colour');
    expect(() => setColor(drive, 'logo', 'red')).toThrow();
  });
});

describe('a placeholder', () => {
  it('is a tiny picture as a data: URL, kept with its version and with one that brings it back', () => {
    const start = demoDrive();
    const drive = setPlaceholder(start, 'logo', (start.entries.get('logo') as FileEntry).versions[0].id, tiny);
    const logo = drive.entries.get('logo') as FileEntry;
    expect(logo.versions[0].placeholder).toBe(tiny);
    expect(() => setPlaceholder(drive, 'logo', logo.versions[0].id, 'https://example.com/a.png')).toThrow('tiny picture');
    expect(() => setPlaceholder(drive, 'logo', logo.versions[0].id, `data:image/jpeg;base64,${'A'.repeat(PLACEHOLDER_MOST)}`)).toThrow('tiny picture');
    expect(() => setPlaceholder(drive, 'logo', 'nope', tiny)).toThrow();

    const newer = addVersion(drive, 'logo', v(5), ana);
    const back = restoreVersion(newer, 'logo', logo.versions[0].id, 'again', ana);
    expect((back.entries.get('logo') as FileEntry).versions[0].placeholder).toBe(tiny);
  });
});
