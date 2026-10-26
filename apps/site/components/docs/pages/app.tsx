// Put it in your app: the component, the hooks, the drive with no framework,
// its look, its keys and its words.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, hrefOf } from '@/lib/site';
import { HOOKS, PROPS, type PropGroup } from '../reference';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, withCode } from '../ui';

const GROUPS: PropGroup[] = ['Server', 'Look', 'Files', 'Word documents', 'Events'];
export const propId = (name: string) => `prop-${name}`;
export const hookId = (name: string) => `hook-${name.toLowerCase()}`;

const FILEDRIVE = `'use client';
import { FileDrive } from '@rebofiles/react';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs';

export default function Files() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <FileDrive
        base="/api/files"
        title="Acme Files"
        language="es"
        theme="auto"
        headers={async () => ({ authorization: \`Bearer \${await token()}\` })}
        linkAddress={(token) => \`\${location.origin}/shared?link=\${token}\`}
        previewDocument={previewDocx}
        viewDocument={viewDocx}
        thumbDocument={thumbDocx}
        pictureDocument={pictureOfDocx}
        textDocument={textOfDocx}
      />
    </div>
  );
}`;

const SHARED = `'use client';
import { SharedLink } from '@rebofiles/react';
import { useSearchParams } from 'next/navigation';

export default function Shared() {
  return <SharedLink base="/api/files" token={useSearchParams().get('link') ?? ''} theme="auto" />;
}`;

export const react: DocPage = {
  title: 'React component',
  description: '<FileDrive>: putting it in a page, every prop by what it is for, the link page, and what changing a prop does.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: (
    <>
      <C>&lt;FileDrive&gt;</C> is the whole drive: the search, the sections, the list and the grid, the details, the viewer, uploads, sharing and the settings. It takes the height it is given and asks
      nothing of your CSS.
    </>
  ),
  sections: [
    {
      id: 'put-it-in-a-page',
      title: 'Put it in a page',
      badge: 'Start',
      color: 'purple',
      lead: 'A client component, in an element with a height. With Rebodocs installed, Word documents are read by its engine.',
      body: <Code lang="tsx" code={FILEDRIVE} file="app/files/page.tsx" />,
    },
    ...GROUPS.map((group) => ({
      id: `props-${group.toLowerCase().replace(/\s+/g, '-')}`,
      title: group === 'Word documents' ? 'Props: Word documents' : `Props: ${group.toLowerCase()}`,
      badge: 'Props',
      color: 'yellow' as const,
      body: (
        <RefTable
          label={`Props: ${group}`}
          name="Prop"
          rows={PROPS.filter((prop) => prop.group === group).map((prop) => ({ id: propId(prop.name), name: prop.name, type: prop.type, does: withCode(prop.does) }))}
        />
      ),
    })),
    {
      id: 'the-link-page',
      title: 'The page of a link',
      badge: 'Sharing',
      color: 'pink',
      lead: 'What someone sent a link sees, without signing in: what it reads, its folders, a .zip of them; its password asked first when it has one.',
      body: (
        <>
          <Code lang="tsx" code={SHARED} file="app/shared/page.tsx" />
          <P>
            Point the drive’s links at it with <C>linkAddress</C>.
          </P>
        </>
      ),
    },
    {
      id: 'when-a-prop-changes',
      title: 'When a prop changes',
      badge: 'Know',
      color: 'green',
      body: (
        <List
          items={[
            <>
              <C>language</C>, <C>theme</C>, <C>title</C> and the callbacks are taken as they change, without starting again.
            </>,
            <>
              <C>base</C>, <C>client</C> or <C>headers</C> make the drive’s client again; what was going up goes on with the old one.
            </>,
            <>
              Inside a <C>&lt;DriveProvider&gt;</C> of yours, it uses that one’s client and words: what it does, your hooks see.
            </>,
          ]}
        />
      ),
    },
  ],
};

/** The screen of the playground that the tests in Chrome go through, shown as it is. */
const WHOLE = readFileSync(join(process.cwd(), '../playground/src/HooksDrive.tsx'), 'utf8');

const PROVIDER = `import { DriveProvider } from '@rebofiles/react';

<DriveProvider base="/api/files" language="es" headers={async () => ({ authorization: \`Bearer \${await token()}\` })}>
  <YourDrive />
</DriveProvider>`;

const ENTRIES = `const { entries, path, loading, error, refresh } = useEntries({ section: 'files', folder: id });
// or { section: 'recent' }, { section: 'shared' }, { section: 'trash' },
//    { section: 'search', query: 'contract', trashed: false }`;

