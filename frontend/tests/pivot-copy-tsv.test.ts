import { describe, expect, it } from "vitest";
import type { PivotConfig, PivotRow } from "@salec/pivot-engine";
import { flatPivotToTsv, selectionToTsv } from "@/components/pivot/PivotTable/selection";
import type { LocalFlatPivotRowItem } from "@/lib/pivot-flatten";

function rowItem(labels: string[], value: string): LocalFlatPivotRowItem {
  const row: PivotRow = {
    key: labels.join(" | "),
    depth: labels.length - 1,
    cells: [
      {
        value: labels[labels.length - 1] ?? "",
        rawValue: null,
        formatted: labels[labels.length - 1] ?? "",
        columnKey: "__row_label__",
        isEmpty: false
      },
      {
        value: Number(value),
        rawValue: Number(value),
        formatted: value,
        columnKey: "amount",
        isEmpty: false
      }
    ]
  };
  return {
    type: "row",
    row,
    depth: labels.length - 1,
    expanded: false,
    hasChildren: false,
    rowKey: row.key,
    pathLabels: labels
  };
}

const config: PivotConfig = {
  rows: ["zone", "agent"],
  columns: [],
  values: [{ fieldId: "amount", aggregation: "SUM" }],
  reportFilters: [],
  filters: [],
  options: {
    showSubtotals: false,
    showGrandTotal: false,
    showColumnTotals: false,
    compactMode: false,
    layoutForm: "classic",
    drillDown: true
  }
};

describe("pivot copy TSV", () => {
  const flat: LocalFlatPivotRowItem[] = [
    rowItem(["N/A", "Agent 01"], "550000"),
    rowItem(["Andijon", "Agent 02"], "100")
  ];
  const keys = ["__row_dim_0__", "__row_dim_1__", "amount"];
  const opts = { useRowDimColumns: true, rowFieldCount: 2, config };

  it("selectionToTsv — faqat belgilangan kataklar", () => {
    const tsv = selectionToTsv(
      flat,
      keys,
      { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 2 } },
      opts
    );
    expect(tsv).toBe("N/A\tAgent 01\t550000");
  });

  it("flatPivotToTsv — sarlavha + barcha qatorlar (ekran sxemasi)", () => {
    const tsv = flatPivotToTsv(flat, keys, ["Зона", "Агент", "Сумма"], opts);
    const lines = tsv.split("\n");
    expect(lines[0]).toBe("Зона\tАгент\tСумма");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("N/A");
    expect(lines[2]).toContain("Andijon");
  });
});
