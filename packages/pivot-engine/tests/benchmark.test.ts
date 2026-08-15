import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import { handlePivotWorkerRequest } from "../src/worker/handleCompute.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";
import { generate10kRows } from "./fixtures/generate-10k.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "product", label: "Mahsulot", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" },
  { id: "qty", label: "Miqdor", dataType: "number" }
];

describe("PivotEngine benchmark", () => {
  const engine = new PivotEngine();
  const data = generate10kRows();

  it("10k qator — 2s ichida hisoblanadi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region", "product"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      options: {
        ...DEFAULT_PIVOT_CONFIG.options,
        sortBy: { fieldId: "amount", direction: "desc" }
      }
    };

    const result = engine.compute(data, FIELDS, config);

    expect(result.metadata.processedRows).toBe(10_000);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.metadata.executionTime).toBeLessThan(2000);
  });

  it("worker handler — 10k qator 500ms ichida", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };

    const response = handlePivotWorkerRequest({
      type: "compute",
      id: "bench",
      rawData: data,
      fields: FIELDS,
      config
    });

    expect(response.type).toBe("result");
    if (response.type === "result") {
      expect(response.result.metadata.processedRows).toBe(10_000);
      expect(response.result.metadata.executionTime).toBeLessThan(500);
    }
  });
});
