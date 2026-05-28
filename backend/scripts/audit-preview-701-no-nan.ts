import { buildWarehouseLoadXlsx } from "../src/modules/orders/warehouse-templates/build-warehouse-load-xlsx";
import { workbookBufferToNakladnoyPreview } from "../src/modules/orders/warehouse-templates/nakladnoy-xlsx-preview";
import {
  DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  type NakladnoyOrderPayload
} from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload = {
  id: 1,
  number: "T1",
  createdAt: new Date("2026-05-26"),
  tenantName: "T",
  tenantPhone: null,
  clientName: "C",
  clientBalanceNum: null,
  clientAddress: "A",
  currencyLabel: "UZS",
  agentLine: "agent",
  expeditorLine: "[T1] ZULFIQOROV ULUGBEK",
  territory: "T",
  warehouseName: "W",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "S1",
      barcode: null,
      name: "Mahsulot 1",
      qty: 10,
      bonusQty: 0,
      price: 132000,
      sum: 1320000,
      groupTitle: "G",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "S2",
      barcode: null,
      name: "POMPI GIGA",
      qty: 5,
      bonusQty: 0,
      price: 72000,
      sum: 360000,
      groupTitle: "G",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildWarehouseLoadXlsx("wh-7.0.1", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const preview = await workbookBufferToNakladnoyPreview(buf, {
    label: "7.0.1",
    filename: "test.xlsx"
  });

  const nanCells: string[] = [];
  let itogoSum = "";
  for (const page of preview.pages) {
    if (!page.grid) continue;
    for (const row of page.grid.rows) {
      for (const cell of row) {
        if (cell.v.includes("NaN")) nanCells.push(cell.v);
        if (cell.v === "ИТОГО" || row.some((c) => c.v === "ИТОГО")) {
          const sums = row.filter((c) => /[\d\s]/.test(c.v) && c.align === "right");
          if (sums.length) itogoSum = sums.map((s) => s.v).join(",");
        }
      }
    }
  }

  const ok = nanCells.length === 0;
  console.log(
    JSON.stringify(
      { ok, pageCount: preview.pages.length, nanCount: nanCells.length, itogoSum },
      null,
      2
    )
  );
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
