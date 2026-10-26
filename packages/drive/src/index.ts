// What @rebofiles/drive promises: the client of the server's routes, the
// drive kept in the page, the words of the interface in two languages, and
// how a file is shown. Each name is here on purpose; a change to this list is
// a change of the API.

export {
  type ClientOptions,
  type DriveClient,
  type Listing,
  type UploadOptions,
  type UploadProgress,
  type UploadMemory,
  type SettingsAnswer,
  type FileAddress,
  type LinkClient,
  type LinkListing,
  RequestError,
  createDriveClient,
  createLinkClient,
  hashOf,
  HASH_UP_TO,
} from './client';
export { type MemoryOptions, type MemoryClient, createMemoryClient } from './memory';
export { type Texts, type Translate, TEXTS, translator, formatSize, formatDate } from './i18n';
export { type Kind, type DocumentPreview, kindOf, badgeOf } from './kinds';
export { CSS } from './styles';
export { type MadeRendition, renditionsOf, makesRenditions } from './images';
export { type ZipItem, type ZipSink, type ZipOptions, writeZip, blobSink, streamSink, crc32 } from './zip';
export { type Choice, type Conflict, type UploadItem, type Uploads, type UploadsOptions, type UploadsSummary, createUploads, formatDuration, lookInDrive } from './uploads';
export { type Picked, readDropped, readChosen } from './folders';
export { type ZipProgress, type ZipDownload, type ZipDownloadOptions, downloadZip } from './download';
export { type DriveOptions, type MountedDrive, mountDrive } from './screen';
export { type SharedLinkOptions, mountSharedLink } from './link';
