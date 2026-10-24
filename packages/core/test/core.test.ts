import { describe, expect, it } from 'vitest';
import {
  DriveError,
  addFile,
  addVersion,
  ancestors,
  changes,
  children,
  createFolder,
  deleteForever,
  driveOf,
  emptyTrash,
  getEntry,
  getFile,
  isTrashed,
  move,
  moveToTrash,
  nameProblem,
  rename,
  restore,
  restoreVersion,
  sameName,
  search,
  splitName,
  subtree,
  trash,
  uniqueName,
  versionNumber,
} from '../src';
import { ana, demoDrive, luis, v } from './drive';

const refused = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof DriveError) return error.code;
    throw error;
  }
  throw new Error('It was not refused');
};

const names = (entries: { name: string }[]) => entries.map((entry) => entry.name);

describe('names', () => {
  it('refuses what a file system would not take', () => {
    expect(nameProblem('contract.docx')).toBe(null);
    expect(nameProblem('Canción ñ 2026.pdf')).toBe(null);
    expect(nameProblem('')).toBe('empty');
    expect(nameProblem('   ')).toBe('empty');
    expect(nameProblem('..')).toBe('dot');
    expect(nameProblem('a/b')).toBe('slash');
    expect(nameProblem('a\\b')).toBe('slash');
    expect(nameProblem('a\u0000b')).toBe('control');
    expect(nameProblem(' a')).toBe('spaces');
    expect(nameProblem('é'.repeat(128))).toBe('too-long');
    expect(nameProblem('e'.repeat(255))).toBe(null);
  });

  it('takes names that differ in case or in how an accent is written for the same', () => {
    expect(sameName('Report.PDF', 'report.pdf')).toBe(true);
    expect(sameName('Canción', 'Canción')).toBe(true);
    expect(sameName('a', 'b')).toBe(false);
  });

  it('splits the extension off the last dot, not a leading one', () => {
    expect(splitName('report.final.pdf')).toEqual({ base: 'report.final', ext: '.pdf' });
    expect(splitName('.env')).toEqual({ base: '.env', ext: '' });
    expect(splitName('README')).toEqual({ base: 'README', ext: '' });
  });

  it('finds the next free name, counting on from one already numbered', () => {
    let drive = demoDrive();
    expect(uniqueName(drive, null, 'new.docx')).toBe('new.docx');
    expect(uniqueName(drive, null, 'RECEIPT.docx')).toBe('RECEIPT (2).docx');
    drive = addFile(drive, { id: 'r2', name: 'receipt.docx', parent: null, type: 'x', version: v() }, ana);
    expect(getEntry(drive, 'r2').name).toBe('receipt (2).docx');
    drive = addFile(drive, { id: 'r3', name: 'receipt (2).docx', parent: null, type: 'x', version: v() }, ana);
    expect(getEntry(drive, 'r3').name).toBe('receipt (3).docx');
  });
});

describe('the tree', () => {
  it('lists a folder with folders first and numbers in order', () => {
    let drive = demoDrive();
    for (const name of ['10.txt', '2.txt', 'a.txt']) drive = addFile(drive, { id: name, name, parent: null, type: 'text/plain', version: v() }, ana);
    expect(names(children(drive, null))).toEqual(['Clients', 'Photos', '2.txt', '10.txt', 'a.txt', 'receipt.docx']);
  });

  it('says where an entry is, from the top down', () => {
    expect(names(ancestors(demoDrive(), 'contract'))).toEqual(['Clients', 'Northwind']);
    expect(ancestors(demoDrive(), 'receipt')).toEqual([]);
  });

  it('refuses to put something in a file or in a folder that does not exist', () => {
    expect(refused(() => createFolder(demoDrive(), { id: 'x', name: 'X', parent: 'receipt' }, ana))).toBe('not-a-folder');
    expect(refused(() => createFolder(demoDrive(), { id: 'x', name: 'X', parent: 'nowhere' }, ana))).toBe('not-found');
    expect(refused(() => createFolder(demoDrive(), { id: 'receipt', name: 'X', parent: null }, ana))).toBe('duplicate-id');
  });

  it('keeps the drive it was given', () => {
    const drive = demoDrive();
    const before = names(children(drive, null));
    rename(drive, 'receipt', 'invoice.docx', luis);
    expect(names(children(drive, null))).toEqual(before);
  });
});

