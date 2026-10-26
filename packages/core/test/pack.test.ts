// What an archive of some entries holds: files, folders with what is in them,
// at their paths, without what is in the trash or may not be read.

import { describe, expect, it } from 'vitest';
import { addFile, createFolder, moveToTrash, packOf } from '../src';
import { ana, demoDrive, v } from './drive';

describe('an archive of some entries', () => {
  it('holds each file, and each folder with what is in it, at the path it has from the one picked', () => {
    const drive = demoDrive();
    const packed = packOf(drive, ['clients', 'receipt']);
    expect(packed.folders).toEqual(['Clients/', 'Clients/Northwind/']);
    expect(packed.files.map((f) => f.path)).toEqual(['Clients/Northwind/contract-final(2).docx', 'receipt.docx']);
    expect(packed.files[0]).toMatchObject({ id: 'contract', size: 48_000 });
  });

  it('keeps an empty folder, leaves out what is in the trash, and what may not be read with what is in it', () => {
    let drive = createFolder(demoDrive(), { id: 'empty', name: 'Empty', parent: 'clients' }, ana);
    drive = addFile(drive, { id: 'old', name: 'old.txt', parent: 'clients', type: 'text/plain', version: v(5) }, ana);
    drive = moveToTrash(drive, 'old', ana);
    const packed = packOf(drive, ['clients'], (entry) => entry.id !== 'northwind');
    expect(packed.folders).toEqual(['Clients/', 'Clients/Empty/']);
    expect(packed.files).toEqual([]);
    expect(packOf(drive, ['clients', 'nothing'], (entry) => entry.id !== 'clients')).toEqual({ files: [], folders: [] });
  });

  it('tells apart two picked with the same name, and takes one picked twice once', () => {
    let drive = demoDrive();
    drive = addFile(drive, { id: 'second', name: 'receipt.docx', parent: 'photos', type: 'text/plain', version: v(3) }, ana);
    expect(packOf(drive, ['receipt', 'second', 'receipt']).files.map((f) => f.path)).toEqual(['receipt.docx', 'receipt (2).docx']);
  });
});
