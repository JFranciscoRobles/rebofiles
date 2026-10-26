// What someone who was sent a link sees, without signing in: the folder or the
// file it was made for, its folders to go into, and each file to open or save.
// Nothing can be changed from here. It is its own component, apart from
// <FileDrive>, as the page that shows it is most often apart too.

import type { Entry, EntryId } from '@rebofiles/core';
import { useEffect, useMemo, useState } from 'react';
import { CSS, type LinkListing, RequestError, TEXTS, type Texts, badgeOf, createLinkClient, formatDate, formatSize, kindOf, translator } from '@rebofiles/drive';
import { Icon, Logo } from './icons';

export interface SharedLinkProps {
  /** Where the routes of @rebofiles/server are: `/api/files`. */
  base?: string;
  /** The token of the link, as it came in its address. */
  token: string;
  language?: 'en' | 'es';
  texts?: Texts;
  logo?: React.ReactNode;
  /** Light (the default), dark, or as the system is (`'auto'`). */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function SharedLink({ base = '/api/files', token, language = 'en', texts, logo, theme = 'light', className }: SharedLinkProps) {
  const t = useMemo(() => translator(texts ?? TEXTS[language]), [texts, language]);
  const link = useMemo(() => createLinkClient({ base, token }), [base, token]);
  const [folder, setFolder] = useState<EntryId | undefined>(undefined);
  const [listing, setListing] = useState<LinkListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    link.list(folder).then(
      (found) => live && (setListing(found), setError(null)),
      (failed: unknown) => live && setError(failed instanceof RequestError && failed.status === 404 ? t('linkGone') : String((failed as Error).message ?? failed)),
    );
    return () => {
      live = false;
    };
  }, [link, folder, t]);

  const open = async (file: Entry, save = false) => {
    // A window opened before the address is known, so the browser takes it as the click's.
    const tab = save ? null : window.open('about:blank', '_blank');
    try {
      const url = await link.url(file.id, { inline: !save });
      if (tab) tab.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
      }
    } catch (failed) {
      tab?.close();
      setError((failed as Error).message);
    }
  };

  // A link to one file shows that file as the only row.
  const rows = listing ? (listing.root.kind === 'file' ? [listing.root] : listing.entries) : [];
  return (
    <div className={`rf-drive rf-shared${className ? ` ${className}` : ''}`} data-theme={theme}>
      <style>{CSS}</style>
      <div className="rf-top">
        <div className="rf-title">
          {logo ?? <Logo />}
          <span>{listing?.root.name ?? ''}</span>
        </div>
      </div>
      <div className="rf-body">
        <main className="rf-main">
          {error ? (
            <div className="rf-empty rf-error" role="alert">
              {error}
            </div>
          ) : (
            <>
              <div className="rf-head">
                <div className="rf-crumbs">
                  {/* A link to a file has no folders to go back up: the file is its only row. */}
                  {listing?.root.kind === 'folder' &&
                    listing.path.map((step, i) => (
                      <span key={step.id} style={{ display: 'contents' }}>
                        {i > 0 && <Icon name="chevron" size={16} />}
                        <button type="button" className="rf-crumb" aria-current={step.id === listing.folder.id ? 'page' : undefined} onClick={() => setFolder(i === 0 ? undefined : step.id)}>
                          {step.name}
                        </button>
                      </span>
                    ))}
                </div>
              </div>
              <ul className="rf-items rf-link-rows" aria-label={t('name')}>
                {listing && rows.length === 0 && <li className="rf-empty">{t('emptyFolder')}</li>}
                {rows.map((entry) => (
                  <li key={entry.id} className="rf-row">
                    <button type="button" className="rf-name" onClick={() => (entry.kind === 'folder' ? setFolder(entry.id) : open(entry))}>
                      <span className={`rf-tile rf-k-${kindOf(entry)}`} aria-hidden="true">
                        {entry.kind === 'folder' ? <Icon name="folder" size={16} /> : badgeOf(entry)}
                      </span>
                      <span>{entry.name}</span>
                    </button>
                    <span>{formatDate(entry.modified, language)}</span>
                    <span>{entry.kind === 'file' ? formatSize(entry.versions[0].size, language) : '—'}</span>
                    {entry.kind === 'file' ? (
                      <button type="button" className="rf-btn rf-text" aria-label={`${t('download')} · ${entry.name}`} onClick={() => open(entry, true)}>
                        <Icon name="download" size={16} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
