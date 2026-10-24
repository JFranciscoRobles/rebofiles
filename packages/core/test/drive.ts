// A small drive for the tests, made in code: the one of the landing's demo.

import { type Context, type Drive, addFile, createFolder, emptyDrive } from '../src';

export const ana: Context = { by: 'ana', at: '2026-10-01T09:00:00.000Z' };
export const luis: Context = { by: 'luis', at: '2026-10-02T09:00:00.000Z' };

let counter = 0;
export const v = (size = 1000) => {
  counter++;
  return { id: `v${counter}`, key: `k${counter}`, size };
};

export function demoDrive(): Drive {
  let drive = emptyDrive();
  drive = createFolder(drive, { id: 'clients', name: 'Clients', parent: null }, ana);
  drive = createFolder(drive, { id: 'northwind', name: 'Northwind', parent: 'clients' }, ana);
  drive = createFolder(drive, { id: 'photos', name: 'Photos', parent: null }, ana);
  drive = addFile(
    drive,
    { id: 'contract', name: 'contract-final(2).docx', parent: 'northwind', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', version: v(48_000) },
    ana,
  );
  drive = addFile(drive, { id: 'receipt', name: 'receipt.docx', parent: null, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', version: v(12_000) }, ana);
  drive = addFile(drive, { id: 'logo', name: 'logo.png', parent: 'photos', type: 'image/png', version: v(80_000) }, ana);
  return drive;
}
