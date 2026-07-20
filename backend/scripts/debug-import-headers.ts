import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { cellText, headerToTemplateCol } from "../src/modules/products/products.import.helpers";

async function main() {
  const dir = path.join(process.cwd(), "scripts", "output");
  const f = fs.readdirSync(dir).filter((x) => x.startsWith("smoke-import")).sort().pop();
  if (!f) throw new Error("no smoke file");
  const buf = fs.readFileSync(path.join(dir, f));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const sheet = wb.worksheets[0]!;
  const row = sheet.getRow(1);
  console.log("file", f);
  for (let c = 1; c <= 10; c++) {
    const cell = row.getCell(c);
    const text = cellText(row, c);
    const key = text ? headerToTemplateCol(text) : null;
    console.log(c, { text, value: cell.value, cellTextProp: cell.text, key });
  }
}

main().catch(console.error);
