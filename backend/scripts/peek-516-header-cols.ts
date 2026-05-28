import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join("");
  }
  return String(v).trim().slice(0, 30);
}

async function main() {
  const p = join(__dirname, "../assets/nakladnoy/loading/516-zagruz-5.1.6.xlsx");
  const buf = await preprocessExpeditorTemplateBuffer(readFileSync(p));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0]!;
  const merges = (ws as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges ?? [];
  console.log("merges row 1-7:", merges.filter((m) => /^[A-Z]+[1-7]/.test(m) || /:[A-Z]+[1-7]/.test(m)).join("\n"));
  for (let r = 1; r <= 8; r++) {
    const parts: string[] = [];
    for (let c = 35; c <= 45; c++) {
      parts.push(`${c}:${cellStr(ws.getCell(r, c).value) || "·"}`);
    }
    console.log("row", r, "cols35-45", parts.join(" | "));
  }
  for (let c = 1; c <= 45; c++) {
    const v = cellStr(ws.getCell(7, c).value);
    if (v) console.log("h7 col", c, v);
  }
}

main().catch(console.error);
