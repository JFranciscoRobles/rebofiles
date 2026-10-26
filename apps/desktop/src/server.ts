// Which server the window is of: kept in the web view's storage between
// starts, and tried before it is taken, so a wrong address or token says so
// instead of leaving an empty drive.

export interface Server {
  /** Where the routes of @rebofiles/server are, as `https://files.example.com/api/files`. */
  address: string;
  /** Sent as `Authorization: Bearer`, for a server whose `identify` reads one. */
  token?: string;
}

const KEY = 'rebofiles-desktop:server';

export function recall(storage: Pick<Storage, 'getItem'> = localStorage): Server | null {
  try {
    const kept = JSON.parse(storage.getItem(KEY) ?? 'null') as Server | null;
    return kept && typeof kept.address === 'string' ? kept : null;
  } catch {
    return null;
  }
}

export function remember(server: Server, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(KEY, JSON.stringify(server));
}

export function forget(storage: Pick<Storage, 'removeItem'> = localStorage) {
  storage.removeItem(KEY);
}

/** What can be wrong with a server: its address, its answer, or that it could not be reached. */
export type ServerProblem = 'not-an-address' | 'not-http' | 'token' | 'answered' | 'not-rebofiles' | 'unreachable';

/** What is wrong with a server, and the status it answered with; null when it answers as a ReboFiles server does. */
export async function tryServer(server: Server, send: typeof fetch = fetch): Promise<{ problem: ServerProblem; status?: number } | null> {
  let url: URL;
  try {
    url = new URL(`${server.address.replace(/\/$/, '')}/info`);
  } catch {
    return { problem: 'not-an-address' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { problem: 'not-http' };
  try {
    const answer = await send(url, { headers: server.token ? { authorization: `Bearer ${server.token}` } : {} });
    if (answer.status === 401 || answer.status === 403) return { problem: 'token', status: answer.status };
    if (!answer.ok) return { problem: 'answered', status: answer.status };
    const said = (await answer.json().catch(() => null)) as { storage?: unknown } | null;
    return said && typeof said.storage === 'string' ? null : { problem: 'not-rebofiles' };
  } catch {
    // A server down, or one that does not let this window in: the browser does not say which.
    return { problem: 'unreachable' };
  }
}
