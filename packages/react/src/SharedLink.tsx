// What someone who was sent a link sees, without signing in: the one of
// @rebofiles/drive, mounted on an element. It is apart from <FileDrive>, as
// the page that shows it is most often apart too.

import { type SharedLinkOptions, mountSharedLink } from '@rebofiles/drive';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SharedLinkProps extends Omit<SharedLinkOptions, 'logo'> {
  logo?: ReactNode;
}

export function SharedLink({ base, token, language, texts, logo, theme, className, checkBlur }: SharedLinkProps) {
  const box = useRef<HTMLDivElement>(null);
  const [slot] = useState(() => (typeof document === 'undefined' ? null : document.createElement('span')));
  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted again for another link or other words; the logo goes through its slot
  useEffect(() => {
    if (!box.current) return;
    const mounted = mountSharedLink(box.current, { base, token, language, texts, theme, className, checkBlur, logo: logo ? (slot ?? undefined) : undefined });
    return () => mounted.destroy();
  }, [base, token, language, texts, theme, className, checkBlur]);
  return (
    <>
      <div ref={box} style={{ display: 'contents' }} />
      {logo && slot && createPortal(logo, slot)}
    </>
  );
}
