// `npm run sample -- out.docx`: the sample document of tools/sample-docx.ts, written to a file.

import { writeFileSync } from 'node:fs';
import { sampleDocx } from './sample-docx';

const target = process.argv.slice(2).find((arg) => arg !== '--');
if (!target) throw new Error('Say where to write it: npm run sample -- out.docx');
writeFileSync(target, sampleDocx());
