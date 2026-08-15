import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotField } from "../src/types/pivot.types.js";
import { pivotDataToHtml } from "../src/export/ExportHtml.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

describe("ExportHtml", () => {
  const engine = new PivotEngine();
  const data = engine.compute(
    [
      { region: "Toshkent", amount: 1000 },
      { region: "Samarqand", amount: 2000 }
    ],
    FIELDS,
    {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    }
  );

  it("pivotDataToHtml — jadval va sarlavha", () => {
    const html = pivotDataToHtml(data, { title: "Test pivot" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<table>");
    expect(html).toContain("Test pivot");
    expect(html).toContain("Итого");
    expect(html).toContain("3");
  });
});
