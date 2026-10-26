// A request refused, with what to tell the person.

import { DriveError, type DriveErrorCode } from '@rebofiles/core';

export class Refused extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const STATUS: Record<DriveErrorCode, number> = {
  'not-found': 404,
  'duplicate-id': 409,
  'invalid-name': 400,
  'name-taken': 409,
  'not-a-folder': 400,
  'not-a-file': 400,
  'into-itself': 400,
  'in-trash': 409,
  'not-in-trash': 409,
  'no-version': 404,
  'invalid-share': 400,
};

/** The answer to an error: what core refused and why, what was refused here, or a 500 that says nothing of the inside. */
export function answerTo(error: unknown): Response {
  if (error instanceof Refused) return Response.json({ error: error.code, message: error.message }, { status: error.status });
  if (error instanceof DriveError) return Response.json({ error: error.code, message: error.message }, { status: STATUS[error.code] });
  console.error(error);
  return Response.json({ error: 'server', message: 'Something went wrong on the server.' }, { status: 500 });
}
