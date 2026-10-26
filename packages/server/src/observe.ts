// What the server says of itself, and how much it lets each one ask: a logger
// of the application's (pino, winston, the console), a word after every
// request for metrics (OpenTelemetry, or what you count with), and limits of
// requests by person, by link and by address, kept in the process unless a
// store of yours keeps them for all of them (Redis).

/** What the server writes when something it did not answer for went wrong: `pino()` is one, `console` another. */
export interface Logger {
  error(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
}

/** The console, as a logger: what the server uses unless given one. */
export const consoleLogger: Logger = {
  error: (message, detail) => (detail === undefined ? console.error(message) : console.error(message, detail)),
  warn: (message, detail) => (detail === undefined ? console.warn(message) : console.warn(message, detail)),
};

/** What `onRequest` is told after each request. */
export interface RequestDone {
  method: string;
  /** The route as the list at the top of api.ts says it: `GET /entries/:id`, `GET /links/:token`; `other` for none. */
  route: string;
  status: number;
  /** Milliseconds, from the request to its answer; of the events, to when they start. */
  ms: number;
  /** Who asked, when they were signed in. */
  user: string | null;
}

/** As much of OpenTelemetry's `Meter` as is used: `metrics.getMeter('rebofiles')` of `@opentelemetry/api` is one. */
export interface MeterLike {
  createHistogram(name: string, options?: { description?: string; unit?: string }): { record(value: number, attributes?: Record<string, string | number>): void };
  createCounter(name: string, options?: { description?: string; unit?: string }): { add(value: number, attributes?: Record<string, string | number>): void };
}

/**
 * An `onRequest` that counts with OpenTelemetry: how long each route takes (`http.server.request.duration`, in
 * seconds, as its conventions name it) and how many answered with an error of the server.
 */
export function openTelemetry(meter: MeterLike): (done: RequestDone) => void {
  const duration = meter.createHistogram('http.server.request.duration', { description: 'How long the routes of the drive take.', unit: 's' });
  const failed = meter.createCounter('rebofiles.server.errors', { description: 'Requests the drive answered with a 5xx.' });
  return (done) => {
    const attributes = { 'http.request.method': done.method, 'http.route': done.route, 'http.response.status_code': done.status };
    duration.record(done.ms / 1000, attributes);
    if (done.status >= 500) failed.add(1, attributes);
  };
}

/** How many of a kind of request may be made in a window of time. */
export interface Limit {
  max: number;
  /** The window, in milliseconds. */
  every: number;
}

/** The kinds of request that are limited, each by who makes it, and what each allows unless said. */
export interface Limits {
  /** Starting an upload, by person. 1000 a minute: a folder of many dropped at once goes. */
  uploads?: Limit | false;
  /** What an archive holds, by person, and through a link, by the link. 30 a minute. */
  zip?: Limit | false;
  /** A search by what is written, by person. 120 a minute. */
  searchText?: Limit | false;
  /** A wrong password of a link, by the link (and by the address, with `clientIp`). 10 in 15 minutes. */
  linkPassword?: Limit | false;
  /** Every request through a link, by the link. 600 a minute. */
  links?: Limit | false;
  /** Every request, by person. None unless said. */
  requests?: Limit | false;
}

export const DEFAULT_LIMITS: Required<Limits> = {
  uploads: { max: 1000, every: 60_000 },
  zip: { max: 30, every: 60_000 },
  searchText: { max: 120, every: 60_000 },
  linkPassword: { max: 10, every: 15 * 60_000 },
  links: { max: 600, every: 60_000 },
  requests: false,
};

/** Where the counts are kept: in the process unless given, which is enough for one; a store of all of them for more. */
export interface Limiter {
  /**
   * One more of `key`: whether it is still within `limit`, and if not, in how many milliseconds it is again. With
   * `peek`, only whether it is, not counted: for what counts only when it fails, as a wrong password.
   */
  hit(key: string, limit: Limit, how?: { peek?: boolean }): Promise<{ ok: boolean; retryAfter: number }> | { ok: boolean; retryAfter: number };
}

/** Counts in the process, a window for each key, forgotten once over. */
export function memoryLimiter(now: () => number = Date.now): Limiter {
  const windows = new Map<string, { count: number; until: number }>();
  let swept = now();
  return {
    hit(key, limit, how = {}) {
      const at = now();
      // The windows over, taken away now and then, so the map does not grow with every key ever seen.
      if (at - swept > 60_000) {
        for (const [k, w] of windows) if (w.until <= at) windows.delete(k);
        swept = at;
      }
      let window = windows.get(key);
      if (how.peek) return window && window.until > at && window.count >= limit.max ? { ok: false, retryAfter: window.until - at } : { ok: true, retryAfter: 0 };
      if (!window || window.until <= at) windows.set(key, (window = { count: 0, until: at + limit.every }));
      window.count++;
      return window.count <= limit.max ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: window.until - at };
    },
  };
}
