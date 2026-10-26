// How a drive is set up, by whoever may configure it, and what each person
// changes of it for themselves: the language and the theme of the interface,
// the colour of its brand, and the sizes pictures are made in when they are
// uploaded. Read from what a request or a store gave, with what is missing
// or not right taken from the defaults.

import { DriveError } from './errors';

export type Language = 'en' | 'es' | 'zh';
export type Theme = 'light' | 'dark' | 'auto';

export interface ImageSettings {
  /** The most pixels of the longest side of each smaller picture made of an image: four, the smallest first. */
  sizes: number[];
  /** What they are made as: JPEG, smallest for photos (the default), or the type of the original. */
  format: 'jpeg' | 'original';
  /** Of a JPEG or a WebP, from 0.1 to 1. */
  quality: number;
  /** False to make none. */
  enabled: boolean;
}

export interface DriveSettings {
  language: Language;
  theme: Theme;
  /** The colour of buttons and of what is selected, as #rrggbb; null for the drive's own green. */
  brand: string | null;
  images: ImageSettings;
  /** The bytes each person may keep, in the trash too; null for no limit. */
  quota: number | null;
  /** After how many days what is in the trash is deleted for good; null for never. */
  trashDays: number | null;
  /** How many days since a file or folder was made before it may be deleted for good, by anyone or by the trash; null for no minimum. */
  retentionDays: number | null;
}

/** What a person changes for themselves; what they leave out is the drive's. */
export interface PersonalSettings {
  language?: Language;
  theme?: Theme;
}

export const LANGUAGES: Language[] = ['en', 'es', 'zh'];
export const THEMES: Theme[] = ['light', 'dark', 'auto'];
/** How many sizes a picture is made in. */
export const IMAGE_SIZES = 4;

export const DEFAULT_SETTINGS: DriveSettings = {
  language: 'en',
  theme: 'light',
  brand: null,
  images: { sizes: [160, 480, 1024, 2048], format: 'jpeg', quality: 0.82, enabled: true },
  quota: null,
  trashDays: null,
  retentionDays: null,
};

const refuse = (message: string): never => {
  throw new DriveError('invalid-settings', message);
};
const object = (value: unknown, what: string): Record<string, unknown> =>
  value === undefined || value === null ? {} : typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : refuse(`${what} must be an object.`);
const oneOf = <T extends string>(value: unknown, allowed: T[], what: string): T | undefined =>
  value === undefined || value === null ? undefined : allowed.includes(value as T) ? (value as T) : refuse(`${what} must be ${allowed.map((a) => `"${a}"`).join(', ')}.`);

/** The settings of a drive: what is given, checked, over the defaults. Throws a DriveError 'invalid-settings' for what cannot be. */
export function readDriveSettings(value: unknown, over: DriveSettings = DEFAULT_SETTINGS): DriveSettings {
  const given = object(value, 'The settings');
  const images = object(given.images, '"images"');
  const brand = given.brand === undefined ? over.brand : given.brand === null || given.brand === '' ? null : String(given.brand).toLowerCase();
  if (brand !== null && !/^#[0-9a-f]{6}$/.test(brand)) refuse('"brand" must be a colour as #rrggbb.');
  let sizes = over.images.sizes;
  if (images.sizes !== undefined) {
    if (!Array.isArray(images.sizes) || images.sizes.length !== IMAGE_SIZES) refuse(`"images.sizes" must be ${IMAGE_SIZES} sizes in pixels.`);
    sizes = (images.sizes as unknown[]).map(Number);
    if (sizes.some((size) => !Number.isInteger(size) || size < 16 || size > 8192)) refuse('Each size is a whole number of pixels from 16 to 8192.');
    sizes = [...sizes].sort((a, b) => a - b);
    if (new Set(sizes).size !== sizes.length) refuse('The sizes must differ.');
  }
  const quality = images.quality === undefined ? over.images.quality : Number(images.quality);
  if (!(quality >= 0.1 && quality <= 1)) refuse('"images.quality" must be from 0.1 to 1.');
  if (images.enabled !== undefined && typeof images.enabled !== 'boolean') refuse('"images.enabled" must be true or false.');
  const quota = given.quota === undefined ? over.quota : given.quota === null ? null : Number(given.quota);
  if (quota !== null && !(Number.isSafeInteger(quota) && quota >= 1024 * 1024)) refuse('"quota" must be a number of bytes, a megabyte or more, or null for no limit.');
  const trashDays = given.trashDays === undefined ? over.trashDays : given.trashDays === null ? null : Number(given.trashDays);
  if (trashDays !== null && !(Number.isInteger(trashDays) && trashDays >= 1 && trashDays <= 3650)) refuse('"trashDays" must be a number of days from 1 to 3650, or null for never.');
  const retentionDays = given.retentionDays === undefined ? (over.retentionDays ?? null) : given.retentionDays === null ? null : Number(given.retentionDays);
  if (retentionDays !== null && !(Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 36500))
    refuse('"retentionDays" must be a number of days from 1 to 36500, or null for no minimum.');
  return {
    language: oneOf(given.language, LANGUAGES, '"language"') ?? over.language,
    theme: oneOf(given.theme, THEMES, '"theme"') ?? over.theme,
    brand,
    images: {
      sizes,
      format: oneOf(images.format, ['jpeg', 'original'], '"images.format"') ?? over.images.format,
      quality,
      enabled: (images.enabled as boolean | undefined) ?? over.images.enabled,
    },
    quota,
    trashDays,
    retentionDays,
  };
}

/** What a person set for themselves, checked; null or left out is the drive's. */
export function readPersonalSettings(value: unknown): PersonalSettings {
  const given = object(value, 'The settings');
  const language = oneOf(given.language, LANGUAGES, '"language"');
  const theme = oneOf(given.theme, THEMES, '"theme"');
  return { ...(language ? { language } : {}), ...(theme ? { theme } : {}) };
}

/** The drive as one person sees it: theirs over the drive's. */
export const settingsFor = (drive: DriveSettings, mine: PersonalSettings): DriveSettings => ({ ...drive, ...mine });
