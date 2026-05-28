/**
 * 5.1.6: Excel yaratadi, preview grid tekshiradi, faylni audit-output ga yozadi.
 */
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
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const out = join(__dirname, "audit-output", "516-verify-download.xlsx");
  writeFileSync(out, buf);

  const preview = await workbookBufferToNakladnoyPreview(buf, {
    label: "5.1.6",
    filename: "516-verify-download.xlsx"
  });
  const grid = preview.pages[0]!.grid!;
  const r2 = grid.rows[1]!;
  const sumCell = r2.find((c) => !c.skip && c.v.toLowerCase().includes("сумм"));
  const r1agent = grid.rows[0]!.find((c) => !c.skip && c.v.includes("Бисёр"));
  const ok =
    (sumCell?.rowSpan ?? 0) >= 6 &&
    (r1agent?.rowSpan ?? 0) >= 6 &&
    grid.colCount === 45;
  console.log("row2 сумма rowSpan", sumCell?.rowSpan);
  console.log("row1 agent rowSpan", r1agent?.rowSpan);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0]!;
  console.log("excel r10 c6", ws.getCell(10, 6).value, "c7", ws.getCell(10, 7).value);
  console.log("excel col45 r7", ws.getCell(7, 45).value, "r2", ws.getCell(2, 45).value);
  console.log("preview grid ok", ok);
  console.log("written", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
