# Documents

Word documents from start to end in the drive, all with Rebodocs: made with
**New document**, written in its editor by several people at once, read in
its viewer, and downloaded as a PDF. The bytes are in `storage/documents` on
this computer, apart from the playground's.

```bash
npm run documents   # from the root: http://localhost:5184
```

- Upload → **New document**: an empty
  .docx, named, in the folder one is in, opened in the editor
  (`newDocument={newDocx}`).
- **Several at once.** Each document is a room of Rebodocs' collaboration
  server (`server/collab.ts`, at `/collab`): open it as two people
  (`?as=ana` and `?as=bea`, sharing it with Bea first) and each sees the
  other's caret and what they write. Who may only read it watches. When
  everybody has left, what they wrote is kept as a new version; ⌘S keeps one
  at once.
- **The viewer.** A double click shows a document in its pages, read only,
  with **Open in Rebodocs** to write in it again, **PDF** and Print; the grid
  shows each one's first page.
- **PDF** in the editor's bar too.
- **Compare** in the history of a document: what changed from a version to
  the one now, over its pages.
- **Make a copy**, Starred, the bell, fields of your own in the details
  (`fields="edit"`), shares for a while, and Settings → People for the one
  of this computer.
- **Links**, opened here as `?link=…`; of a folder, one that takes files, or
  only takes them: a request for files, where whoever has it sends them,
  the folder's owner told in the bell.
- **The server makes what the page does not**: a frame of a video (with
  ffmpeg), a PDF's first page and its text, the text of Word documents and
  workbooks, and of pictures by OCR (Tesseract fetches its languages the
  first time); and a file whose bytes are not what its name says is refused.
- **A webhook**: each change POSTed, signed, to `/api/hooks` of this same
  demo, which checks it and writes it in its console (`GET /api/hooks` gives
  the last fifty).
- **Requests from a template**: “Alta de proveedor” and “Expediente de
  cliente” come with it (Settings → Appearance lists them; any request is
  saved as one). Its page shows a QR code of the address to download.
- **Reminders**: a request sent to an email reminds it every few days of what
  is missing, or at once with “Remind now”; the mails are kept at
  `/api/outbox` and written in the console instead of being sent.
- **What came, checked**: a document says the words it should, or is marked
  “Does not say …” in Received; the RFC of a tax certificate is kept as a
  field. A photo that looks blurry is asked again before it goes.
- **What stops being good**: a document may ask until when it is good; its
  owner is told in the bell 15 days before, and asks for it again in one click.
- **Who is who**: Carla, Beto and the teams Jurídico and Ventas are found by
  name where something is shared, from a directory of the demo's (`people`),
  and their names shown for their ids.
- **Who read what**: each file seen or downloaded and each archive, by whom or
  through which link, written in the console (`onRead`), as an audit would
  keep it.

`?lang=es` (or `zh`) shows it in Spanish; `?view=list` starts with the list.
No one signs in: it is for one's own machine. Delete `storage/documents` to
start over.
