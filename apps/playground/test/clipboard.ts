// What the drive copies, read back as each browser lets a test: what it gives
// the clipboard is kept on the page too, so Chrome, WebKit and Firefox are read
// the same way, without the permissions only Chrome has.

import type { Page } from '@playwright/test';

/** Before the page opens: what it copies kept as `window.copied`, and still given to the clipboard where it may be. */
export const watchClipboard = (page: Page) =>
  page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    const write = clipboard?.writeText?.bind(clipboard);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        ...clipboard,
        writeText: async (text: string) => {
          (window as unknown as { copied?: string }).copied = text;
          await write?.(text).catch(() => undefined);
        },
      },
    });
  });

/** What the page copied last. */
export const copied = (page: Page) => page.evaluate(() => (window as unknown as { copied?: string }).copied ?? '');
