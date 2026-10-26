// `npm run storage:seed`: a few folders and files in the bucket of `.env`, to
// have something to look at in the page. All made in code, as the tests are.

import { createDriveClient } from '@rebofiles/react';
import { sampleDocx } from '../../../tools/sample-docx';
import { handle, storage } from '../server/bucket';

const origin = 'http://storage.seed';
const drive = createDriveClient({
  base: `${origin}/api/files`,
  fetch: (input, init) => (String(input).startsWith(origin) ? handle(new Request(String(input), init)) : fetch(input, init)),
});

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const top = (await drive.list(null)).entries;
const folder = async (name: string) => top.find((entry) => entry.kind === 'folder' && entry.name === name) ?? (await drive.createFolder(name, null));

const contracts = await folder('Contracts');
const notes = await folder('Notes');
await drive.upload(new File([new Uint8Array(sampleDocx())], 'Services agreement.docx', { type: DOCX }), { parent: contracts.id });
await drive.upload(new File(['# Meeting\n\n- Try the drive on a real bucket.\n- Move this note into the trash and back.\n'], 'meeting.md', { type: 'text/markdown' }), { parent: notes.id });
await drive.upload(new File(['name,amount\nAcme,1200\nGlobex,800\n'], 'invoices.csv', { type: 'text/csv' }), { parent: null });

console.log(`Seeded ${storage.label}: Contracts, Notes and a few files. npm run storage to see them.`);
