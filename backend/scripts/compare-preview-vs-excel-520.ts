/**
 * Preview hujjat va generatsiya qilingan Excel bir xil ma'lumotni berishini tekshiradi.
 */
import ExcelJS from "exceljs";
import { buildExpeditorLoading520Document } from "../src/modules/orders/warehouse-templates/expeditor-loading-520-document";
import { buildExpeditorLoading520XlsxFromDocument } from "../src/modules/orders/warehouse-templates/expeditor-loading-520-xlsx";
import { buildWarehouseAggregateContext } from "../src/modules/orders/warehouse-templates/warehouse-template-shared";
import { getExpeditorLoadingLayoutDef } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-ids";
import {
  DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  type NakladnoyOrderPayload
} from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mockPayload: NakladnoyOrderPayload = {
  id: 1,
  number: "TEST-1",
  createdAt: new Date("2026-05-26"),
  tenantName: "Test",
  tenantPhone: null,
  clientName: "Клиент",
  clientBalanceNum: null,
  clientAddress: "Адрес",
  currencyLabel: "So'm (UZS)",
  agentLine: "A1- [Agent] 998901234567",
  expeditorLine: "E1",
  territory: "TOSHKENT",
  warehouseName: "Склад",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "SKU-001",
      barcode: "123456",
      name: "Mahsulot 1",
      qty: 10,
      price: 132000,
      sum: 1320000,
      bonusQty: 2,
      groupTitle: "Ichimliklar",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "SKU-002",
      barcode: "789",
      name: "Mahsulot 2",
      qty: 5,
      price: 72000,
      sum: 360000,
      bonusQty: 0,
      groupTitle: "Ichimliklar",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((x) => x.text ?? "").join("");
  }
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v).trim();
}

async function main() {
  const options = DEFAULT_NAKLADNOY_BUILD_OPTIONS;
  const ctx = buildWarehouseAggregateContext([mockPayload], options);
  const def = getExpeditorLoadingLayoutDef("ex-5.2.0");
  const doc = buildExpeditorLoading520Document(ctx, options, def.versionLabel);

  const buf = await buildExpeditorLoading520XlsxFromDocument(doc);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0]!;

  const issues: string[] = [];

  const title = cellText(ws.getCell(1, 1).value);
  if (!title.includes("5.2.0")) issues.push(`title: ${title.slice(0, 60)}`);

  let itogoQty = 0;
  let itogoSum = "";
  const productRows: { name: string; qty: number }[] = [];

  ws.eachRow((row) => {
    const c1 = cellText(row.getCell(1).value);
    const c4 = cellText(row.getCell(4).value);
    if (c1 === "Итого" || c4 === "Итого") {
      itogoQty = Number(row.getCell(5).value ?? 0);
      itogoSum = cellText(row.getCell(7).value);
      return;
    }
    const num = Number(row.getCell(1).value);
    const name = cellText(row.getCell(4).value);
    const qty = Number(row.getCell(5).value ?? 0);
    if (Number.isFinite(num) && num > 0 && name) {
      productRows.push({ name, qty });
    }
  });

  if (itogoQty !== doc.totals.qty) {
    issues.push(`totals.qty: excel=${itogoQty} doc=${doc.totals.qty}`);
  }
  if (!itogoSum.replace(/\s/g, "").includes(doc.totals.sum.replace(/\s/g, "").slice(0, 3))) {
    issues.push(`totals.sum: excel=${itogoSum} doc=${doc.totals.sum}`);
  }

  const docLines = doc.groups.flatMap((g) => g.lines);
  if (docLines.length !== productRows.length) {
    issues.push(`lines: excel=${productRows.length} doc=${docLines.length}`);
  }

  const ok = issues.length === 0 && buf.length > 5000;
  console.log(JSON.stringify({ ok, bufferBytes: buf.length, issues, itogoQty, itogoSum }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
