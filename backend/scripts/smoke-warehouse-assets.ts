/**
 * Warehouse nakladnoy template assets ustida "repair"ga olib keladigan
 * eng ko'p uchraydigan muammolarni avtomatik tekshiradi:
 * - pageSetup DPI: 4294967295
 * - invalid single-cell merge: mergeCell ref="C2:C2"
 * - XML control characters (0x00-0x1F minus tab/newline/carriage return)
 *
 * Ishga tushirish:
 *   cd backend && npx tsx scripts/smoke-warehouse-assets.ts
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

// backend/scripts => backend/assets
const ASSET_DIRS = [
  join(__dirname, "../assets/nakladnoy/warehouse"),
  join(__dirname, "../assets/nakladnoy/loading"),
  join(__dirname, "../assets/nakladnoy/consignment")
];

const BAD_DPI = "4294967295";

const FORBIDDEN_XML_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
const SINGLE_CELL_MERGE_REF = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;
const DPI_RE = /(?:horizontalDpi|verticalDpi)=["']4294967295["']/g;

function sheetXmlFilesInZip(zip: JSZip): string[] {
  const names = Object.keys(zip.files);
  return names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
}

async function main() {
  let failures = 0;
  let total = 0;

  for (const ASSETS_DIR of ASSET_DIRS) {
    if (!existsSync(ASSETS_DIR)) continue;
    const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".xlsx"));

    for (const file of files) {
      total++;
      const p = join(ASSETS_DIR, file);
    const buf = readFileSync(p);
    const zip = await JSZip.loadAsync(buf);

    const sheetXmls = sheetXmlFilesInZip(zip);
    let fileFailures = 0;

    for (const sheet of sheetXmls) {
      const xml = await zip.file(sheet)!.async("string");

      if (DPI_RE.test(xml)) {
        fileFailures++;
        console.log(`[FAIL] ${file} ${sheet}: bad dpi 4294967295 found`);
      }

      const m = xml.match(SINGLE_CELL_MERGE_REF) ?? [];
      if (m.length > 0) {
        fileFailures++;
        console.log(`[FAIL] ${file} ${sheet}: single-cell merges found count=${m.length}`);
      }

      if (FORBIDDEN_XML_CONTROL_CHARS.test(xml)) {
        fileFailures++;
        console.log(`[FAIL] ${file} ${sheet}: forbidden XML control chars found`);
      }
    }

      if (fileFailures > 0) failures++;
      else console.log(`[OK] ${file}: sheets=${sheetXmls.length}`);
    }
  }

  if (total === 0) {
    console.log("No xlsx templates found in asset dirs");
    return;
  }

  if (failures > 0) {
    console.error(`Smoke check finished with failures files=${failures}`);
    process.exit(1);
  }

  console.log(`Smoke check: all ${total} assets look good`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

