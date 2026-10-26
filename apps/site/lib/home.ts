// What the landing page says: one place for the version, the packages and the
// features, so the badge, the install picker and the table change together.

import { version } from '../package.json';

/** The version the packages will be published at; the site moves with them. */
export const VERSION = version;
/**
 * Whether the packages are on npm. Until they are, the page shows no command
 * to install them (ROADMAP.md): turn it on with the first publish.
 */
export const PUBLISHED = false;

/** The six pastel pairs, background and text, that take turns on tags, icons and packages. */
export type Pastel = 'blue' | 'yellow' | 'green' | 'pink' | 'purple' | 'orange';
export const PASTELS: Pastel[] = ['blue', 'yellow', 'green', 'pink', 'purple', 'orange'];
/** Whole class names, so Tailwind finds them. */
export const PASTEL_CLASS: Record<Pastel, string> = {
  blue: 'bg-pastel-blue text-pastel-blue-fg',
  yellow: 'bg-pastel-yellow text-pastel-yellow-fg',
  green: 'bg-pastel-green text-pastel-green-fg',
  pink: 'bg-pastel-pink text-pastel-pink-fg',
  purple: 'bg-pastel-purple text-pastel-purple-fg',
  orange: 'bg-pastel-orange text-pastel-orange-fg',
};
export const pastelAt = (i: number) => PASTELS[i % PASTELS.length];

export interface Package {
  name: string;
  what: string;
  tag: string;
  color: Pastel;
  /** Not written yet: the version it comes in. */
  comes?: string;
}

/** In the order of the table. */
export const PACKAGES: Package[] = [
  { name: '@rebofiles/core', what: 'The file model: folders, names, versions, the trash and search. No dependencies.', tag: 'No DOM', color: 'blue' },
  { name: '@rebofiles/drive', what: 'The whole drive with no framework, mounted on an element, and the client it is built on.', tag: 'No framework', color: 'yellow' },
  { name: '@rebofiles/react', what: 'The drive as a React component, or as headless hooks, with uploads and previews inside.', tag: 'React', color: 'green' },
  { name: '@rebofiles/server', what: 'The routes, authorize(), signed addresses, the bytes on S3 or a disk and the metadata in SQLite.', tag: 'Node', color: 'pink' },
  { name: '@rebofiles/sync', what: 'A folder of the computer kept as a folder of the drive, both ways, in the desktop app and as a command.', tag: 'Sync', color: 'purple' },
  {
    name: '@rebofiles/mcp',
    what: 'Tools for an AI assistant to list, search, read, write, rename, move and trash files, and with Rebodocs to edit Word documents, with the user’s own rights.',
    tag: 'MCP',
    color: 'orange',
  },
];
/** In the order of the install picker: the one an application installs first. */
export const INSTALL_ORDER = ['@rebofiles/react', '@rebofiles/server', '@rebofiles/core'];

export const npmOf = (name: string) => `https://www.npmjs.com/package/${name}`;

/** The path of each feature's 24 × 24 icon drawn with a stroke, and the version it comes in when it is not here yet; what each says is in lib/i18n.ts, in the same order. */
export const FEATURES: [icon: string, comes?: string][] = [
  ['M12 15V3M7 8l5-5 5 5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'],
  ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'],
  ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5'],
  ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
  ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2'],
  ['M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2zM4 16V5a2 2 0 0 1 2-2h11'],
  ['M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  ['M22 12h-4l-3 9L9 3l-3 9H2'],
  ['M21 8v13H3V8M1 3h22v5H1zM10 12h4'],
  ['M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01'],
  ['M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4'],
  ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'],
  ['M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1 3.7A1.5 1.5 0 0 1 14 22zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01'],
  ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'],
  ['M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01'],
  ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4'],
];
