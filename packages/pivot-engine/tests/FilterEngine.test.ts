import { describe, expect, it } from "vitest";
import { FilterEngine } from "../src/core/FilterEngine.js";
import type { PivotField, PivotFilter } from "../src/types/pivot.types.js";

describe("FilterEngine", () => {
  const engine = new FilterEngine();
  const fields: PivotField[] = [
    { id: "region", label: "Hudud", dataType: "string" },
    { id: "amount", label: "Summa", dataType: "currency" },
    { id: "sale_date", label: "Sana", dataType: "date" }
  ];

  const data = [
    { region: "Toshkent", amount: 100, sale_date: "2025-01-15" },
    { region: "Samarqand", amount: 250, sale_date: "2025-02-20" },
    { region: "Buxoro", amount: 500, sale_date: "2025-03-10" }
  ];

  it("include filtri", () => {
    const filters: PivotFilter[] = [
      { fieldId: "region", type: "include", values: ["Toshkent", "Buxoro"] }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.region)).toEqual(["Toshkent", "Buxoro"]);
  });

  it("exclude filtri", () => {
    const filters: PivotFilter[] = [
      { fieldId: "region", type: "exclude", values: ["Samarqand"] }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(2);
  });

  it("range filtri", () => {
    const filters: PivotFilter[] = [
      { fieldId: "amount", type: "range", range: { min: 150, max: 400 } }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe("Samarqand");
  });

  it("date_range filtri", () => {
    const filters: PivotFilter[] = [
      {
        fieldId: "sale_date",
        type: "date_range",
        dateRange: { from: new Date("2025-02-01"), to: new Date("2025-02-28") }
      }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe("Samarqand");
  });

  it("filtrsiz — barcha qatorlar", () => {
    expect(engine.apply(data, [], fields)).toHaveLength(3);
  });

  it("top_n filtri — eng yuqori 2 hudud (summa bo'yicha)", () => {
    const filters: PivotFilter[] = [
      {
        fieldId: "region",
        type: "top_n",
        topN: 2,
        measureFieldId: "amount"
      }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.region).sort()).toEqual(["Buxoro", "Samarqand"]);
  });

  it("bottom_n filtri — eng past 1 hudud", () => {
    const filters: PivotFilter[] = [
      {
        fieldId: "region",
        type: "bottom_n",
        topN: 1,
        measureFieldId: "amount"
      }
    ];
    const result = engine.apply(data, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe("Toshkent");
  });

  it("top_n — metrikasiz (qatorlar soni bo'yicha)", () => {
    const dense = [
      ...data,
      { region: "Toshkent", amount: 50, sale_date: "2025-01-20" },
      { region: "Toshkent", amount: 60, sale_date: "2025-01-21" }
    ];
    const filters: PivotFilter[] = [{ fieldId: "region", type: "top_n", topN: 1 }];
    const result = engine.apply(dense, filters, fields);
    expect(result.every((r) => r.region === "Toshkent")).toBe(true);
  });
});