const ACTIONS = `const actions = useActions();
await actions.createFolder('Contracts', parent);   // FolderEntry
await actions.rename(id, 'final.docx');            // refused as 409 "name-taken" when taken
await actions.move(id, folder);
await actions.moveToTrash(id); await actions.restore(id);
await actions.restoreVersion(id, versionId);
await actions.upload(file, { parent, onProgress });  // or { file: id } for a new version
const url = await actions.url(id, { inline: true });`;

const UPLOADS = `const { uploads, summary, upload, retry, stop, decide } = useUploads({ check: true });
upload(input.files, folder, (entry) => console.log('up', entry.name));
// uploads: [{ id, name, size, sent, speed?, remaining?, state, conflict?, error? }]
//   state: 'waiting' | 'checking' | 'asking' | 'sending' | 'done' | 'failed' | 'stopped' | 'skipped'
formatDuration(summary.remaining ?? 0, 'en'); // "3 min"
decide(id, 'replace' | 'keep' | 'skip', all?); // one 'asking': there already`;

const TOGETHER = `<DriveProvider base="/api/files">
  <FileDrive />          {/* the whole drive */}
  <RecentSidebar />      {/* your own, with useEntries({ section: 'recent' }) */}
</DriveProvider>`;

export const hooks: DocPage = {
  title: 'Headless: your own UI',
  description: 'The hooks of @rebofiles/react one by one, the drive and your own pieces together, and a whole drive built from the hooks alone.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: <>The component is built from these hooks and nothing else: take them for a drive with your markup and your look, or for a piece of one beside the whole.</>,
  sections: [
    {
      id: 'the-hooks',
      title: 'The hooks',
      badge: 'Reference',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: hookId(hook.name), name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    { id: 'driveprovider', title: 'DriveProvider', badge: 'Provider', color: 'purple', lead: 'The client and the words, for every hook under it.', body: <Code lang="tsx" code={PROVIDER} /> },
    {
      id: 'useentries',
      title: 'useEntries',
      badge: 'Read',
      color: 'blue',
      lead: 'A view of the drive, asked again after every change made through the provider.',
      body: <Code lang="tsx" code={ENTRIES} />,
    },
    { id: 'useactions', title: 'useActions', badge: 'Change', color: 'yellow', lead: 'What changes the drive; each tells every hook after.', body: <Code lang="tsx" code={ACTIONS} /> },
    {
      id: 'useuploads',
      title: 'useUploads',
      badge: 'Upload',
      color: 'orange',
      lead: 'Files sent three at a time, each in parts, with how fast it goes and how long it has left, and the same of all of them.',
      body: <Code lang="tsx" code={UPLOADS} />,
    },
    {
      id: 'with-filedrive',
      title: 'With <FileDrive>',
      badge: 'Together',
      color: 'pink',
      lead: 'A drive inside your provider uses it: what is done in the drive, your hooks see, and what your hooks do, the drive shows.',
      body: <Code lang="tsx" code={TOGETHER} />,
    },
    {
      id: 'a-whole-drive',
      title: 'A whole drive',
      badge: 'Example',
      color: 'green',
      lead: 'Sections, a path, folders, uploads with their progress, details, renaming, versions, the trash and search: the hooks and nothing else.',
      body: (
        <>
          <P>
            It is <a href={`${REPO}/blob/main/apps/playground/src/HooksDrive.tsx`}>apps/playground/src/HooksDrive.tsx</a> as it is, at <C>/headless.html</C> in the playground, and a test in Chrome
            goes through all of it.
          </P>
          <Code lang="tsx" code={WHOLE} file="HooksDrive.tsx" />
        </>
      ),
    },
  ],
};

const VANILLA = `import { mountDrive, mountSharedLink } from '@rebofiles/drive';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/drive/rebodocs';

const drive = mountDrive(document.getElementById('files')!, {
  base: '/api/files',
  theme: 'auto',
  previewDocument: previewDocx,
  viewDocument: viewDocx,
  thumbDocument: thumbDocx,
  pictureDocument: pictureOfDocx,
  textDocument: textOfDocx,
  onChange: () => refreshTheRestOfThePage(),
});

drive.update({ language: 'es' });  // other options, as a framework gives them again
drive.refresh();                   // after a change made elsewhere
drive.destroy();

// What someone sent a link sees:
mountSharedLink(document.getElementById('shared')!, { token: new URLSearchParams(location.search).get('link')! });`;

const QUEUE = `import { createDriveClient, createUploads, formatDuration, lookInDrive } from '@rebofiles/drive';

const client = createDriveClient({ base: '/api/files' });
const uploads = createUploads(client, { check: lookInDrive(client), onChange: draw });
uploads.add(input.files, folderId);
// uploads.items, uploads.summary(): what to draw; stop, retry, decide, dismiss, clear`;

export const vanilla: DocPage = {
  title: 'Without a framework',
  description: 'mountDrive and mountSharedLink of @rebofiles/drive, for a page with no framework or one that is not React; and the pieces under them, on their own.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: (
    <>
      What <C>&lt;FileDrive&gt;</C> mounts is <C>@rebofiles/drive</C>’s, which needs no framework: Vue, Svelte, Angular, or a page of plain HTML. It takes the same options, and renders itself again
      changing only what differs, so the focus and what is scrolled stay where they were.
    </>
  ),
  sections: [
    { id: 'mount-it', title: 'Mount it', badge: 'Start', color: 'purple', body: <Code code={VANILLA} /> },
    {
      id: 'the-pieces',
      title: 'The pieces under it',
      badge: 'Pieces',
      color: 'blue',
      lead: 'Each is exported, for an interface of your own without React.',
      body: (
        <>
          <Table
            label="Pieces"
            columns={['Name', 'What it is']}
            rows={[
              ['createDriveClient', 'One function per route of the server; uploads in parts that resume.'],
              ['createUploads', 'The queue of uploads: three at a time, speed, time left, asking about what is there.'],
              ['lookInDrive', 'What looks for a file in the drive before it goes.'],
              ['readDropped, readChosen', 'The files of folders dropped or chosen, at their paths.'],
              ['downloadZip, writeZip', 'A .zip made in the page, as its files come.'],
              ['renditionsOf, placeholderOf', 'The smaller pictures of an image, and its placeholder.'],
              ['textOf, hashOf', 'What is written in a file, and its SHA-256.'],
              ['CSS, TEXTS, translator', 'The look, scoped to .rf-drive, and the words.'],
            ]}
          />
          <Code code={QUEUE} />
        </>
      ),
    },
  ],
};

