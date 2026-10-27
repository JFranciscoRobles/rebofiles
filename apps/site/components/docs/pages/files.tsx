// Files: how they go up, how they are shown, found, kept, downloaded together,
// and Word documents with Rebodocs.

import { hrefOf } from '@/lib/site';
import { C, Code, type DocPage, List, P, Table } from '../ui';
import { DERIVE_CODE, OCR_CODE } from './team';

export const RESUME = `// A file cut halfway, or left when the page closed, is uploaded again:
await client.upload(file, { parent });  // asks the server what arrived, sends the rest`;

export const QUEUE = `const { uploads, summary } = useUploads({ check: true });
// summary.remaining: seconds until all are up, at the speed all go at together
// uploads[i].remaining: the same, of one`;

export const uploads: DocPage = {
  title: 'Uploads',
  description: 'Straight to the bucket in parts, three files at once with the time each has left, whole folders, resumed after a cut, and the same file asked about before it goes.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: (
    <>By the button, by dropping files, or a whole folder of the computer. The browser sends the bytes straight to the bucket; the server only signs where to, checks what arrived, and lists it.</>
  ),
  tip: 'tip: drop a whole folder on the drive',
  sections: [
    {
      id: 'in-parts',
      title: 'In parts, to the bucket',
      badge: 'How',
      color: 'blue',
      lead: 'A file larger than 8 MiB goes in parts, each to an address signed for its exact length, a few at once.',
      body: (
        <List
          items={[
            <>
              <C>POST /uploads</C> says where to send each part; the parts go to the bucket; <C>POST /uploads/finish</C> puts them together, and the server checks the size that arrived before the file
              is listed.
            </>,
            <>
              A part that fails is tried again, five times with a longer wait each, from what arrived. Files of up to 5 GiB unless <C>maxSize</C> says otherwise.
            </>,
            <>The bucket must expose ETag in its rule of origins: the page reads it from each part, and the server needs it to put them together.</>,
          ]}
        />
      ),
    },
    {
      id: 'the-panel',
      title: 'The panel of uploads',
      badge: 'Watch',
      color: 'green',
      lead: 'Three files at once; each says how much has gone, how fast and how long it has left, and so does all of it together.',
      body: (
        <>
          <P>
            One is stopped, and what of it arrived taken away; one that failed is tried again from what arrived. The speed is that of the last few seconds, so a time left follows a change without
            jumping at every jolt.
          </P>
          <Code lang="tsx" code={QUEUE} />
        </>
      ),
    },
    {
      id: 'resumed',
      title: 'Resumed after a cut',
      badge: 'Resume',
      color: 'yellow',
      lead: 'An upload cut, or left when the page closed, goes on from where it was when the same file is uploaded again to the same place.',
      body: (
        <>
          <Code code={RESUME} />
          <P>
            The page remembers it in <C>localStorage</C> for a day, as long as the server keeps the parts. One never gone on with waits in the bucket for a lifecycle rule (“abort incomplete multipart
            uploads after 1 day”).
          </P>
        </>
      ),
    },
    {
      id: 'folders',
      title: 'Whole folders',
      badge: 'Folders',
      color: 'purple',
      body: <P>Dropped on the drive, or chosen with “Upload a folder”, a folder goes up with all that is in it: its folders made top down, the empty ones too, “(2)” for a name taken there.</P>,
    },
    {
      id: 'the-same-file',
      title: 'The same file, asked about',
      badge: 'Duplicates',
      color: 'pink',
      lead: 'Before each file goes, it is looked for in the drive.',
      body: (
        <>
          <Table
            label="What is asked"
            code={[]}
            columns={['Found', 'Asked']}
            rows={[
              ['The same bytes, anywhere one may read', 'Upload anyway, or skip.'],
              ['A file of its name where it goes', 'Replace it (a new version of it), keep both (“(2)”), or skip.'],
            ]}
          />
          <P>
            The bytes are told by a SHA-256 made in the page, for files of up to 64 MiB, kept with the version (<C>POST /duplicates</C> finds it). “Do the same for all the others” answers every one of
            a kind at once. <C>checkUploads=&#123;false&#125;</C> uploads without asking.
          </P>
        </>
      ),
    },
    {
      id: 'what-goes-with-it',
      title: 'What goes with it',
      badge: 'After',
      color: 'orange',
      lead: 'Made in the page and sent after the file, which is up whether or not they are.',
      body: (
        <List
          items={[
            <>
              Of a picture, copies in the drive’s four sizes and a placeholder of a few pixels: <a href={hrefOf('previews')}>Previews</a>.
            </>,
            <>
              Of a text file or a Word document, what is written in it: <a href={hrefOf('search')}>Search</a>.
            </>,
          ]}
        />
      ),
    },
  ],
};

