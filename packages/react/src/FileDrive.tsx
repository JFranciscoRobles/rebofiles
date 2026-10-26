// The whole drive in React: the one of @rebofiles/drive, mounted on an
// element, with the client and the language of the `DriveProvider` it is in.
// Nothing of its own but that: a change made in it tells the provider, so the
// hooks of the rest of the page ask again; one made through the hooks tells
// it, so it asks again.

import { type DriveOptions, type MountedDrive, mountDrive } from '@rebofiles/drive';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DriveProvider, type DriveProviderProps, useDrive, useOuterDrive } from './headless';

export interface FileDriveProps extends Omit<DriveProviderProps, 'children'>, Omit<DriveOptions, 'base' | 'client' | 'headers' | 'language' | 'texts' | 'logo' | 'onChange'> {
  /** What goes before the title; ReboFiles' mark unless given. */
  logo?: ReactNode;
}

export function FileDrive({ base, client, headers, language, texts, ...props }: FileDriveProps) {
  // Inside a provider of the application's, the drive is that one's, and so are its client and its language.
  if (useOuterDrive() && !base && !client) return <Mounted {...props} />;
  return (
    <DriveProvider base={base} client={client} headers={headers} language={language} texts={texts}>
      <Mounted {...props} />
    </DriveProvider>
  );
}

function Mounted({ logo, ...options }: Omit<FileDriveProps, keyof Omit<DriveProviderProps, 'children'>>) {
  // The application's own texts, if any, and its language under the settings, which the drive reads itself.
  const { client, revision, changed, ownTexts: texts, givenLanguage: language } = useDrive();
  const box = useRef<HTMLDivElement>(null);
  const drive = useRef<MountedDrive | null>(null);
  // Where a logo of React's goes inside the drive, which has no React of its own.
  const [slot] = useState(() => (typeof document === 'undefined' ? null : document.createElement('span')));
  // A change the drive made, which the provider is told of and need not tell the drive back.
  const own = useRef(false);
  const latest = useRef(options);
  latest.current = options;

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted again only for another client; the rest is given with update, below
  useEffect(() => {
    if (!box.current) return;
    const mounted = mountDrive(box.current, {
      ...latest.current,
      client,
      texts,
      language,
      logo: logo ? (slot ?? undefined) : undefined,
      onChange: () => {
        own.current = true;
        changed();
      },
    });
    drive.current = mounted;
    return () => {
      mounted.destroy();
      drive.current = null;
    };
  }, [client]);

  useEffect(() => {
    drive.current?.update({ ...options, texts, language, logo: logo ? (slot ?? undefined) : undefined });
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again when the provider's revision goes up, and only then
  useEffect(() => {
    if (own.current) own.current = false;
    else drive.current?.refresh();
  }, [revision]);

  return (
    <>
      <div ref={box} style={{ display: 'contents' }} />
      {logo && slot && createPortal(logo, slot)}
    </>
  );
}