describe('renaming and moving', () => {
  it('renames, and says who and when', () => {
    const drive = rename(demoDrive(), 'contract', 'contract-northwind.docx', luis);
    expect(getEntry(drive, 'contract')).toMatchObject({ name: 'contract-northwind.docx', modified: luis.at, modifiedBy: 'luis', owner: 'ana' });
  });

  it('refuses a name taken in the folder, or keeps both when asked', () => {
    let drive = addFile(demoDrive(), { id: 'other', name: 'other.docx', parent: null, type: 'x', version: v() }, ana);
    expect(refused(() => rename(drive, 'other', 'Receipt.docx', ana))).toBe('name-taken');
    drive = rename(drive, 'other', 'receipt.docx', ana, { ifTaken: 'keep-both' });
    expect(getEntry(drive, 'other').name).toBe('receipt (2).docx');
  });

  it('lets a name change only in case', () => {
    expect(getEntry(rename(demoDrive(), 'receipt', 'Receipt.docx', ana), 'receipt').name).toBe('Receipt.docx');
  });

  it('refuses a name that cannot be', () => {
    expect(refused(() => rename(demoDrive(), 'receipt', 'a/b.docx', ana))).toBe('invalid-name');
  });

  it('moves into another folder', () => {
    const drive = move(demoDrive(), 'receipt', 'northwind', ana);
    expect(names(children(drive, 'northwind'))).toEqual(['contract-final(2).docx', 'receipt.docx']);
    expect(names(children(drive, null))).toEqual(['Clients', 'Photos']);
  });

  it('refuses to move a folder inside itself', () => {
    expect(refused(() => move(demoDrive(), 'clients', 'northwind', ana))).toBe('into-itself');
    expect(refused(() => move(demoDrive(), 'clients', 'clients', ana))).toBe('into-itself');
  });

  it('refuses a name taken where it goes, or keeps both when asked', () => {
    let drive = addFile(demoDrive(), { id: 'logo2', name: 'logo.png', parent: null, type: 'image/png', version: v() }, ana);
    expect(refused(() => move(drive, 'logo2', 'photos', ana))).toBe('name-taken');
    drive = move(drive, 'logo2', 'photos', ana, { ifTaken: 'keep-both' });
    expect(names(children(drive, 'photos'))).toEqual(['logo (2).png', 'logo.png']);
  });
});

describe('the trash', () => {
  it('takes a folder with what is inside it', () => {
    const drive = moveToTrash(demoDrive(), 'clients', luis);
    expect(names(children(drive, null))).toEqual(['Photos', 'receipt.docx']);
    expect(isTrashed(drive, 'contract')).toBe(true);
    expect(names(trash(drive))).toEqual(['Clients']);
    expect(getEntry(drive, 'clients').trashed).toEqual({ at: luis.at, by: 'luis' });
  });

  it('lists the latest put there first', () => {
    let drive = moveToTrash(demoDrive(), 'receipt', ana);
    drive = moveToTrash(drive, 'logo', luis);
    expect(names(trash(drive))).toEqual(['logo.png', 'receipt.docx']);
  });

  it('refuses to change what is in it, or to put something there', () => {
    const drive = moveToTrash(demoDrive(), 'clients', ana);
    expect(refused(() => rename(drive, 'contract', 'x.docx', ana))).toBe('in-trash');
    expect(refused(() => move(drive, 'receipt', 'northwind', ana))).toBe('in-trash');
    expect(refused(() => addFile(drive, { id: 'n', name: 'n.txt', parent: 'clients', type: 'x', version: v() }, ana))).toBe('in-trash');
    expect(refused(() => moveToTrash(drive, 'contract', ana))).toBe('in-trash');
    expect(refused(() => addVersion(drive, 'contract', v(), ana))).toBe('in-trash');
  });

  it('frees the name of what is in it', () => {
    const drive = addFile(moveToTrash(demoDrive(), 'receipt', ana), { id: 'r2', name: 'receipt.docx', parent: null, type: 'x', version: v() }, ana);
    expect(getEntry(drive, 'r2').name).toBe('receipt.docx');
  });

  it('restores to where it was, under another name when that one was taken meanwhile', () => {
    let drive = moveToTrash(demoDrive(), 'receipt', ana);
    drive = addFile(drive, { id: 'r2', name: 'receipt.docx', parent: null, type: 'x', version: v() }, ana);
    drive = restore(drive, 'receipt', luis);
    expect(getEntry(drive, 'receipt')).toMatchObject({ name: 'receipt (2).docx', parent: null });
    expect(getEntry(drive, 'receipt').trashed).toBeUndefined();
    expect(trash(drive)).toEqual([]);
  });

  it('restores to the top when its folder is in the trash too', () => {
    let drive = moveToTrash(demoDrive(), 'contract', ana);
    drive = moveToTrash(drive, 'clients', ana);
    drive = restore(drive, 'contract', ana);
    expect(getEntry(drive, 'contract').parent).toBe(null);
    expect(names(children(drive, null))).toEqual(['Photos', 'contract-final(2).docx', 'receipt.docx']);
  });

  it('refuses to restore what is not in it, even inside a trashed folder', () => {
    const drive = moveToTrash(demoDrive(), 'clients', ana);
    expect(refused(() => restore(drive, 'contract', ana))).toBe('not-in-trash');
    expect(refused(() => restore(drive, 'receipt', ana))).toBe('not-in-trash');
  });

  it('deletes for good only from the trash, and gives the keys to delete', () => {
    expect(refused(() => deleteForever(demoDrive(), 'receipt'))).toBe('not-in-trash');
    const drive = demoDrive();
    const gone = deleteForever(moveToTrash(drive, 'clients', ana), 'clients');
    expect(gone.removed).toEqual(['clients', 'northwind', 'contract']);
    expect(gone.keys).toEqual([getFile(drive, 'contract').versions[0].key]);
    expect(gone.drive.entries.has('contract')).toBe(false);
  });

  it('empties, keeping a key a file outside it still uses', () => {
    let drive = moveToTrash(demoDrive(), 'receipt', ana);
    drive = moveToTrash(drive, 'photos', ana);
    // A file outside the trash shares a key with the receipt, as a copy would.
    const shared = getFile(drive, 'receipt').versions[0];
    drive = addFile(drive, { id: 'copy', name: 'copy.docx', parent: null, type: 'x', version: { id: 'vc', key: shared.key, size: shared.size } }, ana);
    const gone = emptyTrash(drive);
    expect(gone.removed.sort()).toEqual(['logo', 'photos', 'receipt']);
    expect(gone.keys).toEqual([getFile(drive, 'logo').versions[0].key]);
    expect(trash(gone.drive)).toEqual([]);
  });
});

