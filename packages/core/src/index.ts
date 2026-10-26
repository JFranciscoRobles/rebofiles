// What @rebofiles/core promises: the model of a drive, reading it, changing it
// and searching it. Each name is here on purpose; a change to this list is a
// change of the API.

export {
  type EntryId,
  type Version,
  type Rendition,
  type Trashed,
  type Role,
  type Share,
  type Link,
  type FolderEntry,
  type FileEntry,
  type Entry,
  type Drive,
  type Context,
  emptyDrive,
  driveOf,
  sizeOf,
} from './model';
export { type DriveErrorCode, DriveError } from './errors';
export { type NameProblem, nameProblem, sameName, uniqueName, splitName } from './names';
export { getEntry, getFile, getFolder, byName, children, ancestors, isWithin, isTrashed, trash, recent, subtree } from './tree';
export {
  type NameOptions,
  type NewFolder,
  type NewFile,
  type Removed,
  createFolder,
  addFile,
  rename,
  move,
  moveToTrash,
  restore,
  deleteForever,
  emptyTrash,
  purgeTrash,
  usageOf,
} from './ops';
export { addVersion, restoreVersion, versionNumber, addRendition, renditionFor } from './versions';
export {
  type Language,
  type Theme,
  type ImageSettings,
  type DriveSettings,
  type PersonalSettings,
  LANGUAGES,
  THEMES,
  IMAGE_SIZES,
  DEFAULT_SETTINGS,
  readDriveSettings,
  readPersonalSettings,
  settingsFor,
} from './settings';
export { type PackedFile, type Packed, packOf } from './pack';
export { type SearchOptions, search } from './search';
export { type Changes, changes } from './changes';
export { type Action, type Access, EVERYONE, allows, accessOf, share, unshare, sharedWith, addLink, removeLink, linked, linkOf, useLink, linkSpent, LINK_GRACE } from './sharing';
