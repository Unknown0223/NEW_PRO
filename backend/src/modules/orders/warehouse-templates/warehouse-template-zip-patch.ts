import JSZip from "jszip";

/** ExcelJS yuklashda qo‘yadigan noto‘g‘ri DPI (page-setup-xform default). */
const EXCELJS_BAD_DPI = "4294967295";

/**
 * ExcelJS writeBuffer dan keyin ZIP ichidagi sheet XML ni tozalash.
 * Shablonsiz pageSetup da DPI bo‘lmasa ham ExcelJS 4294967295 yozadi — Excel faylni «repair» qiladi.
 */
export async function patchWarehouseXlsxBuffer(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
    let xml = await entry.async("string");
    const before = xml;
    xml = xml.replace(new RegExp(`\\s*horizontalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
    xml = xml.replace(new RegExp(`\\s*verticalDpi="${EXCELJS_BAD_DPI}"`, "g"), "");
    if (xml !== before) {
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
