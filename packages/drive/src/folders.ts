// Folders of the computer, dropped on the drive or chosen to upload: every
// file in them with the path it has inside, and every folder, the empty ones
// too, so the drive can make them as they were before their files go up.

export interface Picked {
  /** Each file, and the folders it is in from the one dropped: `Photos/2026/house.jpg`. */
  files: { file: File; path: string }[];
  /** Every folder, the dropped one first and each before those inside it: `Photos`, `Photos/2026`. */
  folders: string[];
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(done: (file: File) => void, fail: (error: unknown) => void): void;
  createReader?(): { readEntries(done: (entries: FsEntry[]) => void, fail: (error: unknown) => void): void };
}

/** What was dropped: the files, and the folders with all that is in them. */
export async function readDropped(transfer: DataTransfer): Promise<Picked> {
  const picked: Picked = { files: [], folders: [] };
  // Taken all at once: the list goes once the drop is over.
  const entries = [...transfer.items].map((item) => item.webkitGetAsEntry?.() as FsEntry | null);
  const loose = [...transfer.files];
  if (!entries.some((entry) => entry?.isDirectory)) return { files: loose.map((file) => ({ file, path: file.name })), folders: [] };
  const walk = async (entry: FsEntry, path: string): Promise<void> => {
    if (entry.isFile && entry.file) {
      const file = await new Promise<File>((done, fail) => entry.file!(done, fail));
      picked.files.push({ file, path });
    } else if (entry.isDirectory && entry.createReader) {
      picked.folders.push(path);
      const reader = entry.createReader();
      // A reader gives some at a time, as many calls as it takes, an empty list at the end.
      for (let some = await new Promise<FsEntry[]>((done, fail) => reader.readEntries(done, fail)); some.length; some = await new Promise<FsEntry[]>((done, fail) => reader.readEntries(done, fail)))
        for (const inside of some) await walk(inside, `${path}/${inside.name}`);
    }
  };
  for (const entry of entries) if (entry) await walk(entry, entry.name);
  return picked;
}

/** The files a folder was chosen for (`<input webkitdirectory>`), each with the path it has inside. */
export function readChosen(files: FileList | File[]): Picked {
  const picked: Picked = { files: [], folders: [] };
  const folders = new Set<string>();
  for (const file of files) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    picked.files.push({ file, path });
    const parts = path.split('/').slice(0, -1);
    for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  }
  picked.folders = [...folders].sort((a, b) => a.split('/').length - b.split('/').length);
  return picked;
}
