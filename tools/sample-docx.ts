// A Word document made in code, for the tests and the playground: a title in
// Word's Heading 1 and a few clauses. `npm run sample -- out.docx` writes it
// (tools/sample.ts).

import { createDoc, exportDocx, insertText, setParagraphStyle, splitParagraph } from '@rebodocs/core';

export function sampleDocx(title = 'Service agreement', clauses = ['The parties agree to what follows.', 'Payment is due within thirty days.', 'Either party may end it in writing.']): Uint8Array {
  let doc = createDoc();
  const lines = [title, ...clauses];
  lines.forEach((line, i) => {
    doc = insertText(doc, { para: i, offset: 0 }, line).doc;
    if (i < lines.length - 1) doc = splitParagraph(doc, { para: i, offset: line.length }).doc;
  });
  return exportDocx(setParagraphStyle(doc, 0, 0, 'Heading1'));
}
