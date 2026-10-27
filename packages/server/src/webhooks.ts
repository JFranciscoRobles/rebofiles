// What is done to the drive told to other services over HTTP: each change,
// as its activity says it, POSTed as JSON to an address of theirs, signed
// with a secret both know, and tried again a few times when it does not
// arrive. Given as `onChange`, it never holds up the request that changed it.
//
//   createDriveHandler({ ...options, onChange: webhook({ url: 'https://crm.example/hooks/files', secret }) });
//
// The service checks each with `verifyWebhook(secret, body, headers)`.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Activity, Entry } from '@rebofiles/core';

export interface WebhookOptions {
  /** Where each change is POSTed. */
  url: string;
  /** What each is signed with, `X-Rebofiles-Signature`: long and random, known to the service too. */
  secret: string;
  /** Only these actions (`uploaded`, `renamed`, `shared`…); every one unless said. */
  actions?: Activity['action'][];
  /** How many times it is tried, the first after a second, each wait four times the last: 3 unless said. */
  attempts?: number;
  /** How long one try waits for an answer, in milliseconds: 10,000 unless said. */
  timeout?: number;
  /** For tests: what makes the requests. */
  fetch?: typeof fetch;
  /** Told when one did not arrive after every try. */
  onFailure?: (error: Error, delivery: WebhookBody) => void;
}

/** What is POSTed of each change. */
export interface WebhookBody {
  /** This delivery's own, the same in each try of it: to take it once. */
  id: string;
  action: Activity['action'];
  at: string;
  by: string;
  /** The entry as it is after the change, in short; null once deleted. */
  entry: { id: string; name: string; kind: 'file' | 'folder'; parent: string | null; owner: string } | null;
  activity: Activity;
}

const sign = (secret: string, timestamp: string, body: string) => `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

/** An `onChange` that tells `url` of each change. */
export function webhook(options: WebhookOptions): (event: { activity: Activity; entry: Entry | null }) => Promise<void> {
  const send = options.fetch ?? fetch;
  const attempts = Math.max(1, options.attempts ?? 3);
  return async ({ activity, entry }) => {
    if (options.actions && !options.actions.includes(activity.action)) return;
    const delivery: WebhookBody = {
      id: randomUUID(),
      action: activity.action,
      at: activity.at,
      by: activity.by,
      entry: entry && { id: entry.id, name: entry.name, kind: entry.kind, parent: entry.parent, owner: entry.owner },
      activity,
    };
    const body = JSON.stringify(delivery);
    let last: Error = new Error('Not sent.');
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await new Promise((done) => setTimeout(done, 1000 * 4 ** (attempt - 1)));
      const timestamp = String(Math.floor(Date.now() / 1000));
      try {
        const answer = await send(options.url, {
          method: 'POST',
          body,
          headers: {
            'content-type': 'application/json',
            'x-rebofiles-event': activity.action,
            'x-rebofiles-delivery': delivery.id,
            'x-rebofiles-timestamp': timestamp,
            'x-rebofiles-signature': sign(options.secret, timestamp, body),
          },
          signal: AbortSignal.timeout(options.timeout ?? 10_000),
        });
        if (answer.ok) return;
        last = new Error(`${options.url} answered ${answer.status}.`);
        // Refused for what it is, not for now: trying again would be refused again.
        if (answer.status >= 400 && answer.status < 500 && answer.status !== 408 && answer.status !== 429) break;
      } catch (error) {
        last = error instanceof Error ? error : new Error(String(error));
      }
    }
    options.onFailure?.(last, delivery);
    throw last;
  };
}

/** Several `onChange`s as one: each told, one failing not keeping the others from it. */
export function everyChange(...handlers: ((event: { activity: Activity; entry: Entry | null }) => unknown)[]) {
  return async (event: { activity: Activity; entry: Entry | null }) => {
    const failed = (await Promise.allSettled(handlers.map(async (handler) => handler(event)))).find((done) => done.status === 'rejected');
    if (failed) throw (failed as PromiseRejectedResult).reason;
  };
}

/**
 * Whether a delivery is one the drive signed with `secret`, made in the last `tolerance` seconds (300 unless said):
 * what the service that is told checks, with the body as it came, before it trusts it.
 */
export function verifyWebhook(secret: string, body: string, headers: Headers | Record<string, string | undefined>, tolerance = 300): boolean {
  const get = (name: string) => (headers instanceof Headers ? headers.get(name) : (headers[name] ?? headers[name.toLowerCase()])) ?? undefined;
  const timestamp = get('x-rebofiles-timestamp');
  const signature = get('x-rebofiles-signature');
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return false;
  const expected = Buffer.from(sign(secret, timestamp, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
