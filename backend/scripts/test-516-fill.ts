import { writeFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { workbookBufferToNakladnoyPreview } from "../src/modules/orders/warehouse-templates/nakladnoy-xlsx-preview";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload = {
  id: 1,
  number: "T-1",
  createdAt: new Date("2026-05-27"),
  tenantName: "T",
  tenantPhone: null,
  clientName: "Клиент",
  clientAddress: "Адрес",
  currencyLabel: "сум",
  agentLine: "Бисёр Маркэт",
  expeditorLine: "ZULFIQOROV ULUG'BEK",
  territory: "BALIQCHI",
  warehouseName: "W",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "G-PM001",
      barcode: "1",
      name: "POMPI MINI №-1",
      qty: 7,
      price: 25500,
      sum: 178500,
      bonusQty: 0,
      groupTitle: "LIPUCHKA",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "G-PM003",
      barcode: "3",
      name: "POMPI MINI №-3",
      qty: 2,
      price: 25500,
      sum: 51000,
      bonusQty: 0,
      groupTitle: "LIPUCHKA",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const out = join(__dirname, "audit-output", "test-516-filled.xlsx");
  writeFileSync(out, buf);
  const preview = await workbookBufferToNakladnoyPreview(buf, {
    label: "5.1.6",
    filename: "516 test.xlsx"
  });
  console.log("preview cols", preview.pages[0]?.grid?.colCount);
  console.log("preview rows", preview.pages[0]?.grid?.rows.length);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0]!;
  console.log("r9 untouched product kg", ws.getCell(9, 6).value, "agent1", ws.getCell(9, 7).value);
  console.log("r8 group kg", ws.getCell(8, 6).value, "agent1", ws.getCell(8, 7).value);
  console.log("r10 POMPI-1 kg", ws.getCell(10, 6).value, "agent1", ws.getCell(10, 7).value);
  console.log("r11 POMPI-3 kg", ws.getCell(11, 6).value, "agent1", ws.getCell(11, 7).value);
  console.log("written", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
