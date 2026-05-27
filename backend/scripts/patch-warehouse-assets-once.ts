/**
 * One-off patch for Excel template assets stored in `backend/assets/nakladnoy/warehouse`.
 *
 * Fixes:
 * - pageSetup DPI: 4294967295 (Excel repair dialog)
 * - invalid single-cell merges: <mergeCell ref="C2:C2" />
 *
 * Run:
 *   cd backend
 *   npx tsx scripts/patch-warehouse-assets-once.ts
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

const ASSETS_DIR = join(__dirname, "../assets/nakladnoy/warehouse");
const TARGET_FILES = [
  "600-wh-6.0.xlsx",
  "602-wh-6.0.2.xlsx",
  "700-wh-7.0.0.xlsx",
  "701-wh-7.0.1.xlsx",
  "703-wh-7.0.3.xlsx",
  "704-wh-7.0.4.xlsx"
];

const DPI_RE = /(?:horizontalDpi|verticalDpi)=["']4294967295["']/g;
const SINGLE_CELL_MERGE_REF = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;

function sheetXmlFilesInZip(zip: JSZip): string[] {
  const names = Object.keys(zip.files);
  return names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
}

async function patchOne(fullPath: string): Promise<{ changed: boolean; changes: string[] }> {
  const buf = readFileSync(fullPath);
  const zip = await JSZip.loadAsync(buf);
  const sheetXmls = sheetXmlFilesInZip(zip);
  let changed = false;
  const changes: string[] = [];

  for (const sheet of sheetXmls) {
    const xml = await zip.file(sheet)!.async("string");
    let next = xml;

    const dpiHits = (next.match(DPI_RE) ?? []).length;
    if (dpiHits > 0) {
      next = next.replace(DPI_RE, "");
      changes.push(`${sheet}: removed bad dpi x${dpiHits}`);
    }

    const mergeHits = (next.match(SINGLE_CELL_MERGE_REF) ?? []).length;
    if (mergeHits > 0) {
      next = next.replace(SINGLE_CELL_MERGE_REF, "");
      changes.push(`${sheet}: removed single-cell merges x${mergeHits}`);
    }

    if (next !== xml) {
      changed = true;
      zip.file(sheet, next);
    }
  }

  if (!changed) return { changed, changes };

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(fullPath, out);
  return { changed, changes };
}

async function main() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(`Assets dir not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  for (const f of TARGET_FILES) {
    const p = join(ASSETS_DIR, f);
    if (!existsSync(p)) {
      console.log(`[SKIP] ${f}: missing`);
      continue;
    }
    const res = await patchOne(p);
    if (!res.changed) {
      console.log(`[OK] ${f}: no changes needed`);
      continue;
    }
    console.log(`[PATCHED] ${f}`);
    for (const c of res.changes) console.log(`  - ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

