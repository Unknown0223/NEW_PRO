import { describe, expect, it } from "vitest";
import type { PivotRow, PivotTotalRow } from "../src/types/pivot.types.js";
import { flattenPivotDisplayRows } from "../src/utils/flattenPivotRows.js";

describe("flattenPivotDisplayRows", () => {
  const child: PivotRow = {
    key: "a|child",
    depth: 1,
    cells: [{ value: "Child", rawValue: null, formatted: "Child", columnKey: "__row_label__", isEmpty: false }]
  };

  const parent: PivotRow = {
    key: "a",
    depth: 0,
    cells: [{ value: "A", rawValue: null, formatted: "A", columnKey: "__row_label__", isEmpty: false }],
    children: [child],
    subtotal: {
      label: "Промежуточный итог",
      cells: [{ value: "A (oraliq)", rawValue: null, formatted: "A (oraliq)", columnKey: "__row_label__", isEmpty: false }]
    }
  };

  const grand: PivotTotalRow = {
    label: "Итого",
    cells: [{ value: "Итого", rawValue: null, formatted: "Итого", columnKey: "__row_label__", isEmpty: false }]
  };

  it("yig'ilgan — faqat ota qator", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(), grand);
    expect(flat).toHaveLength(2);
    expect(flat[0]?.type).toBe("row");
    expect(flat[1]?.type).toBe("grandTotal");
  });

  it("yoyilgan — bola va subtotal", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(["a"]), grand);
    expect(flat.map((f) => f.type)).toEqual(["row", "row", "subtotal", "grandTotal"]);
  });

  it("columnTotals — grand total dan oldin", () => {
    const colTotal: PivotTotalRow = {
      label: "Итог по столбцам",
      cells: [{ value: "Итог по столбцам", rawValue: null, formatted: "Итог по столбцам", columnKey: "__row_label__", isEmpty: false }]
    };
    const flat = flattenPivotDisplayRows([parent], new Set(), grand, colTotal);
    expect(flat.map((f) => f.type)).toEqual(["row", "columnTotal", "grandTotal"]);
  });
});
