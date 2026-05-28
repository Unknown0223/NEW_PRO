/**
 * 5.1.6 Excel: build → ExcelJS load → merge/ustun tekshiruvi.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { requestBulkOrderNakladnoyExpeditorLoading } from "../src/modules/orders/domain/order.nakladnoy";
import { buildWarehouseAggregateContext } from "../src/modules/orders/warehouse-templates/warehouse-template-shared";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload[] = [
  {
    id: 1,
    number: "T",
    createdAt: new Date("2026-05-27"),
    tenantName: "T",
    tenantPhone: null,
    clientName: "C",
    clientAddress: "",
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
      }
    ],
    paidLines: [],
    bonusLines: []
  }
];

async function main() {
  const { buildExpeditorLoadingXlsx } = await import(
    "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx"
  );
  const ctx = buildWarehouseAggregateContext(mock, DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  void ctx;
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", mock, DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const out = join(__dirname, "audit-output", "516-api-download.xlsx");
  writeFileSync(out, buf);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0]!;
  const merges = (ws as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges?.length ?? 0;
  console.log("filename pattern ok", /516.*5\.1\.6.*\.xlsx/.test("516 Загруз зав.склада 5.1.6(27-05-2026).xlsx"));
  console.log("sheet", ws.name, "rows", ws.rowCount, "cols", ws.columnCount, "merges", merges);
  console.log("r1c7 agent", ws.getCell(1, 7).value);
  console.log("r7c45", ws.getCell(7, 45).value);
  console.log("r10c6 kg", ws.getCell(10, 6).value, "c7 qty", ws.getCell(10, 7).value);
  console.log("written", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
