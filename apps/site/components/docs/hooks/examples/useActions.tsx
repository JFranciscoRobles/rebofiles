'use client';

import { useActions, useEntry } from '@rebofiles/react';

export default function Toolbar({ id }: { id: string }) {
  const actions = useActions();
  const found = useEntry(id);
  if (!found) return null;
  const { entry, trashed } = found;
  return (
    <div>
      <p>
        {entry.name}
        {trashed && ' (in the trash)'}
      </p>
      <button type="button" onClick={() => actions.rename(id, `final-${entry.name}`)}>
        Rename
      </button>
      <button type="button" onClick={() => actions.star(id)}>
        Star
      </button>
      <button type="button" onClick={() => actions.copy(id)}>
        Make a copy
      </button>
      <button type="button" onClick={() => actions.setFields(id, { reviewed: 'yes' })}>
        Mark reviewed
      </button>
      {trashed ? (
        <button type="button" onClick={() => actions.restore(id)}>
          Restore
        </button>
      ) : (
        <button type="button" onClick={() => actions.moveToTrash(id)}>
          Move to trash
        </button>
      )}
    </div>
  );
}
