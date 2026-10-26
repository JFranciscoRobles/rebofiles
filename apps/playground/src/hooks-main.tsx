// The page of a drive built from the hooks alone (HooksDrive.tsx).
// `?as=bea` as on the other pages.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HooksDrive } from './HooksDrive';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HooksDrive user={new URLSearchParams(location.search).get('as') ?? undefined} />
  </StrictMode>,
);
