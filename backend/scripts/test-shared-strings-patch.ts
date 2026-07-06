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

function checkSst(xml: string): { si: number; count: string | null; unique: string | null } {
  const si = (xml.match(/<si>/g) ?? []).length;
  const count = /count="(\d+)"/.exec(xml)?.[1] ?? null;
  const unique = /uniqueCount="(\d+)"/.exec(xml)?.[1] ?? null;
  return { si, count, unique };
}

async function main() {
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const zip = await JSZip.loadAsync(buf);
  const sst = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!sst) {
    console.error("no sharedStrings.xml");
    process.exit(1);
  }
  const r = checkSst(sst);
  const ok = r.count === String(r.si) && r.unique === String(r.si);
  console.log("516 sharedStrings", r, ok ? "OK" : "MISMATCH");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
