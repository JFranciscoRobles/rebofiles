# Playground

The drive on this computer: the bytes in a folder of the disk, the entries
in SQLite, the page and the backend in one process.

```bash
npm run dev    # from the root: http://localhost:5180
```

Everything goes into `storage/` at the root of the repository, which git
leaves out: `storage/files` has the bytes, each file under its id,
`storage/drive.sqlite` the folders, names and versions. Delete it to start
over.

`?lang=es` shows the drive in Spanish; `?view=grid` starts with the grid.

No one signs in, and everyone may do everything: it is for one's own
machine. `server/dev.ts` is where a site would say who is asking and what
they may do.
