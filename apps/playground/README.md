# Playground

The drive on this computer: the bytes in a folder of the disk, the entries
in SQLite, the page and the backend in one process. The tests in Chrome go
through it.

```bash
npm run dev    # from the root: http://localhost:5180
```

Everything goes into `storage/` at the root of the repository, which git
leaves out: `storage/files` has the bytes, each file under its id,
`storage/drive.sqlite` the folders, names and versions. Delete it to start
over.

## In its address

- `?as=bea`: the drive as Bea sees it, to share with her and look. Without
  it, it is the one of this computer, who alone may configure the drive.
- `?lang=es` (or `zh`), `?theme=dark` (or `auto`), `?view=grid`: without
  them, the drive's settings say.
- `?link=…`: what a link of the drive reads, its password asked first when it
  has one; of a request for files, where to send them.
- `?chrome=0`: the drive without its own bar and sections, inside a bar of an
  application's (`chrome={false}`): its sections, search, New folder, Request
  files and Share drive it, and it tells the bar where it is (`onState`).
  `&root=<id>` keeps it in that folder, as the files of one record.
- `?retries=0`: a cut upload given up at once, for its "Try again" to be
  seen.

## Beside it

- `/headless.html`: a whole drive built from the hooks of
  `@rebofiles/react` alone (`src/HooksDrive.tsx`), with its own markup and
  look.
- `/vanilla.html`: the drive with no framework, `mountDrive` of
  `@rebofiles/drive`.
- `/api/mcp`: the tools for an assistant, as the person `x-user` says:
  `claude mcp add --transport http rebofiles http://localhost:5180/api/mcp`.

Word documents are made, previewed, shown in their pages, compared between
versions and opened in Rebodocs, each save a new version; files take fields
of one's own. The server makes a PDF's first page and its text.

## Who may do what

No one signs in: whoever the page says it is (`?as=`) is who asks. What each
may do is `byRoles`, from the drive itself: an entry's owner may do
everything with it, and those it is shared with what their role allows. It is
for one's own machine:
`server/dev.ts` is where a site would say who is asking.

What the server can do besides is on in `apps/documents` (requests for files
from templates, reminders, a webhook, a directory of people) and
`apps/storage` (a real bucket); this one is kept small, as the tests start
from it.
