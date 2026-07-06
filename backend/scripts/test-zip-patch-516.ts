import JSZip from "jszip";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
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

async function check516(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  const sst = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!sheet || !sst) return { ok: false, reason: "missing xml" };

  const badDpi = sheet.includes(EXCELJS_BAD);
  const customHeight = /<sheetFormatPr[^>]*customHeight=/.test(sheet);
  const dyDescent = sheet.includes("x14ac:dyDescent");
  const badSheetDy = /<sheetFormatPr[^>]*x14ac:dyDescent="0"/.test(sheet);
  const si = (sst.match(/<si>/g) ?? []).length;
  const count = /count="(\d+)"/.exec(sst)?.[1];
  const unique = /uniqueCount="(\d+)"/.exec(sst)?.[1];

  const ok = !badDpi && !customHeight && !badSheetDy && count === String(si) && unique === String(si);
  return { ok, badDpi, customHeight, dyDescent, badSheetDy, si, count, unique };
}

const EXCELJS_BAD = "4294967295";

async function main() {
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  console.log("516", await check516(buf));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
