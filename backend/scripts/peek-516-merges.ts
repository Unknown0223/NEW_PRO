import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";

async function main() {
  const p = join(__dirname, "../assets/nakladnoy/loading/516-zagruz-5.1.6.xlsx");
  const buf = await preprocessExpeditorTemplateBuffer(readFileSync(p));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0]!;
  const merges = (ws as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges ?? [];
  console.log("merge count", merges.length);
  for (const ref of merges.filter((m) => /[EFG][89]|10|11/.test(m)).slice(0, 40)) {
    console.log(ref);
  }
  for (const r of [8, 9, 10, 11]) {
    for (const c of [5, 6, 7]) {
      const cell = ws.getCell(r, c);
      console.log(
        `r${r}c${c}`,
        "val",
        cell.value,
        "formula",
        cell.formula,
        "isMerged",
        cell.isMerged,
        "master",
        cell.master ? `${cell.master.address}` : "-"
      );
    }
  }
}

main().catch(console.error);
