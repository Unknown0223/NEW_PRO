/**
 * Expeditor shablonlari: ExcelJS yuklashdan oldin ZIP/XML tuzatish.
 */
import JSZip from "jszip";

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const EXCELJS_BAD_DPI = "4294967295";

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

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function parseRef(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
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

function repairMergeCellsXml(xml: string): string {
  const mergeRe = /<mergeCell ref="([^"]+)"/g;
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mergeRe.exec(xml)) !== null) refs.push(m[1]!);

  const valid: string[] = [];
  const kept: Array<{ r1: number; c1: number; r2: number; c2: number }> = [];
  for (const ref of refs) {
    const box = parseRef(ref);
    if (!box) continue;
    if (box.r1 === box.r2 && box.c1 === box.c2) continue;
    if (kept.some((k) => rangesOverlap(k, box))) continue;
    kept.push(box);
    valid.push(ref);
  }
  if (!xml.includes("<mergeCells")) return xml;
  const inner = valid.map((ref) => `<mergeCell ref="${ref}"/>`).join("");
  if (valid.length === 0) {
    return xml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>\s*/i, "");
  }
  return xml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/i, `<mergeCells count="${valid.length}">${inner}</mergeCells>`);
}

export async function preprocessExpeditorTemplateBuffer(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path === "xl/workbook.xml") {
      let xml = await entry.async("string");
      xml = normalizeSpreadsheetXml(xml, "workbook");
      zip.file(path, xml);
    }
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      let xml = await entry.async("string");
      xml = normalizeSpreadsheetXml(xml, "worksheet");
      xml = xml.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
      xml = xml.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
      xml = repairMergeCellsXml(xml);
      zip.file(path, xml);
    }
    if (path === "xl/styles.xml" || path === "xl/sharedStrings.xml") {
      let xml = await entry.async("string");
      const root = path.includes("styles") ? "styleSheet" : "sst";
      xml = normalizeSpreadsheetXml(xml, root);
      zip.file(path, xml);
    }
  }
  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    })
  );
}