export const SIZES = `createDriveHandler({
  ...options,
  // Or from the settings of the drive, under Pictures.
  settings: { images: { enabled: true, sizes: [160, 480, 1024, 2048], format: 'jpeg', quality: 0.85 } },
});`;

export const previews: DocPage = {
  title: 'Previews and the viewer',
  description: 'What the details show, the viewer over the drive, pictures in four sizes and blurred while they come, and addresses good for an hour.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: <>The details show a file in small; a double click or Enter shows it whole, over the drive, with ← and → to the next.</>,
  sections: [
    {
      id: 'what-is-shown',
      title: 'What is shown',
      badge: 'Kinds',
      color: 'blue',
      body: (
        <Table
          label="Kinds shown"
          code={[]}
          columns={['Kind', 'In the details', 'In the viewer']}
          rows={[
            ['Pictures', 'The smallest copy that fills it', 'Fit to the window, a click for the actual size'],
            ['Word documents', 'Title and first paragraphs, or the first page', 'Page by page, or all; Rebodocs’ zoom; print'],
            ['PDF', 'Its first page, by the browser', 'The browser’s own'],
            ['Video, audio', '—', 'Played'],
            ['Excel workbooks (.xlsx)', 'Its first rows, on its card', 'Each sheet as a table'],
            ['Text, Markdown, CSV, JSON, code', 'The start of it', 'Whole, up to a size'],
          ]}
        />
      ),
    },
    {
      id: 'pictures-in-sizes',
      title: 'Pictures in four sizes',
      badge: 'Renditions',
      color: 'green',
      lead: 'As a picture is uploaded, the page makes copies of it for the sizes of the drive’s settings, as JPEG unless it says to keep the type; the original stays as it came.',
      body: (
        <>
          <Code code={SIZES} />
          <P>
            The grid reads the 160 or the 480, the details the 480, the viewer the 2048; <C>download?size=</C> gives the smallest that shows a picture at a size.
          </P>
        </>
      ),
    },
    {
      id: 'blurred-while-they-come',
      title: 'Blurred while they come',
      badge: 'Placeholder',
      color: 'purple',
      body: (
        <P>
          A tiny copy of each picture, 16 pixels on its longest side and a few hundred bytes as a <C>data:</C> URL, is kept with its version. The grid, the details and the viewer show it blurred where
          the picture will be, under it, until it has come. Of a Word document, the same of its first page.
        </P>
      ),
    },
    {
      id: 'addresses',
      title: 'Addresses good for an hour',
      badge: 'Cache',
      color: 'yellow',
      body: (
        <P>
          An address to show a file in the page is signed from the start of the hour, the same all of it and good for two, with <C>Cache-Control: private, max-age=7200</C>: a browser keeps a thumbnail
          it has read. A grid asks for all of its addresses in one request (<C>POST /urls</C>), and one that went out of date is asked for again.
        </P>
      ),
    },
    {
      id: 'made-by-the-server',
      title: 'Made by the server',
      badge: 'derive',
      color: 'orange',
      lead: 'What comes from no page (an assistant, a sync, a script), and what no page makes (a PDF’s first page): made by the server a moment after it is kept.',
      body: (
        <>
          <Code code={DERIVE_CODE} />
          <List
            items={[
              <>
                <C>pictures()</C>: a picture in the drive’s sizes, never larger than it, and its placeholder, with <C>sharp</C>.
              </>,
              <>
                <C>pdf()</C>: a PDF’s first page drawn, and the text of its first fifty pages for a search, with <C>pdfjs-dist</C> and <C>@napi-rs/canvas</C>.
              </>,
              <>
                <C>docx()</C>, <C>xlsx()</C> and <C>text()</C>: what is written in a Word document, with Rebodocs, in the cells of a workbook, and in a file of text.
              </>,
            ]}
          />
          <P>
            The page says what it makes itself, and the server makes only the rest; each library is asked for when first needed, so only what is used is installed. The page shows what comes, as the
            events tell it.
          </P>
        </>
      ),
    },
    {
      id: 'read-in-pictures',
      title: 'What pictures say',
      badge: 'OCR',
      color: 'pink',
      lead: 'A photo of a receipt, a contract scanned: found by their words, read by Tesseract. Not among those deriveAll() makes unless given, as it fetches the data of a language the first time.',
      body: (
        <>
          <Code code={OCR_CODE} />
          <P>
            <C>ocr()</C> reads a picture, and the first pages of a PDF with no text of its own (after <C>pdf()</C>, which reads those that have it). <C>langPath</C> and <C>cachePath</C> say where the
            data of each language comes from and is kept.
          </P>
        </>
      ),
    },
  ],
};

