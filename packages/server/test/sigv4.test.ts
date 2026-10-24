import { describe, expect, it } from 'vitest';
import { presign } from '../src/sigv4';

describe('signed addresses', () => {
  it('signs as AWS does, by the example of its documentation', () => {
    // "Authenticating Requests: Using Query Parameters", Amazon S3 API Reference.
    const url = presign(
      { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' },
      { method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', expires: 86400, at: new Date('2013-05-24T00:00:00Z') },
    );
    expect(new URL(url).searchParams.get('X-Amz-Signature')).toBe('aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });

  it('keeps the slashes of a key and encodes the rest of it', () => {
    const url = presign({ accessKeyId: 'a', secretAccessKey: 'b', region: 'auto' }, { method: 'PUT', url: 'https://s3.test/bucket/files/a b+c.docx', expires: 60 });
    expect(new URL(url).pathname).toBe('/bucket/files/a%20b%2Bc.docx');
  });

  it('signs the headers it is given, by their names in lower case', () => {
    const url = presign({ accessKeyId: 'a', secretAccessKey: 'b', region: 'auto' }, { method: 'PUT', url: 'https://s3.test/bucket/k', expires: 60, headers: { 'Content-Length': '12' } });
    expect(new URL(url).searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;host');
  });
});
