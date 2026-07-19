import { describe, expect, it } from "vitest";
import {
  applyCalculatedMeasures,
  compileFormula,
  evaluateFormula
} from "../src/utils/index.js";
import type { CalculatedMeasure, PivotField } from "../src/types/pivot.types.js";

describe("calculatedMeasures premium", () => {
  const fields: PivotField[] = [
    { id: "amount", label: "Sum", dataType: "number" },
    { id: "qty", label: "Qty", dataType: "number" }
  ];

  it("custom formula add + evaluate on rows", () => {
    const measures: CalculatedMeasure[] = [
      { id: "calc_margin", label: "Margin", formula: "amount * 0.05" }
    ];
    const rows = applyCalculatedMeasures(
      [
        { amount: 200_000, qty: 4 },
        { amount: 50_000, qty: 1 }
      ],
      measures,
      fields
    );
    expect(rows[0]?.calc_margin).toBe(10_000);
    expect(rows[1]?.calc_margin).toBe(2_500);
  });

  it("compileFormula validates before add", () => {
    expect(() => compileFormula("amount + hack", ["amount", "qty"])).toThrow(/Недопустимое поле/);
    expect(evaluateFormula("amount + qty", { amount: 10, qty: 3 }, ["amount", "qty"])).toBe(13);
  });
});