describe('versions', () => {
  it('puts each save first, and counts them from the first upload', () => {
    const first = v(100);
    const second = v(200);
    let drive = addFile(demoDrive(), { id: 'p', name: 'proposal.docx', parent: null, type: 'x', version: first }, ana);
    drive = addVersion(drive, 'p', second, luis);
    const file = getFile(drive, 'p');
    expect(file.versions.map((x) => x.id)).toEqual([second.id, first.id]);
    expect(file).toMatchObject({ modifiedBy: 'luis', owner: 'ana' });
    expect(versionNumber(file, first.id)).toBe(1);
    expect(versionNumber(file, second.id)).toBe(2);
  });

  it('restores an old one as a new version with the same bytes', () => {
    const first = v(100);
    let drive = addFile(demoDrive(), { id: 'p', name: 'proposal.docx', parent: null, type: 'x', version: first }, ana);
    drive = addVersion(drive, 'p', v(200), ana);
    drive = restoreVersion(drive, 'p', first.id, 'back', luis);
    const now = getFile(drive, 'p').versions[0];
    expect(now).toMatchObject({ id: 'back', key: first.key, size: 100, by: 'luis', restoredFrom: first.id });
    expect(getFile(drive, 'p').versions).toHaveLength(3);
    expect(refused(() => restoreVersion(drive, 'p', 'none', 'x', ana))).toBe('no-version');
    expect(restoreVersion(drive, 'p', 'back', 'again', ana)).toBe(drive);
  });

  it('refuses versions of a folder', () => {
    expect(refused(() => addVersion(demoDrive(), 'clients', v(), ana))).toBe('not-a-file');
  });
});

describe('search', () => {
  it('finds without minding case or accents, every word somewhere in the name', () => {
    let drive = addFile(demoDrive(), { id: 's', name: 'Canción de Año Nuevo.mp3', parent: 'photos', type: 'audio/mpeg', version: v() }, ana);
    drive = addFile(drive, { id: 'n', name: 'new contract.docx', parent: null, type: 'x', version: v() }, ana);
    expect(names(search(drive, 'cancion ano'))).toEqual(['Canción de Año Nuevo.mp3']);
    expect(names(search(drive, 'CONTRACT'))).toEqual(['contract-final(2).docx', 'new contract.docx']);
    expect(search(drive, '   ')).toEqual([]);
  });

  it('looks inside a folder, or in the trash', () => {
    let drive = demoDrive();
    expect(names(search(drive, 'o', { within: 'clients' }))).toEqual(['Northwind', 'contract-final(2).docx']);
    drive = moveToTrash(drive, 'clients', ana);
    expect(names(search(drive, 'contract'))).toEqual([]);
    expect(names(search(drive, 'contract', { trashed: true }))).toEqual(['contract-final(2).docx']);
  });
});

describe('changes', () => {
  it('lists only what an operation touched, for a store to write', () => {
    const drive = demoDrive();
    const moved = move(drive, 'receipt', 'photos', ana);
    expect(changes(drive, moved)).toEqual({ put: [getEntry(moved, 'receipt')], removed: [] });
    const gone = deleteForever(moveToTrash(moved, 'photos', ana), 'photos').drive;
    expect(changes(moved, gone).removed.sort()).toEqual(['logo', 'photos', 'receipt']);
  });

  it('makes the same drive again from the entries a store keeps', () => {
    const drive = demoDrive();
    const again = driveOf(JSON.parse(JSON.stringify([...drive.entries.values()])));
    expect(names(subtree(again, 'clients'))).toEqual(['Clients', 'Northwind', 'contract-final(2).docx']);
    expect(changes(drive, again).removed).toEqual([]);
  });
});
