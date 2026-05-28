import { loadExpeditorLoadingTemplateWorkbook } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-assets";
import { pickExpeditorDataSheet } from "../src/modules/orders/warehouse-templates/expeditor-loading-fill-shared";
import { setCell, clearCellValueMerged } from "../src/modules/orders/warehouse-templates/warehouse-template-fill.helpers";

async function main() {
  const wb = await loadExpeditorLoadingTemplateWorkbook("ex-5.1.6");
  const sheet = pickExpeditorDataSheet(wb, "5.1.6");
  const c = sheet.getCell(10, 6);
  console.log("before", c.value, "formula", c.formula);
  clearCellValueMerged(sheet, 10, 6);
  console.log("after clear", sheet.getCell(10, 6).value);
  setCell(sheet, 10, 6, 7);
  console.log("after set", sheet.getCell(10, 6).value);
  setCell(sheet, 9, 7, null);
  console.log("r9c7 clear via setCell null", sheet.getCell(9, 7).value);
  clearCellValueMerged(sheet, 9, 7);
  console.log("r9c7 after clearCellValueMerged", sheet.getCell(9, 7).value);
}

main().catch(console.error);