const VARS: [string, string][] = [
  ['--rf-brand', 'The colour of what is chosen and of the main buttons; from the brand colour of the settings.'],
  ['--rf-brand-hover, --rf-brand-light', 'Its darker and lighter pairs.'],
  ['--rf-ink, --rf-ink-soft, --rf-muted', 'The text, from the darkest.'],
  ['--rf-bg, --rf-surface, --rf-hover', 'The backgrounds.'],
  ['--rf-border, --rf-border-strong', 'The lines.'],
  ['--rf-danger', 'What deletes.'],
  ['--rf-k-<kind>, --rf-k-<kind>-fg', 'The tile of each kind of file: folder, docx, pdf, sheet, image, text, video, audio.'],
  ['--rf-fc-<colour>, --rf-fc-<colour>-fg', 'The nine colours a folder may be given.'],
  ['--rf-font, --rf-mono', 'The fonts.'],
  ['--rf-radius', 'The corners.'],
];

const THEMED = `.acme-files {
  --rf-brand: #6d28d9;
  --rf-brand-hover: #5b21b6;
  --rf-brand-light: #ede9fe;
  --rf-font: 'Söhne', system-ui, sans-serif;
  --rf-radius: 8px;
}

<FileDrive className="acme-files" theme="auto" />`;

export const styling: DocPage = {
  title: 'Styling and themes',
  description: 'The drive’s look as custom properties: light and dark, the brand colour of the settings, a class of your own, and folder colours.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: (
    <>
      One stylesheet, scoped to <C>.rf-drive</C>, every colour, radius and font a custom property. Each pair of colours reads at 4.5:1 or more, light and dark.
    </>
  ),
  sections: [
    {
      id: 'light-and-dark',
      title: 'Light and dark',
      badge: 'Theme',
      color: 'purple',
      body: (
        <P>
          <C>theme="dark"</C>, <C>"light"</C>, or <C>"auto"</C> as the system is. The drive’s settings give its own, and each person may choose theirs over it; the prop is between the two.
        </P>
      ),
    },
    {
      id: 'the-brand-colour',
      title: 'The brand colour',
      badge: 'Settings',
      color: 'green',
      body: <P>Whoever may configure the drive gives it the colour of the brand in its settings; the drive makes its darker and lighter pairs, and a text on it that reads, for both themes.</P>,
    },
    {
      id: 'custom-properties',
      title: 'Custom properties',
      badge: 'CSS',
      color: 'blue',
      body: (
        <>
          <Table label="Custom properties" columns={['Property', 'What it colours']} rows={VARS.map(([name, what]) => [name, what])} />
          <Code lang="tsx" code={THEMED} />
        </>
      ),
    },
    {
      id: 'your-own-look',
      title: 'A look of your own',
      badge: 'Headless',
      color: 'yellow',
      body: (
        <P>
          For markup and a look that are all yours, Tailwind or anything else, build it from <a href={hrefOf('hooks')}>the hooks</a>.
        </P>
      ),
    },
  ],
};

