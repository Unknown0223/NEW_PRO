import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { loadExpeditorLoadingTemplateWorkbook } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-assets";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload = {
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
};

function s(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  return String(v).trim().slice(0, 20);
}

async function headerFingerprint(ws: ExcelJS.Worksheet) {
  const merges = ((ws as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges ?? []).length;
  const pts: string[] = [`merges=${merges}`];
  for (let r = 1; r <= 7; r++) {
    pts.push(`r${r}c7=${s(ws.getCell(r, 7).value)}`);
    pts.push(`r${r}c45=${s(ws.getCell(r, 45).value)}`);
  }
  return pts.join("|");
}

async function main() {
  const tpl = await loadExpeditorLoadingTemplateWorkbook("ex-5.1.6");
  const tplWs = tpl.worksheets[0]!;
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(buf as never);
  const outWs = out.worksheets[0]!;
  const a = await headerFingerprint(tplWs);
  const b = await headerFingerprint(outWs);
  console.log("template", a);
  console.log("filled  ", b);
  console.log("match", a === b ? "HEADER_STRUCTURE_OK" : "HEADER_DIFFERS (meta values expected)");
}

main().catch(console.error);
