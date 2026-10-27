# Documents

Word documents from start to end in the drive, all with Rebodocs: made with
**Create document**, written in its editor by several people at once, read in
its viewer, and downloaded as a PDF. The bytes are in `storage/documents` on
this computer, apart from the playground's.

```bash
npm run documents   # from the root: http://localhost:5184
```

- **Create document** over the files, or New → **New document**: an empty
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
- Fields of your own in the details (`fields="edit"`), Starred, the bell.

`?lang=es` (or `zh`) shows it in Spanish; `?view=list` starts with the list.
No one signs in: it is for one's own machine. Delete `storage/documents` to
start over.