const KEYS: [string, string][] = [
  ['↑ ↓, Home, End', 'Through the list or the grid.'],
  ['Enter', 'Open: a folder goes into it, a file opens in the viewer.'],
  ['Space, Shift + ↑ ↓, ⌘/Ctrl + A', 'Pick several.'],
  ['F2', 'Rename.'],
  ['Delete, Backspace', 'Into the trash.'],
  ['⌘/Ctrl + Z', 'Undo the last trash, move, rename or colour.'],
  ['Shift + F10, the menu key', 'The menu of what is picked.'],
  ['← →', 'In the viewer: the file before and after.'],
  ['Escape', 'Close the menu, the dialog or the viewer.'],
];

export const accessibility: DocPage = {
  title: 'Keyboard and accessibility',
  description: 'Every action from the keyboard, what a screen reader is told, and how it is checked: axe on every state, light and dark.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: <>Everything the mouse does, the keyboard does too, and a screen reader is told where it is. axe checks every state the browser tests reach, by WCAG 2.2 AA, in both themes.</>,
  sections: [
    { id: 'the-keys', title: 'The keys', badge: 'Keyboard', color: 'purple', body: <Table label="Keys" columns={['Key', 'What it does']} rows={KEYS.map(([key, does]) => [key, does])} /> },
    {
      id: 'what-a-screen-reader-hears',
      title: 'What a screen reader hears',
      badge: 'Screen readers',
      color: 'blue',
      body: (
        <List
          items={[
            'The list is a listbox: each entry is said with its owner, date and size, and how many are picked.',
            'The toast is a status that is read, with its Undo button reached by Tab.',
            'Dialogs keep the focus inside and give it back where it was when they close.',
            'The upload panel is a region; each file has a progress bar named after it, and a failure is an alert.',
            'The colours of a folder are a group of radio buttons, each named.',
          ]}
        />
      ),
    },
    {
      id: 'how-it-is-checked',
      title: 'How it is checked',
      badge: 'Tests',
      color: 'green',
      body: (
        <P>
          <C>npm run test:browser</C> goes through the drive with the keyboard alone, and runs axe on every state: empty and with files, the list and the grid, each dialog, the trash, a search,
          Spanish at the width of a phone, a link signed out, the same in the dark theme, chosen and as the system is.
        </P>
      ),
    },
  ],
};

const SPANISH = `import { FileDrive, TEXTS } from '@rebofiles/react';

<FileDrive language="es" />                               // English and Spanish come with it
<FileDrive texts={{ ...TEXTS.en, myFiles: 'Documents' }} /> // or words of your own`;

export const languages: DocPage = {
  title: 'Languages',
  description: 'The drive in English or Spanish, words of your own, and who chooses: the drive’s settings, the application, and each person.',
  source: 'apps/site/components/docs/pages/app.tsx',
  lead: <>Every word of the drive goes through one table of texts, in English and Spanish, with dates and sizes said as each language says them.</>,
  sections: [
    { id: 'choose-one', title: 'Choose one', badge: 'Start', color: 'purple', body: <Code lang="tsx" code={SPANISH} /> },
    {
      id: 'who-chooses',
      title: 'Who chooses',
      badge: 'Settings',
      color: 'blue',
      body: (
        <P>
          Each person’s own choice first, from the settings of the drive; then the <C>language</C> your application gives; then the drive’s, which whoever may configure it sets.
        </P>
      ),
    },
    {
      id: 'a-language-of-your-own',
      title: 'A language of your own',
      badge: 'Texts',
      color: 'yellow',
      body: (
        <>
          <P>
            <C>texts</C> takes an object with the keys of <C>TEXTS.en</C>; TypeScript says which are missing. Values may have <C>{'{n}'}</C>, <C>{'{name}'}</C> and the like, filled as the English ones
            are.
          </P>
          <Callout title="Errors from the server">are in English: the drive says them as they come. Their code (RequestError.code) is the same in every language, for words of your own.</Callout>
        </>
      ),
    },
  ],
};