export const search: DocPage = {
  title: 'Search',
  description: 'By name without minding case or accents, and by what is written in text files and Word documents, with the words found shown in the row.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: <>One box finds by name first, then by what is written in a file. Every word, in any case, with or without accents: “cancion” finds “Canción”.</>,
  sections: [
    {
      id: 'by-name',
      title: 'By name',
      badge: 'Names',
      color: 'blue',
      body: <P>Every word somewhere in the name; one that starts with what was typed first. In the trash, the trash is searched instead.</P>,
    },
    {
      id: 'by-what-is-written',
      title: 'By what is written',
      badge: 'Text',
      color: 'green',
      lead: 'As a file is uploaded, the page reads its text and sends it after it, kept with the version it is of.',
      body: (
        <>
          <List
            items={[
              <>Text files by their type or their name: the first 2 MiB.</>,
              <>
                Word documents with <C>textDocument=&#123;textOfDocx&#125;</C>, by Rebodocs’ engine; Excel workbooks by their cells.
              </>,
              <>
                PDFs, pictures and scans by the server, with <a href={`${hrefOf('previews')}#made-by-the-server`}>derive</a> and <C>ocr()</C>.
              </>,
              <>The first 100,000 characters are kept; a new version without text of its own is not found by the old one’s.</>,
            ]}
          />
          <P>The rows found so show a piece of the text around the words, under their name.</P>
        </>
      ),
    },
    {
      id: 'where-it-is-kept',
      title: 'Where it is kept',
      badge: 'Store',
      color: 'yellow',
      body: (
        <P>
          SQLite keeps the texts in a table of its full-text search (FTS5), Postgres with a <C>tsvector</C> and a GIN index; a store without either, in the memory of the process. The server looks at
          what the store found again, so every store finds the same.
        </P>
      ),
    },
  ],
};

export const SPACE = `createDriveHandler({
  ...options,
  // Or from the settings of the drive, under Storage, for whoever may configure it.
  settings: { quota: 5 * 1024 ** 3, trashDays: 30 },
});`;

