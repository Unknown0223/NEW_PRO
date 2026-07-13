import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { savedReportConfigToPivotConfig } from "@/lib/pivot-bridge";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../packages/pivot-engine/tests/fixtures"
);

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

describe("pivot-bridge saved reports", () => {
  it("savedReportConfigToPivotConfig — WDR saved full", () => {
    const report = loadFixture("wdr-slice-saved-full.json");
    const config = savedReportConfigToPivotConfig(report);
    expect(config?.rows).toEqual(["agent_name"]);
    expect(config?.values[0]?.aggregation).toBe("SUM");
  });

  it("savedReportConfigToPivotConfig — salec pivot config", () => {
    const config = savedReportConfigToPivotConfig({
      dataSource: { type: "salec-pivot-engine" },
      salecPivotConfig: {
        rows: ["warehouse_name"],
        columns: [],
        reportFilters: [],
        values: [{ fieldId: "amount", aggregation: "SUM" }],
        filters: []
      }
    });
    expect(config?.rows).toEqual(["warehouse_name"]);
  });
});
