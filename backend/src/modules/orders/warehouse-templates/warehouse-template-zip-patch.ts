import JSZip from "jszip";

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi XML fayllarni tozalash.
 *
 * TUZATILADIGAN MUAMMOLAR (barchasi Excel «Row 2, Col 0» / repair xatosiga olib kelishi mumkin):
 *
 * 1. BAD DPI (4294967295) — ExcelJS page-setup default.
 * 2. x14ac:dyDescent — template da namespace yo'q, ExcelJS qo'shadi.
 * 3. customHeight="1" in sheetFormatPr — ht= yo'q qatorlarda inconsistency.
 * 4. sharedStrings count mismatch — fill dan keyin <si> soni kamayadi, count eski qoladi.
 * 5. Merge konfliktlari (519 va boshqalar) — ustma-ust / bir hujayra merge.
 * 6. XML invalid chars (0x00–0x1F).
 */

const EXCELJS_BAD_DPI = "4294967295";
const XML_INVALID_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const SINGLE_CELL_MERGE_REF = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function parseMergeRef(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  return {
    c1: colToNum(m[1]!),
    r1: Number(m[2]),
    c2: colToNum(m[3]!),
    r2: Number(m[4])
  };
}

function rangesOverlap(
  a: { r1: number; c1: number; r2: number; c2: number },
  b: { r1: number; c1: number; r2: number; c2: number }
): boolean {
  return !(a.r2 < b.r1 || b.r2 < a.r1 || a.c2 < b.c1 || b.c2 < a.c1);
}

function sheetMaxRow(xml: string): number {
  let max = 0;
  for (const m of xml.matchAll(/<row r="(\d+)"/g)) {
    max = Math.max(max, +m[1]!);
  }
  return max;
}

function repairMergeCellsInSheetXml(xml: string): string {
  const block = xml.match(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/);
  if (!block) return xml;

  const maxRow = sheetMaxRow(xml);
  const refs = [...block[1]!.matchAll(/mergeCell ref="([^"]+)"/g)].map((m) => m[1]!);
  const kept: Array<{ r1: number; c1: number; r2: number; c2: number }> = [];
  const valid: string[] = [];

  for (const ref of refs) {
    const box = parseMergeRef(ref);
    if (!box) continue;
    if (box.r1 === box.r2 && box.c1 === box.c2) continue;
    if (box.r1 > maxRow || box.r2 > maxRow) continue;
    if (kept.some((k) => rangesOverlap(k, box))) continue;
    kept.push(box);
    valid.push(ref);
  }

  if (valid.length === refs.length) return xml;

  const inner = valid.map((ref) => `<mergeCell ref="${ref}"/>`).join("");
  const replacement =
    valid.length === 0
      ? ""
      : `<mergeCells count="${valid.length}">${inner}</mergeCells>`;

  return xml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, replacement);
}

/**
 * pageSetup ni 5.2.0 standartiga moslashtirish — 5.1.6 va boshqa shablonlarda
 * `orientation="default"`, `scale="100"` + `fitToWidth/Height`, `copies`, `useFirstPageNumber`
 * kabi qiymatlar Excel da repair xatosiga olib keladi.
 */
function normalizePageSetup(xml: string): string {
  const m = /<pageSetup([^/>]*)\/>/.exec(xml);
  if (!m) return xml;
  const attrs = m[1]!;

  const get = (n: string): string | null => {
    const r = new RegExp(`\\s${n}="([^"]*)"`).exec(attrs);
    return r?.[1] ?? null;
  };

  const paper = get("paperSize") ?? "9";
  let orientation = get("orientation") ?? "portrait";
  if (orientation === "default") orientation = "portrait";

  const fitToWidth = get("fitToWidth") ?? "1";
  const fitToHeight = get("fitToHeight") ?? "0";
  const hasFitToPage = xml.includes('fitToPage="1"');

  const parts: string[] = [
    `paperSize="${paper === "1" ? "9" : paper}"`,
    `orientation="${orientation}"`
  ];
  if (hasFitToPage) {
    parts.push(`fitToWidth="${fitToWidth}"`, `fitToHeight="${fitToHeight}"`);
  } else {
    const scale = get("scale");
    if (scale) parts.push(`scale="${scale}"`);
  }

  return xml.replace(m[0], `<pageSetup ${parts.join(" ")}/>`);
}

function patchSheetXml(xml: string): string {
  let out = xml;

  out = out.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  out = out.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");

  // ExcelJS template->write oqimida sheetFormatPr da x14ac:dyDescent="0" paydo bo'lishi mumkin.
  // Microsoft 365 bu qiymatni invalid deb ko'radi, shuning uchun 0 -> 0.25 qilamiz.
  out = out.replace(
    /(<sheetFormatPr\b[^>]*?)\s+x14ac:dyDescent="0"([^>]*?\/>)/,
    '$1 x14ac:dyDescent="0.25"$2'
  );

  out = out.replace(/(<sheetFormatPr\b[^>]*?)\s+customHeight="[^"]*"([^>]*?\/>)/, "$1$2");

  out = out.replace(SINGLE_CELL_MERGE_REF, "");
  out = repairMergeCellsInSheetXml(out);

  out = normalizePageSetup(out);

  out = out.replace(XML_INVALID_CHARS, "");

  return out;
}

function patchSharedStringsXml(xml: string): string {
  let out = xml.replace(XML_INVALID_CHARS, "");

  const actualCount = (out.match(/<si>/g) ?? []).length;
  out = out.replace(/(<sst\b[^>]*?\s)count="\d+"/, `$1count="${actualCount}"`);
  out = out.replace(/(<sst\b[^>]*?\s)uniqueCount="\d+"/, `$1uniqueCount="${actualCount}"`);

  return out;
}

/** Bo‘sh `_rels/sheet*.xml.rels` faylini olib tashlash (template dan qolib ketgan). */
async function removeEmptySheetRels(zip: JSZip): Promise<boolean> {
  let removed = false;
  for (const path of Object.keys(zip.files)) {
    if (!/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(path)) continue;
    const xml = await zip.file(path)!.async("string");
    if (!/<Relationship\b/.test(xml)) {
      zip.remove(path);
      removed = true;
    }
  }
  return removed;
}

export async function patchWarehouseXlsxBuffer(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  let changed = false;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      const xml = await entry.async("string");
      const patched = patchSheetXml(xml);
      if (patched !== xml) {
        zip.file(path, patched);
        changed = true;
      }
      continue;
    }

    if (path === "xl/sharedStrings.xml") {
      const xml = await entry.async("string");
      const patched = patchSharedStringsXml(xml);
      if (patched !== xml) {
        zip.file(path, patched);
        changed = true;
      }
    }
  }

  if (await removeEmptySheetRels(zip)) changed = true;

  if (!changed) return buf;

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    })
  );
}
