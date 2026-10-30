import { describe, expect, it } from "vitest";
import type { PivotConfig, PivotData, PivotField, PivotRow } from "@salec/pivot-engine";
import {
  blankRepeatedParentLabels,
  flattenPivotRowsLocal
} from "@/lib/pivot-flatten";
import {
  buildScreenMatchingPivotAoA,
  resolveClassicLabelsForExport
} from "@/lib/pivot-export-screen-aoa";

function cell(label: string, value = 1): PivotRow["cells"] {
  return [
    {
      value: label,
      rawValue: null,
      formatted: label,
      columnKey: "__row_label__",
      isEmpty: false
    },
    {
      value,
      rawValue: value,
      formatted: String(value),
      columnKey: "order_id_t",
      isEmpty: false
    }
  ];
}

const fields: PivotField[] = [
  { id: "client_name", label: "Клиент", dataType: "string" },
  { id: "client_category", label: "Категория клиента", dataType: "string" },
  { id: "zone", label: "Зона", dataType: "string" },
  { id: "region", label: "Область", dataType: "string" },
  { id: "city", label: "Город", dataType: "string" },
  { id: "agent", label: "Агент", dataType: "string" },
  { id: "order_id_t", label: "Заказ ID", dataType: "number" }
];

const classicConfig: PivotConfig = {
  rows: ["client_name", "client_category", "zone", "region", "city", "agent"],
  columns: [],
  values: [{ fieldId: "order_id_t", aggregation: "SUM" }],
  reportFilters: [],
  filters: [],
  options: {
    showSubtotals: false,
    showGrandTotal: true,
    showColumnTotals: false,
    compactMode: false,
    layoutForm: "classic",
    drillDown: true
  }
};

/** UI screenshot / broken Excel: multi row dims → one «Группа» tree. */
function buildClassicDealerSample(): PivotData {
  const leaf1: PivotRow = {
    key: "Asosiy mijoz (tashqi) | retail | N/A | N/A | N/A | Agent 01 TEST",
    depth: 5,
    cells: cell("Agent 01 TEST", 2)
  };
  const leaf2: PivotRow = {
    key: "Asosiy mijoz (baza) (пром.) | retail | N/A | N/A | N/A | Agent 01 TEST",
    depth: 5,
    cells: cell("Agent 01 TEST", 2)
  };

  function nest(parts: string[], leaf: PivotRow, depth = 0): PivotRow {
    if (depth >= parts.length - 1) return leaf;
    const key = parts.slice(0, depth + 1).join(" | ");
    return {
      key,
      depth,
      cells: cell(parts[depth]!, 2),
      children: [nest(parts, leaf, depth + 1)]
    };
  }

  const parts1 = [
    "Asosiy mijoz (tashqi)",
    "retail",
    "N/A",
    "N/A",
    "N/A",
    "Agent 01 TEST"
  ];
  const parts2 = [
    "Asosiy mijoz (baza) (пром.)",
    "retail",
    "N/A",
    "N/A",
    "N/A",
    "Agent 01 TEST"
  ];

  return {
    headers: [
      [
        {
          key: "__row_label__",
          label: "Группа",
          colspan: 1,
          rowspan: 1,
          depth: 0,
          isValue: false
        },
        {
          key: "order_id_t",
          label: "Заказ ID",
          colspan: 1,
          rowspan: 1,
          depth: 0,
          isValue: true
        }
      ]
    ],
    rows: [nest(parts1, leaf1), nest(parts2, leaf2)],
    grandTotal: {
      label: "Итого",
      cells: [
        {
          value: "Итого",
          rawValue: null,
          formatted: "Итого",
          columnKey: "__row_label__",
          isEmpty: false
        },
        {
          value: 2,
          rawValue: 2,
          formatted: "2",
          columnKey: "order_id_t",
          isEmpty: false
        }
      ]
    },
    metadata: {
      totalRows: 2,
      processedRows: 2,
      executionTime: 1,
      warnings: []
    }
  };
}

