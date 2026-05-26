/**
 * Tests whether ExcelJS load+write (no fill) corrupts warehouse templates.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { repairWorkbookAfterExcelJsLoad } from "../src/modules/orders/warehouse-templates/warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "../src/modules/orders/warehouse-templates/warehouse-template-zip-patch";

const assetPath = join(__dirname, "../assets/nakladnoy/warehouse/110-wh-1.1.xlsx");
const outDir = join(__dirname, "audit-output/roundtrip");
mkdirSync(outDir, { recursive: true });

async function sheetXmlSummary(buf: Buffer, label: string) {
  const zip = await JSZip.loadAsync(buf);
  for (const sheet of ["sheet1.xml", "sheet2.xml", "sheet3.xml"]) {
    const f = zip.file(`xl/worksheets/${sheet}`);
    if (!f) {
      console.log(`${label}: no ${sheet}`);
      continue;
    }
    const xml = await f.async("string");
    const lines = xml.split(/\r?\n/);
    const l2 = lines[1] ?? "";
    const badDpi = xml.includes("4294967295");
    console.log(`${label} ${sheet} badDpi=${badDpi} L2=${l2.slice(0, 80)}`);
    // common corruption markers
    if (xml.includes('mergeCell ref="') && /mergeCell ref="([A-Z]+)(\d+):\1\2"/i.test(xml)) {
      console.log(`  WARN single-cell merges in output`);
    }
    if (!xml.includes("<sheetData")) console.log(`  WARN no sheetData`);
    const worksheetOpen = lines[0] + "\n" + lines[1];
    if (!worksheetOpen.includes('xml:space="preserve"') && label.includes("asset")) {
      console.log(`  asset missing preserve?`);
    }
  }
  const wbXml = await zip.file("[Content_Types].xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  const sheetCount = (rels?.match(/worksheets\/sheet/g) ?? []).length;
  console.log(`${label}: sheets in rels=${sheetCount}`);
}

async function main() {
  const raw = readFileSync(assetPath);
  await sheetXmlSummary(raw, "asset-raw");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(raw as never);
  console.log(
    "loaded worksheets:",
    wb.worksheets.map((w) => ({ id: w.id, name: w.name, rows: w.rowCount, cols: w.columnCount }))
  );

  repairWorkbookAfterExcelJsLoad(wb);
  const rtBuf = await patchWarehouseXlsxBuffer(
    Buffer.from(await wb.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true }))
  );
  writeFileSync(join(outDir, "roundtrip-fixed.xlsx"), rtBuf);
  await sheetXmlSummary(rtBuf, "roundtrip-fixed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
