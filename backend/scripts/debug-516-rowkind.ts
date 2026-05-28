import { loadExpeditorLoadingTemplateWorkbook } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-assets";
import { pickExpeditorDataSheet, fillArgb, rowText } from "../src/modules/orders/warehouse-templates/expeditor-loading-fill-shared";
import { cellStr, clearCellValueMerged } from "../src/modules/orders/warehouse-templates/warehouse-template-fill.helpers";

async function main() {
  const wb = await loadExpeditorLoadingTemplateWorkbook("ex-5.1.6");
  const sheet = pickExpeditorDataSheet(wb, "5.1.6");
  for (const r of [8, 9, 10]) {
    const no = cellStr(sheet.getCell(r, 1).value);
    const fg = fillArgb(sheet.getCell(r, 3));
    console.log("row", r, "no", JSON.stringify(no), "name", cellStr(sheet.getCell(r, 3).value), "fg", fg, "c7", sheet.getCell(r, 7).value);
  }
  console.log("row9 rowText", rowText(sheet, 9, 14));
  clearCellValueMerged(sheet, 9, 7);
  console.log("after clear c7", sheet.getCell(9, 7).value);
}

main().catch(console.error);
