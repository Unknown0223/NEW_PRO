import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";

const file = process.argv[2] || "512-zagruz-5.1.2.xlsx";
const p = file.includes("/") || file.includes("\\")
  ? file
  : join(__dirname, "../assets/nakladnoy/loading", file);

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join("");
  }
  return String(v).trim().slice(0, 18);
}

function fillArgb(cell: ExcelJS.Cell): string {
  const f = cell.fill;
  if (!f || f.type !== "pattern" || f.pattern === "none") return "";
  return (f as ExcelJS.FillPattern).fgColor?.argb?.slice(-6) ?? "";
}

async function main() {
  const fixed = await preprocessExpeditorTemplateBuffer(readFileSync(p));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fixed as never);
  const ws = wb.worksheets[0]!;
  console.log("sheet", ws.name, "rows", ws.rowCount, "cols", ws.columnCount);
  for (let r = 1; r <= 20; r++) {
    const parts: string[] = [];
    for (let c = 1; c <= 12; c++) {
      const cell = ws.getCell(r, c);
      const t = cellStr(cell.value);
      const fg = fillArgb(cell);
      parts.push(t ? `${t}${fg ? "#" + fg : ""}` : fg ? `#${fg}` : "·");
    }
    console.log(String(r).padStart(2), parts.join(" | "));
  }
}

main().catch(console.error);
