// What an operation refuses, by a code an interface can say in its own words.

export type DriveErrorCode = 'not-found' | 'duplicate-id' | 'invalid-name' | 'name-taken' | 'not-a-folder' | 'not-a-file' | 'into-itself' | 'in-trash' | 'not-in-trash' | 'no-version';

export class DriveError extends Error {
  readonly code: DriveErrorCode;

  constructor(code: DriveErrorCode, message: string) {
    super(message);
    this.name = 'DriveError';
    this.code = code;
  }
}
