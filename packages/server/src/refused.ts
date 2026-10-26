// A request refused, with what to tell the person.

import { DriveError, type DriveErrorCode } from '@rebofiles/core';
import { type Logger, consoleLogger } from './observe';

export class Refused extends Error {
  readonly status: number;
  readonly code: string;
  /** Headers of the answer: `retry-after` of one refused for asking too often. */
  readonly headers?: Record<string, string>;

  constructor(status: number, code: string, message: string, options: { headers?: Record<string, string>; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.status = status;
    this.code = code;
    this.headers = options.headers;
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
  'invalid-settings': 400,
  'invalid-color': 400,
  'invalid-comment': 400,
  'on-hold': 409,
  retained: 409,
};

/** The answer to an error: what core refused and why, what was refused here, or a 500 that says nothing of the inside. */
export function answerTo(error: unknown, log: Logger = consoleLogger): Response {
  if (error instanceof Refused) {
    // A refusal of the server's own (503: a scanner down) is said to the page, and what was behind it to the log.
    if (error.status >= 500 && error.cause !== undefined) log.error(`${error.code}: ${error.message}`, error.cause);
    return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: error.headers });
  }
  if (error instanceof DriveError) return Response.json({ error: error.code, message: error.message }, { status: STATUS[error.code] });
  log.error('A request failed on the server:', error);
  return Response.json({ error: 'server', message: 'Something went wrong on the server.' }, { status: 500 });
}
