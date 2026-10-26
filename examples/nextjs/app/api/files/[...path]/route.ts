// Next.js (App Router): every route of the drive in one route handler, as
// `createDriveHandler` takes a Request and gives a Response. In Node, not on
// the edge: it signs with node:crypto, and SQLite is node:sqlite.

import { createDrive } from '../../../../../drive';
import { identify } from '../../../../../auth/dev';

export const runtime = 'nodejs';
// Never cached: every answer is of the one asking, and the events go on as long as the page watches.
export const dynamic = 'force-dynamic';

const handle = await createDrive(identify);

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS };
