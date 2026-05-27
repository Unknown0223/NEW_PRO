import JSZip from "jszip";
import {
  filterValidNonOverlappingMergeRefs,
  parseMergeRef
} from "./worksheet-merge-utils";

/** ExcelJS yuklashda qo‘yadigan noto‘g‘ri DPI (page-setup-xform default). */
const EXCELJS_BAD_DPI = "4294967295";

const SINGLE_CELL_MERGE_REF = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;

function sheetMaxRow(xml: string): number {
  let max = 0;
  for (const m of xml.matchAll(/<row r="(\d+)"/g)) {
    max = Math.max(max, +m[1]!);
  }
  return max;
}

/** mergeCells: mavjud bo‘lmagan qatorlar, bir hujayra, ustma-ust tushish. */
function repairMergeCellsInSheetXml(xml: string): string {
  const block = xml.match(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/);
  if (!block) return xml;

  const maxRow = sheetMaxRow(xml);
  const refs = [...block[1]!.matchAll(/mergeCell ref="([^"]+)"/g)].map((m) => m[1]!);
  const filtered = filterValidNonOverlappingMergeRefs(
    refs.filter((ref) => {
      const p = parseMergeRef(ref);
      if (!p) return false;
      if (p.c1 === p.c2 && p.r1 === p.r2) return false;
      return p.r1 <= maxRow && p.r2 <= maxRow;
    })
  );

  if (filtered.length === refs.length) return xml;

  const inner =
    filtered.length === 0
      ? ""
      : filtered.map((ref) => `<mergeCell ref="${ref}"/>`).join("");
  const replacement =
    filtered.length === 0
      ? ""
      : `<mergeCells count="${filtered.length}">${inner}</mergeCells>`;

  return xml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, replacement);
}

function patchSheetXml(xml: string): string {
  let next = xml;
  next = next.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  next = next.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  next = next.replace(SINGLE_CELL_MERGE_REF, "");
  next = repairMergeCellsInSheetXml(next);
  return next;
}

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi sheet XML ni tozalash.
 * Shablonsiz pageSetup da DPI bo‘lmasa ham ExcelJS 4294967295 yozadi — Excel faylni «repair» qiladi.
 */
export async function patchWarehouseXlsxBuffer(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  let changed = false;
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
    const xml = await entry.async("string");
    const next = patchSheetXml(xml);
    if (next !== xml) {
      changed = true;
      zip.file(path, next);
    }
  }
  if (!changed) return buf;
  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    })
  );
}