export const versions: DocPage = {
  title: 'Versions, trash and space',
  description: 'Every save kept as a version and brought back without its bytes sent again, a trash that empties itself, and a quota for each person.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: <>Nothing is lost by saving or by deleting, until someone says so, or the days the drive keeps it are over.</>,
  sections: [
    {
      id: 'versions',
      title: 'Versions',
      badge: 'Versions',
      color: 'blue',
      body: (
        <P>
          A file uploaded where one of its name is, when “Replace” is chosen, or saved from Rebodocs, is its next version; the one before stays. Restoring one makes it the newest again, as a new
          version with the same bytes, so the storage is not written and the restore too can be undone.
        </P>
      ),
    },
    {
      id: 'the-trash',
      title: 'The trash',
      badge: 'Trash',
      color: 'yellow',
      body: (
        <P>
          A folder goes in with all that is in it, and comes back the same, where it was. Deleting from the trash takes the bytes from the bucket, of every version. ⌘Z, or Undo in the toast, takes
          back the last trash, move, rename or colour.
        </P>
      ),
    },
    {
      id: 'space',
      title: 'Space, and a trash that empties itself',
      badge: 'Quota',
      color: 'green',
      body: (
        <>
          <Code code={SPACE} />
          <P>
            An upload past one’s quota is refused before anything goes (<C>413 over-quota</C>); every version counts, in the trash too. The side of the drive shows the space one uses, of how much. The
            trash is looked at every ten minutes, as requests come, and what has been in it the days said is deleted, its bytes with it.
          </P>
        </>
      ),
    },
  ],
};

export const zip: DocPage = {
  title: 'Download as .zip',
  description: 'Several files, a folder or a link’s folder in one archive, made in the page as the files come, and what could not be read said.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: (
    <>Several picked, or a folder, are downloaded as one .zip. It is made in the page: the server says what goes in it, and each file’s bytes go from the bucket into the archive as they are read.</>
  ),
  sections: [
    {
      id: 'how',
      title: 'How it is made',
      badge: 'How',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <C>POST /zip</C> gives what goes in it: each file, each folder with what is in it, at their paths, what may not be read left out.
            </>,
            <>Text is deflated by the browser’s own CompressionStream; what is compressed already (pictures, PDFs, Word documents) is kept as it is. ZIP64 for one past 4 GiB.</>,
            <>Past 500 MB, where the browser lets a page write a file, it is written to one the person chooses, nothing of it held in the page.</>,
          ]}
        />
      ),
    },
    {
      id: 'what-was-left-out',
      title: 'What was left out',
      badge: 'Missed',
      color: 'yellow',
      body: <P>A file that could not be read is left out, the archive made of the rest, and the toast says how many, with a button to download them on their own.</P>,
    },
    {
      id: 'from-a-link',
      title: 'From a link',
      badge: 'Links',
      color: 'pink',
      body: <P>Someone with a link to a folder downloads it whole, or one of its folders, the same way, without signing in.</P>,
    },
    {
      id: 'in-code',
      title: 'In code',
      badge: 'Code',
      color: 'green',
      body: <Code code={`import { downloadZip } from '@rebofiles/drive';\n\nconst { files, size, missed } = await downloadZip(client, ids, { name: 'Contracts', onProgress, signal });`} />,
    },
  ],
};

export const DOCX = `import { FileDrive } from '@rebofiles/react';
import { pictureOfDocx, previewDocx, textOfDocx, thumbDocx, viewDocx } from '@rebofiles/react/rebodocs'; // needs @rebodocs/core and @rebodocs/viewer

<FileDrive
  base="/api/files"
  previewDocument={previewDocx}   // the details: its first paragraphs
  viewDocument={viewDocx}         // the viewer: its pages, with Rebodocs' zoom
  thumbDocument={thumbDocx}       // the grid, until a picture of it is made
  pictureDocument={pictureOfDocx} // that picture, of its first page, made at upload
  textDocument={textOfDocx}       // what is written in it, to find it by
  onOpenDocument={(file, url) => router.push(\`/documents/\${file.id}\`)}
/>`;

export const SAVE = `import { DocsEditor } from '@rebodocs/react';
import { useActions } from '@rebofiles/react';

const { upload } = useActions();
<DocsEditor docx={bytes} onSave={(docx) => upload(new File([docx], file.name), { file: file.id })} />`;

