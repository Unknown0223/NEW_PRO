import { describe, expect, it } from "vitest";
import { SortEngine } from "../src/core/SortEngine.js";
import { DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotRow } from "../src/types/pivot.types.js";

describe("SortEngine", () => {
  const engine = new SortEngine();

  const rows: PivotRow[] = [
    {
      key: "Samarqand",
      depth: 0,
      cells: [
        { value: "Samarqand", rawValue: null, formatted: "Samarqand", columnKey: "__row_label__", isEmpty: false },
        { value: 2_300_000, rawValue: 2_300_000, formatted: "2.3M", columnKey: "amount", isEmpty: false }
      ]
    },
    {
      key: "Toshkent",
      depth: 0,
      cells: [
        { value: "Toshkent", rawValue: null, formatted: "Toshkent", columnKey: "__row_label__", isEmpty: false },
        { value: 1_000_000, rawValue: 1_000_000, formatted: "1M", columnKey: "amount", isEmpty: false }
      ]
    }
  ];

  it("qator maydoni bo'yicha ASC", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const sorted = engine.sortRows(rows, { fieldId: "region", direction: "asc" }, config);
    expect(sorted[0]?.key).toBe("Samarqand");
    expect(sorted[1]?.key).toBe("Toshkent");
  });

  it("metrika bo'yicha DESC", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const sorted = engine.sortRows(rows, { fieldId: "amount", direction: "desc" }, config);
    expect(sorted[0]?.key).toBe("Samarqand");
    expect(sorted[1]?.key).toBe("Toshkent");
  });

  it("ustun spetsifikatsiyalarini tartiblaydi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const specs = [
      { colKey: "Fev__amount", colParts: ["Fev", "amount"] },
      { colKey: "Yan__amount", colParts: ["Yan", "amount"] }
    ];
    const sorted = engine.sortColSpecs(specs, { fieldId: "month", direction: "asc" }, config);
    expect(sorted[0]?.colParts[0]).toBe("Fev");
    expect(sorted[1]?.colParts[0]).toBe("Yan");
  });

  it("sortBy yo'q — tartib o'zgarmaydi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const sorted = engine.sortRows(rows, undefined, config);
    expect(sorted.map((r) => r.key)).toEqual(rows.map((r) => r.key));
  });
});
