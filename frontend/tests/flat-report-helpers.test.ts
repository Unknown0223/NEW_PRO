/**
 * FlatReport helpers seam: draft seeding + options defaults (ADR-010 kinds).
 */
import { describe, expect, it } from "vitest";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  mapMultiOptions,
  readReportTotal,
  resolveCellValue,
  resolveReportRows
} from "@/components/reports/flat-report/flat-report-helpers";
import type { FlatReportColumn, FlatReportFilterField } from "@/components/reports/flat-report/types";

describe("buildEmptyDraft", () => {
  it("omits from/to when filterFields has no dateRange", () => {
    const fields: FlatReportFilterField[] = [
      { kind: "search", placeholder: "q" },
      { kind: "bands", paramKey: "bands" }
    ];
    const draft = buildEmptyDraft(fields, "2026-11-01", "2026-11-20", 50);
    expect(draft).not.toHaveProperty("from");
    expect(draft).not.toHaveProperty("to");
    expect(draft.bands).toBe("");
    expect(draft.page).toBe(1);
    expect(draft.limit).toBe(50);
  });

  it("seeds from/to when dateRange is present", () => {
    const fields: FlatReportFilterField[] = [{ kind: "dateRange" }];
    const draft = buildEmptyDraft(fields, "2026-11-01", "2026-11-20", 25);
    expect(draft.from).toBe("2026-11-01");
    expect(draft.to).toBe("2026-11-20");
  });

  it("seeds dual dateRange keys (sales-compare A/B)", () => {
    const fields: FlatReportFilterField[] = [
      {
        kind: "dateRange",
        fromKey: "from_a",
        toKey: "to_a",
        label: "A",
        defaultRange: "prev_month"
      },
      { kind: "dateRange", fromKey: "from_b", toKey: "to_b", label: "B" }
    ];
    const draft = buildEmptyDraft(fields, "2026-11-01", "2026-11-20", 50);
    expect(draft.from_b).toBe("2026-11-01");
    expect(draft.to_b).toBe("2026-11-20");
    expect(draft.from_a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.to_a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft).not.toHaveProperty("from");
  });

  it("seeds today for defaultRange today (visit-totals)", () => {
    const fields: FlatReportFilterField[] = [{ kind: "dateRange", defaultRange: "today" }];
    const draft = buildEmptyDraft(fields, "2026-11-01", "2026-11-20", 10);
    expect(draft.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.to).toBe(draft.from);
    expect(draft.from).not.toBe("2026-11-01");
  });

  it("seeds multiSelect defaultValue (client-sales-3 statuses)", () => {
    const fields: FlatReportFilterField[] = [
      {
        kind: "multiSelect",
        paramKey: "statuses",
        optionsFrom: "statuses",
        placeholder: "Статус",
        defaultValue: ["delivering", "delivered"]
      }
    ];
    const draft = buildEmptyDraft(fields, "2026-11-01", "2026-11-20", 50);
    expect(draft.statuses).toEqual(["delivering", "delivered"]);
  });
});

describe("resolveReportRows", () => {
  it("reads rows by default and clients via rowsKey", () => {
    expect(resolveReportRows({ rows: [{ a: 1 }] }, undefined)).toEqual([{ a: 1 }]);
    expect(resolveReportRows({ clients: [{ b: 2 }], rows: [] }, "clients")).toEqual([{ b: 2 }]);
    expect(resolveReportRows(undefined, "clients")).toEqual([]);
  });
});

describe("resolveCellValue / readReportTotal", () => {
  it("uses valueFrom when provided", () => {
    const col: FlatReportColumn = {
      key: "p1_amount",
      header: "P",
      valueFrom: (row) => {
        const cells = row.cells as Record<string, { amount: string }>;
        return cells["1"]?.amount;
      }
    };
    expect(resolveCellValue(col, { cells: { "1": { amount: "42" } } })).toBe("42");
  });

  it("reads totals object then root meta (sku-3 okb)", () => {
    expect(readReportTotal({ totals: { order_count: 3 }, okb: 9 }, "order_count")).toBe(3);
    expect(readReportTotal({ totals: {}, okb: 9 }, "okb")).toBe(9);
  });
});

describe("applyOptionsDefaults", () => {
  it("fills empty bands from filter-options key", () => {
    const fields: FlatReportFilterField[] = [
      { kind: "bands", paramKey: "bands", defaultFromOptionsKey: "default_bands" }
    ];
    const next = applyOptionsDefaults({ bands: "", page: 1, limit: 50 }, fields, {
      default_bands: "0-100,100-500"
    });
    expect(next.bands).toBe("0-100,100-500");
  });

  it("does not overwrite non-empty bands", () => {
    const fields: FlatReportFilterField[] = [
      { kind: "bands", defaultFromOptionsKey: "default_bands" }
    ];
    const next = applyOptionsDefaults({ bands: "custom", page: 1, limit: 50 }, fields, {
      default_bands: "0-100"
    });
    expect(next.bands).toBe("custom");
  });
});

describe("appendParams multi filters", () => {
  it("joins array filter values with commas (not repeated keys)", () => {
    const p = new URLSearchParams();
    appendParams(p, { statuses: ["new", "delivered"], from: "2026-11-01" });
    expect(p.get("statuses")).toBe("new,delivered");
    expect(p.toString()).not.toMatch(/statuses=.*&statuses=/);
  });
});

describe("mapMultiOptions", () => {
  it("maps value/label pairs (balance_filters)", () => {
    const items = mapMultiOptions([
      { value: "debt", label: "Долг" },
      { value: "all", label: "Все" }
    ]);
    expect(items).toEqual([
      { id: "debt", title: "Долг", searchText: "Долг" },
      { id: "all", title: "Все", searchText: "Все" }
    ]);
  });

  it("shows name only — code stays in searchText", () => {
    const items = mapMultiOptions([{ id: 42, name: "Andijon", code: "AND-01" }]);
    expect(items[0]).toEqual({
      id: "42",
      title: "Andijon",
      searchText: "Andijon AND-01"
    });
    expect(items[0].title).not.toContain("AND-01");
  });
});

describe("territory cascade helpers", () => {
  it("filters oblast/city by selected zone/region", async () => {
    const { applyTerritoryCascadeToMultiItems, pruneTerritoryCascadeDraft } = await import(
      "@/components/reports/flat-report/flat-report-helpers"
    );
    const base = {
      territory_1_list: [
        { id: "Z1", title: "Z1" },
        { id: "Z2", title: "Z2" }
      ],
      territory_2_list: [
        { id: "R1", title: "R1" },
        { id: "R2", title: "R2" }
      ],
      territory_3_list: [
        { id: "C1", title: "C1" },
        { id: "C2", title: "C2" }
      ]
    };
    const opts = {
      regions_by_zone: { Z1: ["R1"] },
      cities_by_zone_region: { "Z1|||R1": ["C1"] }
    };
    const cascaded = applyTerritoryCascadeToMultiItems(
      { territory_1_list: ["Z1"], territory_2_list: ["R1", "R2"], territory_3_list: ["C1", "C2"] },
      opts,
      base
    );
    expect(cascaded.territory_2_list?.map((x) => x.id)).toEqual(["R1"]);
    expect(cascaded.territory_3_list?.map((x) => x.id)).toEqual(["C1"]);
    const pruned = pruneTerritoryCascadeDraft(
      { territory_1_list: ["Z1"], territory_2_list: ["R1", "R2"], territory_3_list: ["C1", "C2"] },
      cascaded
    );
    expect(pruned.territory_2_list).toEqual(["R1"]);
    expect(pruned.territory_3_list).toEqual(["C1"]);
  });
});
