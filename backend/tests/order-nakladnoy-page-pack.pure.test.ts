import { describe, expect, it } from "vitest";
import {
  excelColumnWidthToPx,
  nakladnoyPageCapacityPt,
  nakladnoyPrintScalePercent,
  packNakladnoyBlocksIntoPages
} from "../src/modules/orders/order-nakladnoy-page-pack";
import { buildConsignmentWorkbook } from "../src/modules/orders/order-nakladnoy-xlsx.consignment";
import type { NakladnoyLine, NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import { workbookBufferToNakladnoyPreview } from "../src/modules/orders/warehouse-templates/nakladnoy-xlsx-preview";

describe("packNakladnoyBlocksIntoPages", () => {
  it("moves a later block that fits into the free space instead of splitting", () => {
    // 1-sahifa: 35+35=70%; 3-klient 50% sig‘maydi, 4-klient 30% sig‘adi.
    const pages = packNakladnoyBlocksIntoPages({ heights: [35, 35, 50, 30], capacity: 100 });
    expect(pages).toEqual([[0, 1, 3], [2]]);
  });

  it("keeps input order when everything fits sequentially", () => {
    expect(packNakladnoyBlocksIntoPages({ heights: [40, 40, 40, 40], capacity: 100 })).toEqual([
      [0, 1],
      [2, 3]
    ]);
  });

  it("accounts for the gap between blocks on the same page", () => {
    expect(packNakladnoyBlocksIntoPages({ heights: [50, 50], capacity: 100, gap: 5 })).toEqual([[0], [1]]);
  });

  it("puts an oversized block alone on its own page", () => {
    expect(packNakladnoyBlocksIntoPages({ heights: [30, 250, 30], capacity: 100 })).toEqual([
      [0, 2],
      [1]
    ]);
  });

  it("uses every block exactly once", () => {
    const heights = Array.from({ length: 40 }, (_, i) => 10 + ((i * 37) % 70));
    const pages = packNakladnoyBlocksIntoPages({ heights, capacity: 200, gap: 6 });
    expect(pages.flat().sort((a, b) => a - b)).toEqual(heights.map((_, i) => i));
    for (const page of pages) {
      const used = page.reduce((s, i) => s + heights[i]!, 0) + 6 * (page.length - 1);
      expect(used).toBeLessThanOrEqual(200);
    }
  });

  it("computes excel column pixels, print scale and page capacity", () => {
    expect(excelColumnWidthToPx(2.71)).toBe(19);
    expect(excelColumnWidthToPx(14.71)).toBe(103);
    const cols = [2.71, 14.71, 5.21, 5.71, 8.71, 11.21, 2.71, 2.71, 14.71, 5.21, 5.71, 8.71, 11.21, 2.71];
    const scale = nakladnoyPrintScalePercent(cols, 0.2362);
    expect(scale).toBeGreaterThan(90);
    expect(scale).toBeLessThanOrEqual(100);
    expect(nakladnoyPageCapacityPt(scale, 0.2362)).toBeGreaterThan(750);
  });
});

function line(i: number, name: string): NakladnoyLine {
  return {
    productId: i,
    sku: `SKU${i}`,
    barcode: null,
    name,
    qty: 2,
    bonusQty: 0,
    price: 1000,
    sum: 2000,
    groupTitle: "G",
    qtyPerBlock: null
  };
}

function order(id: number, lineCount: number): NakladnoyOrderPayload {
  const paidLines = Array.from({ length: lineCount }, (_, i) =>
    line(i + 1, i % 3 === 0 ? `Juda uzun mahsulot nomi raqam ${i} qadoq 1.5L x 6` : `Mahsulot ${i}`)
  );
  return {
    id,
    number: String(1000 + id),
    createdAt: new Date(2026, 8, 1),
    tenantName: "T",
    tenantPhone: null,
    clientName: `Klient ${id}`,
    clientPhone: "998901234567",
    clientBalanceNum: null,
    clientAddress: "Toshkent",
    clientLandmark: null,
    orderComment: null,
    discountSum: 0,
    currencyLabel: "UZS",
    agentLine: "",
    invoiceAgentLine: "",
    agentName: "Agent",
    agentPhone: null,
    expeditorLine: "",
    expeditorName: "Exp",
    expeditorPhone: null,
    territory: "T",
    invoiceTerritory: "T",
    warehouseName: null,
    agentId: 1,
    expeditorUserId: 1,
    isConsignment: false,
    paymentMethodRef: "cash",
    orderType: "order",
    lines: paidLines,
    paidLines,
    bonusLines: id % 2 === 0 ? [line(99, "Bonus")] : []
  };
}

describe("buildConsignmentWorkbook pagination", () => {
  it("writes row breaks only between client blocks and exposes them to the web preview", async () => {
    const sizes = [12, 3, 20, 5, 9, 2, 15, 7, 4, 11];
    const orders = sizes.map((n, i) => order(i + 1, n));
    const buf = await buildConsignmentWorkbook(orders, {
      codeColumn: "sku",
      separateSheets: false,
      groupBy: "agent"
    });

    const preview = await workbookBufferToNakladnoyPreview(buf, { label: "2.1.7", filename: "x.xlsx" });
    expect(preview.pages).toHaveLength(1);
    const grid = preview.pages[0]!.grid!;
    const breaks = grid.pageBreakAfterRows ?? [];
    expect(breaks.length).toBeGreaterThan(0);
    expect(grid.colWidthsPx).toHaveLength(grid.colCount);
    expect(grid.rowHeightsPt).toHaveLength(grid.rows.length);

    const isClientRow = (r: number) => grid.rows[r]?.[0]?.v.startsWith("Клиент:");
    const isSignRow = (r: number) => grid.rows[r]?.[0]?.v.startsWith("Отпустил:");
    for (const b of breaks) {
      expect(isSignRow(b)).toBe(true);
      expect(isClientRow(b + 1)).toBe(true);
    }

    const clientCount = grid.rows.filter((_, r) => isClientRow(r)).length;
    expect(clientCount).toBe(orders.length);

    const cuts = [-1, ...breaks, grid.rows.length - 1];
    const capacity = nakladnoyPageCapacityPt(
      nakladnoyPrintScalePercent(
        [2.71, 14.71, 5.21, 5.71, 8.71, 11.21, 2.71, 2.71, 14.71, 5.21, 5.71, 8.71, 11.21, 2.71],
        0.2362
      ),
      0.2362
    );
    for (let p = 0; p + 1 < cuts.length; p++) {
      const from = cuts[p]! + 1;
      const to = cuts[p + 1]! + 1;
      const h = grid.rowHeightsPt!.slice(from, to).reduce((s, x) => s + x, 0);
      const clientsOnPage = grid.rows.slice(from, to).filter((row) => row[0]?.v.startsWith("Клиент:")).length;
      if (clientsOnPage > 1) expect(h).toBeLessThanOrEqual(capacity);
      else expect(clientsOnPage).toBe(1);
    }
  });

  it("marks a single-page consignment sheet as paged without breaks", async () => {
    const buf = await buildConsignmentWorkbook([order(1, 3)], {
      codeColumn: "sku",
      separateSheets: false,
      groupBy: "agent"
    });
    const preview = await workbookBufferToNakladnoyPreview(buf, { label: "2.1.7", filename: "x.xlsx" });
    expect(preview.pages[0]!.grid!.pageBreakAfterRows).toEqual([]);
  });
});
