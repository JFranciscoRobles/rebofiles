import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { C, Code, DocsPage, Section } from '@/components/docs/DocsPage';
import { REPO } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Your own interface',
  description: 'The hooks of @rebofiles/react, one by one, and a whole drive built from them; and the drive without a framework.',
};

const CONTENTS: [string, string][] = [
  ['provider', 'DriveProvider'],
  ['entries', 'useEntries'],
  ['entry', 'useEntry'],
  ['actions', 'useActions'],
  ['uploads', 'useUploads'],
  ['drive', 'useDrive'],
  ['together', 'With <FileDrive>'],
  ['whole', 'A whole drive'],
  ['vanilla', 'Without React'],
];

/** The screen of the playground that the tests in Chrome go through, shown as it is. */
const WHOLE = readFileSync(join(process.cwd(), '../playground/src/HooksDrive.tsx'), 'utf8');

const PROVIDER = `import { DriveProvider } from '@rebofiles/react';

<DriveProvider base="/api/files" language="es" headers={async () => ({ authorization: \`Bearer \${await token()}\` })}>
  <YourDrive />
</DriveProvider>`;

const ENTRIES = `const { entries, path, loading, error, refresh } = useEntries({ section: 'files', folder: id });
// or { section: 'recent' }, { section: 'shared' }, { section: 'trash' },
//    { section: 'search', query: 'contract', trashed: false }`;

const ENTRY = `const found = useEntry(selected); // null while it loads, or when there is none
if (found) {
  const { entry, path, trashed } = found; // path: the folders it is in, from where it was shared
}`;

const ACTIONS = `const actions = useActions();
await actions.createFolder('Contracts', parent);   // FolderEntry
await actions.rename(id, 'final.docx');            // refused as 409 "name-taken" when taken
await actions.move(id, folder);
await actions.moveToTrash(id); await actions.restore(id);
await actions.deleteForever(id); await actions.emptyTrash();
await actions.restoreVersion(id, versionId);
await actions.upload(file, { parent, onProgress });  // or { file: id } for a new version
await actions.share(id, 'bea', 'editor'); await actions.unshare(id, 'bea');
const { token } = await actions.createLink(id, 7);
const url = await actions.url(id, { inline: true });`;

const UPLOADS = `const { uploads, upload, dismiss } = useUploads();
upload(input.files, folder, (entry) => console.log('up', entry.name));
// uploads: [{ id, name, size, sent, state: 'waiting' | 'sending' | 'done' | 'failed', error? }]`;

const TOGETHER = `<DriveProvider base="/api/files">
  <FileDrive />          {/* the whole drive */}
  <RecentSidebar />      {/* your own, with useEntries({ section: 'recent' }) */}
</DriveProvider>`;

const VANILLA = `import { mountDrive } from '@rebofiles/drive';

const drive = mountDrive(document.getElementById('files')!, { base: '/api/files', theme: 'auto' });
drive.refresh();   // after a change made elsewhere
drive.destroy();`;

const HOOKS: [string, string][] = [
  ['entries', 'What the view has, sorted as the drive sorts: folders first, then by name.'],
  ['path', 'For a folder, the folders from the top down to it, itself included.'],
  ['loading', 'True while the view is asked for, the last one’s entries still shown meanwhile.'],
  ['error', 'What the server refused, as a RequestError with its status and code.'],
  ['refresh', 'Asks every hook under the provider again.'],
];

export default function Hooks() {
  return (
    <DocsPage
      eyebrow="Your own interface"
      title="The drive, from the hooks"
      contents={CONTENTS}
      intro={
        <p>
          <C>&lt;FileDrive&gt;</C> is one screen of the drive. For another, the hooks of <C>@rebofiles/react</C> give what it shows and does, and you draw it: a sidebar of recent files, a picker for
          one document, or a whole drive in your own design. Everything they change, every other hook and drive under the same provider sees.
        </p>
      }
    >
      <Section id="provider" title="DriveProvider">
        <p>
          Holds the client of the server’s routes and the words of the interface, for every hook under it. <C>base</C> is where the routes are; <C>client</C> one of your own instead, as{' '}
          <C>createMemoryClient()</C> for a drive kept in the page; <C>headers</C> what each request to your server carries; <C>language</C> <C>&apos;en&apos;</C> or <C>&apos;es&apos;</C>, or{' '}
          <C>texts</C> of your own.
        </p>
        <Code lang="tsx" code={PROVIDER} />
      </Section>

      <Section id="entries" title="useEntries(view)">
        <p>What a view has, asked again after every change made under the provider.</p>
        <Code lang="tsx" code={ENTRIES} />
        <div className="overflow-hidden rounded-[14px] border border-border">
          {HOOKS.map(([name, what]) => (
            <div key={name} className="grid gap-1 border-t border-border px-4.5 py-3 first:border-t-0 sm:grid-cols-[120px_1fr] sm:gap-5">
              <p className="font-code text-[14px] text-ink">{name}</p>
              <p className="text-[15.5px]">{what}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="entry" title="useEntry(id)">
        <p>One entry as the server says it is now, with its versions, who it is shared with and its links, and where it is; asked again after every change, and null for another id until it comes.</p>
        <Code lang="tsx" code={ENTRY} />
      </Section>

      <Section id="actions" title="useActions()">
        <p>
          Every change, each a promise, each telling the provider when it is done so that every hook asks again. A refusal is a <C>RequestError</C> with the server’s message, which is meant to be
          shown as it is.
        </p>
        <Code lang="tsx" code={ACTIONS} />
      </Section>

      <Section id="uploads" title="useUploads()">
        <p>Files sent one after another, each in parts, with how much has gone of each: for a bar of progress, or a list of what is going up.</p>
        <Code lang="tsx" code={UPLOADS} />
      </Section>

      <Section id="drive" title="useDrive()">
        <p>
          The provider itself: <C>client</C>, every route as a function; <C>t(key, values)</C>, the drive’s words in its language (<C>t(&apos;items&apos;, &#123; n: 3 &#125;)</C>); <C>locale</C>, for{' '}
          <C>formatDate</C> and <C>formatSize</C>; and <C>changed()</C>, to say a change was made some other way, as through <C>client</C>.
        </p>
      </Section>

      <Section id="together" title="With <FileDrive>">
        <p>A drive inside your provider uses it: what is done in the drive, your hooks see, and what your hooks do, the drive shows.</p>
        <Code lang="tsx" code={TOGETHER} />
      </Section>

      <Section id="whole" title="A whole drive">
        <p>
          Sections, a path to go back up, folders, uploads with their progress, details, renaming, versions, the trash and search, in markup and a look of its own: the hooks and nothing else of
          ReboFiles’ interface. It is <a href={`${REPO}/blob/main/apps/playground/src/HooksDrive.tsx`}>apps/playground/src/HooksDrive.tsx</a> as it is, at <C>/headless.html</C> in the playground, and
          a test in Chrome goes through all of it.
        </p>
        <Code lang="tsx" code={WHOLE} file="HooksDrive.tsx" />
      </Section>

      <Section id="vanilla" title="Without React">
        <p>
          The drive <C>&lt;FileDrive&gt;</C> shows is <C>@rebofiles/drive</C>’s, which needs no framework: mount it on an element, from Vue, Svelte, Angular, or a page of plain HTML. It takes what{' '}
          <C>&lt;FileDrive&gt;</C> takes, and <C>onChange</C>, called after each change made from it.
        </p>
        <Code code={VANILLA} />
      </Section>
    </DocsPage>
  );
}