export const NEW_DOC = `import { newDocx } from '@rebofiles/react/rebodocs';

// "Create document" over the files, and "New document" in New: an empty .docx,
// named by the person, in the folder they are in, and opened with onOpenDocument.
<FileDrive base="/api/files" newDocument={newDocx} viewDocument={viewDocx} onOpenDocument={open} />`;

export const TOGETHER = `import { createCollabServer } from '@rebodocs/collab/server';

// A room for each document of the drive, named by its id: opened from the file,
// kept as a new version of it once everybody has left (apps/documents/server/collab.ts).
const collab = createCollabServer({ storage: roomsOverTheDrive });
app.use('/collab', collab.handle);

<DocsEditor collab={{ url: location.origin, room: file.id, ticket }} onSave={saveAsVersion} />`;

export const word: DocPage = {
  title: 'Word documents',
  description: 'With Rebodocs installed: .docx read by its engine for the details, the viewer, the grid and the search, opened in its editor, and each save a version.',
  source: 'apps/site/components/docs/pages/files.tsx',
  lead: (
    <>
      Rebodocs is an optional peer: with <C>@rebodocs/core</C> and <C>@rebodocs/viewer</C> installed, a .docx is read by its engine and shown in Rebodocs' viewer. Without it, the drive shows a .docx
      as any other file.
    </>
  ),
  sections: [
    { id: 'give-it-rebodocs', title: 'Give it Rebodocs', badge: 'Start', color: 'blue', body: <Code lang="tsx" code={DOCX} /> },
    {
      id: 'open-and-save',
      title: 'Open it, and save it back',
      badge: 'Editor',
      color: 'purple',
      lead: '“Open in Rebodocs” calls onOpenDocument with an address to read the file from; saving it back is an upload of a new version.',
      body: (
        <>
          <Code lang="tsx" code={SAVE} />
          <P>
            The playground does it, in <C>apps/playground/src/Editor.tsx</C>: ⌘S saves, and the drive shows the document as its next version.
          </P>
        </>
      ),
    },
    {
      id: 'create-a-document',
      title: 'Create a document',
      badge: 'New',
      color: 'yellow',
      body: (
        <>
          <Code lang="tsx" code={NEW_DOC} />
          <P>
            <C>newDocument</C> is what makes an empty one: <C>newDocx</C> of Rebodocs, or a template of yours. Without <C>onOpenDocument</C>, the new document opens in the viewer.
          </P>
        </>
      ),
    },
    {
      id: 'as-a-pdf',
      title: 'As a PDF',
      badge: 'PDF',
      color: 'orange',
      body: (
        <P>
          The viewer of a Word document has <strong>PDF</strong> beside Print: made in the page by Rebodocs, from the pages shown, and downloaded (<C>pdf()</C> of what <C>viewDocx</C> gives). The
          editor makes one too, with <C>editor.exportPdf()</C>.
        </P>
      ),
    },
    {
      id: 'together',
      title: 'Several people at once',
      badge: 'Collab',
      color: 'pink',
      lead: 'With Rebodocs’ collaboration server, each document of the drive is a room: whoever opens it writes with the others at once, each with a caret of their own, and who may only read it watches.',
      body: (
        <>
          <Code lang="tsx" code={TOGETHER} />
          <P>
            The demo of documents (<C>npm run documents</C>, <C>apps/documents</C>) does it whole: the rooms over the drive, a ticket signed for each person from what they may do with the file, and a
            version kept when everybody leaves.
          </P>
        </>
      ),
    },
    {
      id: 'for-an-assistant',
      title: 'For an assistant',
      badge: 'MCP',
      color: 'green',
      body: (
        <P>
          With Rebodocs installed beside <C>@rebofiles/mcp</C>, Claude reads and edits the drive’s Word documents with Rebodocs’ own tools, each change saved as a version:{' '}
          <a href={hrefOf('assistants')}>AI assistants</a>.
        </P>
      ),
    },
  ],
};
