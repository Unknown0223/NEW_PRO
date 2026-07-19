import { describe, expect, it } from "vitest";
import type { PivotRow, PivotTotalRow } from "../src/types/pivot.types.js";
import { flattenPivotDisplayRows } from "../src/utils/flattenPivotRows.js";

describe("flattenPivotDisplayRows", () => {
  const child: PivotRow = {
    key: "a|child",
    depth: 1,
    cells: [
      { value: "Child", rawValue: null, formatted: "Child", columnKey: "__row_label__", isEmpty: false },
      { value: 10, rawValue: 10, formatted: "10", columnKey: "qty", isEmpty: false }
    ]
  };

  const parent: PivotRow = {
    key: "a",
    depth: 0,
    cells: [
      { value: "A", rawValue: null, formatted: "A", columnKey: "__row_label__", isEmpty: false },
      { value: 10, rawValue: 10, formatted: "10", columnKey: "qty", isEmpty: false }
    ],
    children: [child],
    subtotal: {
      label: "Промежуточный итог",
      cells: [
        {
          value: "A (oraliq)",
          rawValue: null,
          formatted: "A (oraliq)",
          columnKey: "__row_label__",
          isEmpty: false
        }
      ]
    }
  };

  const grand: PivotTotalRow = {
    label: "Итого",
    cells: [{ value: "Итого", rawValue: null, formatted: "Итого", columnKey: "__row_label__", isEmpty: false }]
  };

  it("compact yig'ilgan — faqat ota qator", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(), grand);
    expect(flat).toHaveLength(2);
    expect(flat[0]?.type).toBe("row");
    expect(flat[1]?.type).toBe("grandTotal");
  });

  it("compact yoyilgan — ota + bola + subtotal", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(["a"]), grand);
    expect(flat.map((f) => f.type)).toEqual(["row", "row", "subtotal", "grandTotal"]);
  });

  it("compact pathLabels — har field alohida, ota bola da takrorlanadi", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(["a"]), grand);
    const rowItems = flat.filter((f) => f.type === "row");
    expect(rowItems).toHaveLength(2);
    if (rowItems[0]?.type === "row") {
      expect(rowItems[0].pathLabels).toEqual(["A"]);
      expect(rowItems[0].depth).toBe(0);
    }
    if (rowItems[1]?.type === "row") {
      expect(rowItems[1].pathLabels).toEqual(["A", "Child"]);
      expect(rowItems[1].depth).toBe(1);
    }
  });

  it("classic yoyilgan — ota alohida emas, bola bir qatorda pathLabels bilan", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(["a"]), grand, undefined, "classic");
    expect(flat.map((f) => f.type)).toEqual(["row", "subtotal", "grandTotal"]);
    const row = flat[0];
    expect(row?.type).toBe("row");
    if (row?.type === "row") {
      expect(row.pathLabels).toEqual(["A", "Child"]);
      expect(row.depth).toBe(1);
    }
  });

  it("classic yig'ilgan — faqat ota pathLabels", () => {
    const flat = flattenPivotDisplayRows([parent], new Set(), grand, undefined, "classic");
    const row = flat[0];
    expect(row?.type).toBe("row");
    if (row?.type === "row") {
      expect(row.pathLabels).toEqual(["A"]);
      expect(row.hasChildren).toBe(true);
    }
  });

  it("columnTotals — grand total dan oldin", () => {
    const colTotal: PivotTotalRow = {
      label: "Итог по столбцам",
      cells: [
        {
          value: "Итог по столбцам",
          rawValue: null,
          formatted: "Итог по столбцам",
          columnKey: "__row_label__",
          isEmpty: false
        }
      ]
    };
    const flat = flattenPivotDisplayRows([parent], new Set(), grand, colTotal);
    expect(flat.map((f) => f.type)).toEqual(["row", "columnTotal", "grandTotal"]);
  });
});
