import JSZip from "jszip";
import {
  filterValidNonOverlappingMergeRefs,
  parseMergeRef
} from "./worksheet-merge-utils";

/** ExcelJS yuklashda qo'yadigan noto'g'ri DPI (page-setup-xform default). */
const EXCELJS_BAD_DPI = "4294967295";

const SINGLE_CELL_MERGE_REF = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;

/** XML 1.0 da taqiqlangan boshqaruv belgilari (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F). */
const XML_INVALID_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function sheetMaxRow(xml: string): number {
  let max = 0;
  for (const m of xml.matchAll(/<row r="(\d+)"/g)) {
    max = Math.max(max, +m[1]!);
  }
  return max;
}

/** mergeCells: mavjud bo'lmagan qatorlar, bir hujayra, ustma-ust tushish. */
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
  // DPI muammo
  next = next.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  next = next.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  // Bitta hujayra merge
  next = next.replace(SINGLE_CELL_MERGE_REF, "");
  // Merge repair
  next = repairMergeCellsInSheetXml(next);
  // XML taqiqlangan belgilar (asosiy muammo sababi)
  next = next.replace(XML_INVALID_CHARS, "");
  return next;
}

/**
 * TUZATISH: sharedStrings.xml ni ham tozalash.
 * useSharedStrings: true bo'lganda ExcelJS barcha matnlarni
 * xl/sharedStrings.xml ga yozadi. Agar u yerda noto'g'ri belgi bo'lsa
 * Excel "Row 2, Col 0" xatosi chiqaradi.
 */
function patchSharedStringsXml(xml: string): string {
  // XML taqiqlangan belgilarni olib tashlash
  let next = xml.replace(XML_INVALID_CHARS, "");

  // Bo'sh <si></si> elementlarni tozalash (ExcelJS ba'zan bo'sh string yozadi)
  // Bu shared strings count bilan mos kelmasligiga sabab bo'ladi
  const siMatches = next.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  const validSi = siMatches.filter(s => {
    // Bo'sh yoki faqat whitespace bo'lgan si elementlarni saqlash (ular kerak)
    // Lekin XML invalid belgili elementlarni tozaladik yuqorida
    return true;
  });

  // count atributini yangilash
  const actualCount = validSi.length;
  next = next.replace(/(<sst[^>]*\s)count="\d+"/, `$1count="${actualCount}"`);
  next = next.replace(/(<sst\s)count="\d+"/, `$1count="${actualCount}"`);

  return next;
}

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi XML fayllarni tozalash.
 *
 * Patch qilinadigan fayllar:
 *   - xl/worksheets/sheet*.xml  — DPI, merge, invalid chars
 *   - xl/sharedStrings.xml      — invalid chars (Row 2 Col 0 xatosining asosiy sababi)
 */
export async function patchWarehouseXlsxBuffer(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  let changed = false;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    // Sheet XMLlar
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      const xml = await entry.async("string");
      const next = patchSheetXml(xml);
      if (next !== xml) {
        changed = true;
        zip.file(path, next);
      }
      continue;
    }

    // SharedStrings XML — YANGI
    if (path === "xl/sharedStrings.xml") {
      const xml = await entry.async("string");
      const next = patchSharedStringsXml(xml);
      if (next !== xml) {
        changed = true;
        zip.file(path, next);
      }
      continue;
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
