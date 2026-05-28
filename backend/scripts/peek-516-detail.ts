import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";

const p = join(__dirname, "../assets/nakladnoy/loading/516-zagruz-5.1.6.xlsx");

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join("");
  }
  return String(v).trim().slice(0, 22);
}

function fg(cell: ExcelJS.Cell): string {
  const f = cell.fill;
  if (!f || f.type !== "pattern" || f.pattern === "none") return "";
  return (f as ExcelJS.FillPattern).fgColor?.argb?.slice(-6) ?? "";
}

async function dump(ws: ExcelJS.Worksheet, label: string) {
  console.log("\n===", label, ws.name, "rows", ws.rowCount, "cols", ws.columnCount, "===");
  for (let r = 1; r <= Math.min(22, ws.rowCount); r++) {
    const parts: string[] = [];
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      const t = cellStr(cell.value);
      const f = fg(cell);
      parts.push(t ? `${t}${f ? "#" + f : ""}` : f ? `#${f}` : "·");
    }
    console.log(String(r).padStart(2), parts.join(" | "));
  }
  const hr = 7;
  console.log("\nHeader row", hr, "cols 1-14:");
  for (let c = 1; c <= 14; c++) {
    console.log(" ", c, cellStr(ws.getCell(hr, c).value), "fg", fg(ws.getCell(hr, c)));
  }
  console.log("Row2 agent headers 5-14:");
  for (let c = 5; c <= 14; c++) {
    console.log(" ", c, cellStr(ws.getCell(2, c).value));
  }
}

async function main() {
  const fixed = await preprocessExpeditorTemplateBuffer(readFileSync(p));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fixed as never);
  for (const ws of wb.worksheets) {
    if (ws.rowCount > 5) await dump(ws, "sheet");
  }
}

main().catch(console.error);
