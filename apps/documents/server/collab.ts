// Several people in one document at once, by Rebodocs' collaboration server:
// each document of the drive is a room named by its id. The room is opened
// from the drive's file, and once everybody has left, what they wrote is kept
// as a new version of it, by the first who changed it. Only who may edit the
// file writes in it; who may only read it watches.
//
//   GET /api/collab/ticket?file=…   what lets the one asking into the room: signed here, checked by `admit`

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createCollabServer } from '@rebodocs/collab/server';
import type { RoomStorage } from '@rebodocs/collab/storage';
import * as core from '@rebofiles/core';
import { createDriveClient } from '@rebofiles/drive';
import { handle, metadata, secret, storage } from './documents';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Who asks, as the drive's `identify` says it. */
const whoOf = (request: IncomingMessage) => (request.headers['x-user'] as string | undefined) || process.env.USER || 'me';
const sign = (user: string, room: string) => createHmac('sha256', secret).update(`${user}\n${room}`).digest('base64url');

/** A file of the drive, and what `user` may do with it. */
async function fileFor(room: string, user: string) {
  const drive = await metadata.load();
  const entry = drive.entries.get(room);
  if (entry?.kind !== 'file' || core.isTrashed(drive, room)) return undefined;
  const access = core.accessOf(drive, room, { id: user });
  return { entry, reads: core.allows(access, 'read'), edits: core.allows(access, 'upload') };
}

/** The drive's client as `user`, through the handler, for a new version to go up as theirs. */
const clientAs = (user: string) =>
  createDriveClient({ base: 'http://documents.local/api/files', fetch: (input, init) => handle(new Request(String(input), init)), headers: () => ({ 'x-user': user }), remember: null });

const rooms: RoomStorage = {
  open: false,
  forgets: true,
  async load(room) {
    const drive = await metadata.load();
    const entry = drive.entries.get(room);
    if (entry?.kind !== 'file') return undefined;
    return { name: entry.name, epoch: 0, base: await storage.read!(entry.versions[0].key), log: [] };
  },
  async keep(room, kept, folded, ended) {
    // When everybody left having changed it: a new version, as a save in the editor makes.
    if (!folded || !ended?.authors.length) return;
    const by = ended.authors[0];
    const file = await fileFor(room, by);
    if (!file?.edits) return;
    await clientAs(by).upload(new File([kept.base as BlobPart], file.entry.name, { type: DOCX }), { file: room });
  },
  add() {},
  async admit(room, ticket) {
    const [user, mac] = ticket.split('.');
    if (!user || !mac) return undefined;
    const expected = Buffer.from(sign(user, room));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
    const file = await fileFor(room, user);
    if (!file?.reads) return undefined;
    return { name: user, readOnly: !file.edits };
  },
};

export const collab = createCollabServer({ storage: rooms });

/** What lets the one asking into the room of a file they may read, and whether they only watch. */
export async function ticket(request: IncomingMessage, response: ServerResponse) {
  const user = whoOf(request);
  const room = new URL(request.url ?? '', 'http://documents.local').searchParams.get('file') ?? '';
  const file = await fileFor(room, user);
  response.setHeader('Content-Type', 'application/json');
  if (!file?.reads) {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not-found' }));
    return;
  }
  response.end(JSON.stringify({ ticket: `${user}.${sign(user, room)}`, readOnly: !file.edits, name: user }));
}
