import JSZip from "jszip";

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi XML fayllarni tozalash.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MUAMMO: Microsoft 365 v16.0+ "Row 2, Col 0" xatosi
 *  Sabab:  ExcelJS template yuklab writeBuffer qilganda
 *          sheetFormatPr da x14ac:dyDescent="0" yozadi.
 *          Excel 365 bu qiymatni invalid deb hisoblaydi
 *          (minimum 0.25 bo'lishi kerak) va faylni parse
 *          qilishdan to'xtaydi — "Строка 2, столбец 0".
 *
 *  Nima uchun 5.2.0 ishlaydi?
 *          520 noldan ExcelJS bilan yaratiladi — x14ac:dyDescent="55"
 *          Template yuklab yozilmaydi, shuning uchun "0" bo'lmaydi.
 *
 *  Nima uchun 5.1.x larda muammo?
 *          Template da defaultRowHeight="14.4" → ExcelJS
 *          x14ac:dyDescent="0" yozib qo'yadi (noto'g'ri).
 * ═══════════════════════════════════════════════════════════════
 *
 * TUZATISHLAR:
 *
 * 1. sheetFormatPr da x14ac:dyDescent="0" → "0.25"
 *    (asosiy fix — Excel 365 "Row 2, Col 0" xatosini hal qiladi)
 *
 * 2. DPI 4294967295 olib tashlash
 *    (ExcelJS page-setup default — Excel warn beradi)
 *
 * 3. sharedStrings count mismatch tuzatish
 *    Template 135 string, fill dan keyin 103 qoladi,
 *    ExcelJS count=135 deb yozib qo'yadi → inconsistency.
 *
 * 4. Invalid XML chars (0x00-0x1F) tozalash
 */

const EXCELJS_BAD_DPI = "4294967295";
const XML_INVALID_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function patchSheetXml(xml: string): string {
  let out = xml;

  // 1. Bad DPI
  out = out.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
  out = out.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");

  // 2. ASOSIY FIX: sheetFormatPr da x14ac:dyDescent="0" → "0.25"
  //    Row larda dyDescent="0.25" to'g'ri — faqat sheetFormatPr dagi "0" muammo
  out = out.replace(
    /(<sheetFormatPr\b[^>]*?)\s+x14ac:dyDescent="0"([^>]*?\/>)/,
    '$1 x14ac:dyDescent="0.25"$2'
  );

  // 3. Invalid XML chars
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
