// Folders of the computer, as a drop gives them and as a chosen folder does:
// every file with its path inside, and every folder, the empty ones too.

import { describe, expect, it } from 'vitest';
import { readChosen, readDropped } from '../src/folders';

type Node = { name: string; files?: Node[] } | { name: string; text: string };
/** An entry of the browser's file system, as `webkitGetAsEntry` gives one, reading a few at a time as a real one does. */
function entry(node: Node): unknown {
  if ('text' in node) return { isFile: true, isDirectory: false, name: node.name, file: (done: (f: File) => void) => done(new File([node.text], node.name)) };
  const inside = (node.files ?? []).map(entry);
  return {
    isFile: false,
    isDirectory: true,
    name: node.name,
    createReader: () => {
      let at = 0;
      return { readEntries: (done: (e: unknown[]) => void) => done(inside.slice(at, (at += 2))) };
    },
  };
}
const dropOf = (...nodes: Node[]) =>
  ({
    items: nodes.map((node) => ({ webkitGetAsEntry: () => entry(node) })),
    files: nodes.filter((node) => 'text' in node).map((node) => new File([(node as { text: string }).text], node.name)),
  }) as unknown as DataTransfer;

describe('folders of the computer', () => {
  it('dropped, give every file at its path and every folder, the empty ones, read a few at a time', async () => {
    const picked = await readDropped(
      dropOf(
        {
          name: 'Casa Rivera',
          files: [
            { name: 'plano.pdf', text: 'p' },
            {
              name: 'Fotos',
              files: [
                { name: 'a.jpg', text: 'a' },
                { name: 'b.jpg', text: 'b' },
                { name: 'c.jpg', text: 'c' },
              ],
            },
            { name: 'Vacía', files: [] },
          ],
        },
        { name: 'suelto.txt', text: 's' },
      ),
    );
    expect(picked.folders).toEqual(['Casa Rivera', 'Casa Rivera/Fotos', 'Casa Rivera/Vacía']);
    expect(picked.files.map((one) => one.path)).toEqual(['Casa Rivera/plano.pdf', 'Casa Rivera/Fotos/a.jpg', 'Casa Rivera/Fotos/b.jpg', 'Casa Rivera/Fotos/c.jpg', 'suelto.txt']);
  });

  it('dropped with no folder in it, are the files as they came', async () => {
    expect((await readDropped(dropOf({ name: 'a.txt', text: 'a' }))).files.map((one) => one.path)).toEqual(['a.txt']);
  });

  it('chosen, give the folders each file is in, top down', () => {
    const file = (path: string) => Object.assign(new File(['x'], path.split('/').pop()!), { webkitRelativePath: path });
    const picked = readChosen([file('Obra/Planos/1.pdf'), file('Obra/acta.txt'), file('Obra/Planos/Viejos/0.pdf')]);
    expect(picked.folders).toEqual(['Obra', 'Obra/Planos', 'Obra/Planos/Viejos']);
    expect(picked.files.map((one) => one.path)).toEqual(['Obra/Planos/1.pdf', 'Obra/acta.txt', 'Obra/Planos/Viejos/0.pdf']);
  });
});
