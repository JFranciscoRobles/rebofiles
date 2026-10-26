// What @rebofiles/sync promises: the engine, which runs anywhere a folder can
// be read and written; and on Node, a folder of the disk and a sync that goes on.

export { type LocalEntry, type LocalFolder, type Synced, type SyncState, type SyncAction, type SyncOptions, EmptyFolderRefused, syncOnce, conflictName, fold, typeOfName } from './engine';
export { type WatchOptions, OWN, ignored, nodeFolder, loadState, saveState, watchSync } from './node';
