/**
 * Lalaku 5.2.0 shablonida OOXML paket noto‘g‘ri — ExcelJS o‘qiy olmaydi.
 * Bir martalik tuzatish: [Content_Types], _rels, workbook.xml.rels, docProps/core.xml.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

const ASSET = join(__dirname, "../assets/nakladnoy/loading/520-zagruz-5.2.0.xlsx");

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

/** workbook.xml dagi sheet `r:id="rId2"` bilan mos */
const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Lalaku/EPPlus `x:` prefiks — ExcelJS faqat default namespace bilan ishlaydi. */
function normalizeSpreadsheetXml(xml: string, rootTag: string): string {
  let s = xml;
  if (s.includes(`xmlns:x="${MAIN_NS}"`)) {
    s = s.replace(`xmlns:x="${MAIN_NS}"`, `xmlns="${MAIN_NS}"`);
  } else if (!s.includes(`xmlns="${MAIN_NS}"`) && s.includes(`<x:${rootTag}`)) {
    s = s.replace(`<x:${rootTag}`, `<${rootTag} xmlns="${MAIN_NS}"`);
  }
  s = s.replace(/<(\/?)x:/g, "<$1");
  return s;
}

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <bookViews><workbookView activeTab="0"/></bookViews>
  <sheets><sheet name="Загруз 5.2.0" sheetId="1" r:id="rId2"/></sheets>
  <calcPr calcId="171027"/>
</workbook>`;

const CORE_PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SALESDOC</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-05-26T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-26T00:00:00Z</dcterms:modified></cp:coreProperties>`;

const APP_PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Загруз 5.2.0</vt:lpstr></vt:vector></TitlesOfParts>
  <Company></Company>
  <Manager></Manager>
</Properties>`;

async function main() {
  const zip = await JSZip.loadAsync(readFileSync(ASSET));
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
  zip.file("xl/workbook.xml", WORKBOOK_XML);
  zip.file("docProps/core.xml", CORE_PROPS);
  zip.file("docProps/app.xml", APP_PROPS);

  for (const part of [
    "xl/worksheets/sheet1.xml",
    "xl/styles.xml",
    "xl/sharedStrings.xml"
  ]) {
    const f = zip.file(part);
    if (!f) continue;
    const raw = await f.async("string");
    const root =
      part.includes("worksheet") ? "worksheet" : part.includes("styles") ? "styleSheet" : "sst";
    zip.file(part, normalizeSpreadsheetXml(raw, root));
  }

  zip.remove("package/services/metadata/core-properties/2a1d9c98f42f474a85e03ede1c2be0c4.psmdcp");

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(ASSET, out);
  console.log(`[OK] repaired ${ASSET} (${out.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
