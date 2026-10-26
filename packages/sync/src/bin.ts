// `rebofiles-sync`: a folder of this computer kept as a folder of a drive,
// for as long as it runs.
//
//   rebofiles-sync ~/ReboFiles --server https://app.example.com/api/files --token …
//   rebofiles-sync ./Clients --server … --folder <id of a folder of the drive> --once
//
// The token goes as `Authorization: Bearer`, for an `identify` that reads one;
// REBOFILES_TOKEN says it too, so it is not in the history of the shell.

import { parseArgs } from 'node:util';
import { createDriveClient } from '@rebofiles/drive';
import { syncOnce } from './engine';
import { loadState, nodeFolder, saveState, watchSync } from './node';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    server: { type: 'string' },
    token: { type: 'string' },
    folder: { type: 'string' },
    once: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [disk] = positionals;
const server = values.server ?? process.env.REBOFILES_SERVER;
const token = values.token ?? process.env.REBOFILES_TOKEN;
if (values.help || !disk || !server) {
  console.log('rebofiles-sync <folder> --server <address of the routes> [--token …] [--folder <id>] [--once]');
  process.exit(values.help ? 0 : 1);
}

const client = createDriveClient({ base: server, headers: (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {}), remember: null });
const told = (action: Parameters<NonNullable<Parameters<typeof syncOnce>[0]['onAction']>>[0]) =>
  console.log(
    action.do === 'failed'
      ? `✗ ${action.path}: ${action.error}`
      : `${action.do.padEnd(12)} ${action.path}${'to' in action ? ` → ${action.to}` : ''}${'kept' in action ? ` (yours: ${action.kept})` : ''}`,
  );

if (values.once) {
  const { state, actions } = await syncOnce({ client, local: nodeFolder(disk), state: await loadState(disk), root: values.folder ?? null, onAction: told });
  await saveState(disk, state);
  console.log(actions.length ? `${actions.length} done.` : 'The same on both sides.');
} else {
  console.log(`Keeping ${disk} as the drive at ${server}. Ctrl+C to stop.`);
  const sync = watchSync({ client, folder: disk, root: values.folder ?? null, onAction: told, onError: (error) => console.error('✗', error instanceof Error ? error.message : error) });
  process.on('SIGINT', () => (sync.stop(), process.exit(0)));
}
