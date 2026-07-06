import JSZip from "jszip";

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi XML fayllarni tozalash.
 *
 * TUZATILADIGAN 4 TA MUAMMO (barchasi "Row 2, Col 0" xatosiga sabab):
 *
 * 1. BAD DPI (4294967295) — ExcelJS page-setup default.
 *
 * 2. x14ac:dyDescent — ExcelJS har <row> va <sheetFormatPr> ga qo'shadi.
 *    Template da x14ac namespace yo'q. ExcelJS load+write da qo'shadi.
 *    mc:Ignorable="x14ac" bilan birgalikda Excel parse qilolmaydi.
 *
 * 3. customHeight="1" in <sheetFormatPr> — ExcelJS qo'shadi.
 *    Template da yo'q edi. ExcelJS qo'shganda Excel har <row> da
 *    ht= atributi bo'lishini kutadi. Hech bir qatorda ht= yo'q →
 *    inconsistency → "Row 2, Col 0" xato.
 *
 * 4. sharedStrings count mismatch — fill dan keyin si soni kamayadi
 *    lekin ExcelJS count= atributini yangilamaydi.
 */

const EXCELJS_BAD_DPI = "4294967295";
const XML_INVALID_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function patchSheetXml(xml: string): string {
  let out = xml;

  // 1. Bad DPI
  out = out.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  out = out.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");

  // 2. x14ac:dyDescent — <sheetFormatPr> va <row> lardan olib tashlash
  out = out.replace(/\s+x14ac:dyDescent="[^"]*"/g, "");

  // 3. x14ac namespace — endi ishlatilmaydi, deklaratsiyalarni olib tashlash
  if (!out.includes("x14ac:")) {
    out = out.replace(/\s+xmlns:x14ac="[^"]*"/g, "");
    out = out.replace(/\s+mc:Ignorable="[^"]*"/g, "");
    out = out.replace(/\s+xmlns:mc="[^"]*"/g, "");
  }

  // 4. customHeight="1" in sheetFormatPr — rows da ht= yo'q bo'lganda muammo
  out = out.replace(/(<sheetFormatPr\b[^>]*?)\s+customHeight="[^"]*"([^>]*?\/>)/, "$1$2");

  // 5. Invalid XML chars
  out = out.replace(XML_INVALID_CHARS, "");

  return out;
}

function patchSharedStringsXml(xml: string): string {
  let out = xml.replace(XML_INVALID_CHARS, "");

  // count va uniqueCount ni haqiqiy <si> soni bilan tenglashtirish
  const actualCount = (out.match(/<si>/g) ?? []).length;
  out = out.replace(/(<sst\b[^>]*?\s)count="\d+"/, `$1count="${actualCount}"`);
  out = out.replace(/(<sst\b[^>]*?\s)uniqueCount="\d+"/, `$1uniqueCount="${actualCount}"`);

  return out;
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
