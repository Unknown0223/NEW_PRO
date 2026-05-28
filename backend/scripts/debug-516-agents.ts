import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";
import { cellStr } from "../src/modules/orders/warehouse-templates/warehouse-template-fill.helpers";
import { agentMatchesHeader } from "../src/modules/orders/warehouse-templates/expeditor-loading-fill-shared";

const p = join(__dirname, "../assets/nakladnoy/loading/516-zagruz-5.1.6.xlsx");

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await preprocessExpeditorTemplateBuffer(readFileSync(p)));
  const sheet = wb.worksheets[0]!;
  const orderAgent = "Бисёр Маркэт";
  for (let r = 1; r <= 6; r++) {
    for (let c = 7; c <= 12; c++) {
      const h = cellStr(sheet.getCell(r, c).value);
      if (!h) continue;
      console.log(`row${r} col${c}`, JSON.stringify(h), "match", agentMatchesHeader(orderAgent, h));
    }
  }
}

main();
