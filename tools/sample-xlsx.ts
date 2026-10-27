// A small Excel workbook made here, for the tests: two sheets, shared and
// inline strings, a number, a boolean and a cell left empty; its parts
// deflated, as Excel keeps them.

import { crc32, deflateRawSync } from 'node:zlib';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** A zip of these parts, each deflated. */
function zip(parts: [string, string][]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of parts) {
    const raw = Buffer.from(text);
    const packed = deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const sum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

export function sampleXlsx(): Uint8Array {
  return zip([
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
    ],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/><sheet name="Notes &amp; more" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    ],
    [
      'xl/sharedStrings.xml',
      `${XML}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Client</t></si><si><t>Total</t></si><si><r><t>North</t></r><r><t xml:space="preserve">wind</t></r></si></sst>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Paid</t></is></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1250.5</v></c><c r="C2" t="b"><v>1</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>Acme &lt;Ltd&gt;</t></is></c><c r="C4"><f>B2*2</f><v>2501</v></c></row></sheetData></worksheet>`,
    ],
    [
      'xl/worksheets/sheet2.xml',
      `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="B1" t="inlineStr"><is><t>Call them on Monday</t></is></c></row></sheetData></worksheet>`,
    ],
  ]);
}