describe("buildScreenMatchingPivotAoA — classic multi-column = UI", () => {
  it("headers: Клиент…Агент + Заказ ID, not «Группа»", () => {
    const data = buildClassicDealerSample();
    const aoa = buildScreenMatchingPivotAoA(data, classicConfig, fields, {
      expandAllForExport: true
    });

    expect(aoa[0]).toEqual([
      "Клиент",
      "Категория клиента",
      "Зона",
      "Область",
      "Город",
      "Агент",
      "Заказ ID"
    ]);
    expect(aoa[0]).not.toContain("Группа");
  });

  it("body: leaf rows with all dims; classic blanks repeated parents", () => {
    const data = buildClassicDealerSample();
    const aoa = buildScreenMatchingPivotAoA(data, classicConfig, fields, {
      expandAllForExport: true
    });

    // header + 2 leaves + grand total
    expect(aoa.length).toBe(4);

    const row1 = aoa[1]!;
    expect(row1).toEqual([
      "Asosiy mijoz (tashqi)",
      "retail",
      "N/A",
      "N/A",
      "N/A",
      "Agent 01 TEST",
      "2"
    ]);

    // second client — classic blanks parents that match? Different client so all filled
    const row2 = aoa[2]!;
    expect(row2[0]).toBe("Asosiy mijoz (baza) (пром.)");
    expect(row2[1]).toBe("retail");
    expect(row2[5]).toBe("Agent 01 TEST");
    expect(row2[6]).toBe("2");

    const total = aoa[3]!;
    expect(total[0]).toBe("Итого");
    expect(total.slice(1, 6)).toEqual(["", "", "", "", ""]);
    expect(total[6]).toBe("2");
  });

  it("UI flatten pathLabels match export labels (before classic blanking)", () => {
    const data = buildClassicDealerSample();
    const expanded = new Set<string>();
    const walk = (rows: PivotRow[]) => {
      for (const r of rows) {
        expanded.add(r.key);
        if (r.children) walk(r.children);
      }
    };
    walk(data.rows);

    const flat = flattenPivotRowsLocal(
      data.rows,
      expanded,
      data.grandTotal,
      undefined,
      "classic",
      6
    );
    const leafItems = flat.filter((i) => i.type === "row");
    expect(leafItems).toHaveLength(2);

    let prev: string[] | null = null;
    const uiRows = leafItems.map((item) => {
      if (item.type !== "row") return [];
      const full = resolveClassicLabelsForExport(
        item.pathLabels,
        item.row,
        item.depth,
        6
      );
      const blanked = blankRepeatedParentLabels(full, prev);
      prev = full;
      return blanked;
    });

    const aoa = buildScreenMatchingPivotAoA(data, classicConfig, fields, {
      expandAllForExport: true
    });
    expect(aoa[1]?.slice(0, 6)).toEqual(uiRows[0]);
    expect(aoa[2]?.slice(0, 6)).toEqual(uiRows[1]);
  });

  it("compact multi-column repeats parent labels (no blanking)", () => {
    const data = buildClassicDealerSample();
    const compactConfig: PivotConfig = {
      ...classicConfig,
      options: { ...classicConfig.options, layoutForm: "compact", compactMode: true }
    };
    const aoa = buildScreenMatchingPivotAoA(data, compactConfig, fields, {
      expandAllForExport: true
    });
    // compact shows parents + leaves — more rows than classic leaves-only
    expect(aoa[0]?.[0]).toBe("Клиент");
    expect(aoa.some((r) => r[0] === "Asosiy mijoz (tashqi)")).toBe(true);
    // no indented «Группа» style
    expect(aoa.every((r) => !String(r[0]).startsWith("  "))).toBe(true);
  });

  it("flat layout keeps field headers as-is", () => {
    const flatData: PivotData = {
      headers: [
        [
          { key: "client_name", label: "Клиент", colspan: 1, rowspan: 1, depth: 0, isValue: false },
          { key: "agent", label: "Агент", colspan: 1, rowspan: 1, depth: 0, isValue: false },
          { key: "order_id_t", label: "Заказ ID", colspan: 1, rowspan: 1, depth: 0, isValue: true }
        ]
      ],
      rows: [
        {
          key: "r1",
          depth: 0,
          cells: [
            {
              value: "A",
              rawValue: null,
              formatted: "A",
              columnKey: "client_name",
              isEmpty: false
            },
            {
              value: "Agent",
              rawValue: null,
              formatted: "Agent",
              columnKey: "agent",
              isEmpty: false
            },
            {
              value: 2,
              rawValue: 2,
              formatted: "2",
              columnKey: "order_id_t",
              isEmpty: false
            }
          ]
        }
      ],
      metadata: { totalRows: 1, processedRows: 1, executionTime: 0, warnings: [] }
    };
    const flatConfig: PivotConfig = {
      ...classicConfig,
      rows: ["client_name", "agent", "order_id_t"],
      values: [],
      options: { ...classicConfig.options, layoutForm: "flat" }
    };
    const aoa = buildScreenMatchingPivotAoA(flatData, flatConfig, fields);
    expect(aoa[0]).toEqual(["Клиент", "Агент", "Заказ ID"]);
    expect(aoa[1]).toEqual(["A", "Agent", "2"]);
  });
});
