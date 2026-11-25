/**
 * Expeditor shipments matrix (SalesDoc /report/expeditor) — not FlatReport flat cols.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateCells,
  colKey,
  filterEmptyExpeditorColumns,
  groupRowsByCategory,
  resolveExpeditorColumns
} from "@/components/reports/expeditor-shipments/expeditor-shipments-matrix";

const frontendRoot = join(__dirname, "..");

function read(rel: string) {
  return readFileSync(join(frontendRoot, rel), "utf8");
}

describe("expeditor-shipments matrix helpers", () => {
  it("resolveExpeditorColumns prefers selected filter order and keeps empty cols", () => {
    const cols = resolveExpeditorColumns({
      selectedIds: ["5", "2"],
      reportColumns: [{ expeditor_id: 2, expeditor_name: "B" }],
      filterExpeditors: [
        { id: 2, name: "B" },
        { id: 5, name: "A" }
      ]
    });
    expect(cols.map((c) => c.expeditor_id)).toEqual([5, 2]);
    expect(cols[0]?.expeditor_name).toBe("A");
  });

  it("resolveExpeditorColumns falls back to report columns when nothing selected", () => {
    const cols = resolveExpeditorColumns({
      selectedIds: [],
      reportColumns: [
        { expeditor_id: 9, expeditor_name: "X" },
        { expeditor_id: null, expeditor_name: "Без экспедитора" }
      ],
      filterExpeditors: [{ id: 1, name: "Ignored" }]
    });
    expect(cols).toHaveLength(2);
    expect(cols[1]?.expeditor_id).toBeNull();
  });

  it("groupRowsByCategory builds parent totals as sum of product cells", () => {
    const groups = groupRowsByCategory(
      [
        {
          product_id: 1,
          product_name: "ZERELLE",
          category_name: "JENSKIY",
          cells: {
            "5": { block_count: 12, volume: "0", qty: "12", amount: "165600.00" }
          }
        },
        {
          product_id: 2,
          product_name: "LIVIAL",
          category_name: "JENSKIY",
          cells: {
            "5": { block_count: 12, volume: "120", qty: "12", amount: "154800.00" }
          }
        }
      ],
      [{ expeditor_id: 5, expeditor_name: "G" }]
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category_name).toBe("JENSKIY");
    expect(groups[0]?.products).toHaveLength(2);
    expect(groups[0]?.cells["5"]).toEqual({
      block_count: 24,
      volume: "120",
      qty: "24",
      amount: "320400.00"
    });
  });

  it("aggregateCells sums numeric fields", () => {
    expect(
      aggregateCells([
        { block_count: 1, volume: "10.5", qty: "2", amount: "100.00" },
        { block_count: 3, volume: "0.5", qty: "4", amount: "50.50" }
      ])
    ).toEqual({ block_count: 4, volume: "11", qty: "6", amount: "150.50" });
  });

  it("filterEmptyExpeditorColumns hides zero totals unless showEmpty or forced", () => {
    const columns = [
      { expeditor_id: 1, expeditor_name: "A" },
      { expeditor_id: 2, expeditor_name: "B" },
      { expeditor_id: null, expeditor_name: "Без экспедитора" }
    ];
    const totals = {
      "1": { block_count: 2, volume: "1", qty: "2", amount: "10.00", invoice_count: 1 },
      "2": { block_count: 0, volume: "0", qty: "0", amount: "0.00", invoice_count: 0 },
      none: { block_count: 0, volume: "0", qty: "0", amount: "0.00", invoice_count: 0 }
    };
    expect(
      filterEmptyExpeditorColumns({ columns, totals, showEmpty: false }).map((c) => c.expeditor_id)
    ).toEqual([1]);
    expect(
      filterEmptyExpeditorColumns({ columns, totals, showEmpty: true }).map((c) => c.expeditor_id)
    ).toEqual([1, 2, null]);
    expect(
      filterEmptyExpeditorColumns({
        columns,
        totals,
        showEmpty: false,
        forceKeepIds: ["2", "none"]
      }).map((c) => colKey(c.expeditor_id))
    ).toEqual(["1", "2", "none"]);
  });
});

describe("expeditor-shipments page contract (SalesDoc matrix)", () => {
  it("uses dedicated workspace, not FlatReportPage", () => {
    const page = read("app/(dashboard)/reports/expeditor-shipments/page.tsx");
    expect(page).not.toMatch(/FlatReportPage/);
    expect(page).toMatch(/ExpeditorShipmentsWorkspace/);
  });

  it("matrix table has dual header, category expand, invoice footer", () => {
    const table = join(
      frontendRoot,
      "components/reports/expeditor-shipments/expeditor-shipments-table.tsx"
    );
    expect(existsSync(table)).toBe(true);
    const src = readFileSync(table, "utf8");
    expect(src).toMatch(/colSpan=\{4\}/);
    expect(src).toMatch(/Блок|Бл/);
    expect(src).toMatch(/Накладных|накладных/);
    expect(src).toMatch(/groupRowsByCategory|category_name/);
    expect(src).toMatch(/ChevronRight|openCat|expanded/);
  });
});
