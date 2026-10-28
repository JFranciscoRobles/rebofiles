'use client';

import { useComments } from '@rebofiles/react';
import { useState } from 'react';

export default function Remarks({ id }: { id: string }) {
  const { comments, add, resolve } = useComments(id);
  const [text, setText] = useState('');
  return (
    <div>
      <ul>
        {comments.map((c) => (
          <li key={c.id} style={{ marginLeft: c.replyTo ? 16 : 0, opacity: c.resolved ? 0.5 : 1 }}>
            <b>{c.by}</b> {c.text}
            {!c.replyTo && (
              <button type="button" onClick={() => resolve(c.id, !c.resolved)}>
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => (e.preventDefault(), text.trim() && add(text.trim()).then(() => setText('')))}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something" aria-label="Comment" />
        <button type="submit">Comment</button>
      </form>
    </div>
  );
}
