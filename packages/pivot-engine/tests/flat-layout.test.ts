import { describe, expect, it } from "vitest";
import { PivotEngine } from "../src/core/PivotEngine.js";
import { buildFlatPivotData, getFlatColumnFieldIds } from "../src/utils/buildFlatPivotData.js";
import { resolveLayoutForm, withLayoutForm } from "../src/utils/layoutForm.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const fields: PivotField[] = [
  { id: "client", label: "Клиент", dataType: "string" },
  { id: "agent", label: "Агент", dataType: "string" },
  { id: "amount", label: "Сумма", dataType: "number" }
];

const raw = [
  { client: "A", agent: "X", amount: 10 },
  { client: "B", agent: "Y", amount: 20 }
];

function flatConfig(partial?: Partial<PivotConfig>): PivotConfig {
  return {
    rows: ["client", "agent"],
    columns: [],
    values: [{ fieldId: "amount", aggregation: "SUM" }],
    reportFilters: [],
    filters: [],
    options: withLayoutForm(
      {
        showSubtotals: false,
        showGrandTotal: true,
        showColumnTotals: false,
        compactMode: false,
        drillDown: false
      },
      "flat"
    ),
    ...partial
  };
}

describe("layoutForm", () => {
  it("resolveLayoutForm prefers layoutForm over compactMode", () => {
    expect(resolveLayoutForm({ compactMode: true, layoutForm: "flat" } as never)).toBe("flat");
    expect(resolveLayoutForm({ compactMode: true } as never)).toBe("compact");
    expect(resolveLayoutForm({ compactMode: false } as never)).toBe("classic");
  });
});

describe("buildFlatPivotData", () => {
  it("renders one row per source record with separate columns", () => {
    const config = flatConfig();
    expect(getFlatColumnFieldIds(config)).toEqual(["client", "agent", "amount"]);
    const data = buildFlatPivotData(raw, fields, config);
    expect(data.headers[0]?.map((h) => h.label)).toEqual(["Клиент", "Агент", "Сумма"]);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]?.children).toBeUndefined();
    expect(data.rows[0]?.cells.map((c) => c.formatted)).toEqual(["A", "X", "10"]);
    expect(data.grandTotal?.cells[2]?.rawValue).toBe(30);
  });

  it("PivotEngine.compute uses flat path when layoutForm=flat", () => {
    const engine = new PivotEngine();
    const data = engine.compute(raw, fields, flatConfig());
    expect(data.rows).toHaveLength(2);
    expect(data.headers[0]?.some((h) => h.key === "__row_label__")).toBe(false);
  });
});
