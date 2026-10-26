// Word documents previewed with Rebodocs' engine: the title and the first
// paragraphs, as a small page. Apart from the rest of the package, so that a
// drive without Rebodocs does not carry its engine.
//
//   import { previewDocx } from '@rebofiles/drive/rebodocs';
//   mountDrive(element, { previewDocument: previewDocx });

import { importDocx, outline, paragraphText } from '@rebodocs/core';
import type { DocumentPreview } from './kinds';

/** How many paragraphs a preview shows, at most. */
const SHOWN = 8;

export function previewDocx(bytes: Uint8Array): DocumentPreview {
  const doc = importDocx(bytes);
  const texts = doc.paragraphs.map((p) => paragraphText(p).replace(/\s+/g, ' ').trim());
  // The title is the first heading at the top level, or else the first line with text.
  const heading = outline(doc).find((item) => item.level <= 1);
  const titlePara = heading?.para ?? texts.findIndex(Boolean);
  const title = titlePara >= 0 ? texts[titlePara] : '';
  const paragraphs = texts.filter((text, i) => text && i !== titlePara).slice(0, SHOWN);
  return { title, paragraphs };
}
