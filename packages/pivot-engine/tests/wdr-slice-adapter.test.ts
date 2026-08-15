import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mapWdrAggregation,
  parseWdrFieldId,
  wdrReportToPivotConfig,
  wdrSliceToPivotConfig,
  isWdrSavedReportConfig,
  detectSavedReportFormat
} from "../src/adapters/wdr-slice-adapter.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

describe("wdr-slice-adapter", () => {
  it("mapWdrAggregation — WDR nomlari", () => {
    expect(mapWdrAggregation("sum")).toBe("SUM");
    expect(mapWdrAggregation("distinctcount")).toBe("COUNT_DISTINCT");
    expect(mapWdrAggregation("percentofrow")).toBe("PERCENT_OF_ROW");
    expect(mapWdrAggregation("average")).toBe("AVG");
    expect(mapWdrAggregation("product")).toBe("PRODUCT");
    expect(mapWdrAggregation("index")).toBe("INDEX");
    expect(mapWdrAggregation("difference")).toBe("DIFFERENCE");
  });

  it("wdr-slice-basic fixture → PivotConfig", () => {
    const report = loadFixture("wdr-slice-basic.json");
    const config = wdrSliceToPivotConfig(report.slice);
    expect(config.rows).toEqual(["warehouse_name"]);
    expect(config.columns).toEqual(["supervisor_code"]);
    expect(config.reportFilters).toEqual(["product_name"]);
    expect(config.values).toHaveLength(2);
    expect(config.values[0]).toMatchObject({ fieldId: "amount", aggregation: "SUM" });
    expect(config.values[1]).toMatchObject({ fieldId: "qty", aggregation: "AVG" });
    expect(config.filters).toHaveLength(1);
    expect(config.filters[0]).toMatchObject({
      fieldId: "product_name",
      type: "include",
      values: ["Mahsulot A", "Mahsulot B"]
    });
  });

  it("wdr-slice-percent fixture", () => {
    const report = loadFixture("wdr-slice-percent.json");
    const config = wdrReportToPivotConfig(report);
    expect(config.values[0]?.aggregation).toBe("PERCENT_OF_ROW");
    expect(config.values[1]?.aggregation).toBe("COUNT_DISTINCT");
    expect(config.reportFilters).toEqual(["order_status"]);
  });

  it("bo'sh slice — default amount SUM", () => {
    const config = wdrSliceToPivotConfig({});
    expect(config.values[0]?.fieldId).toBe("amount");
    expect(config.values[0]?.aggregation).toBe("SUM");
  });

  it("isWdrSavedReportConfig — slice mavjud", () => {
    const report = loadFixture("wdr-slice-basic.json");
    expect(isWdrSavedReportConfig(report)).toBe(true);
    expect(detectSavedReportFormat(report)).toBe("wdr");
  });

  it("detectSavedReportFormat — pivot config", () => {
    const pivot = wdrSliceToPivotConfig({ rows: [{ uniqueName: "a" }] });
    expect(detectSavedReportFormat(pivot)).toBe("pivot");
  });

  it("exclude filter", () => {
    const config = wdrSliceToPivotConfig({
      reportFilters: [
        {
          uniqueName: "status",
          filter: { members: ["cancelled"], exclude: true }
        }
      ]
    });
    expect(config.filters[0]).toMatchObject({ type: "exclude", values: ["cancelled"] });
  });

  it("parseWdrFieldId — amount.sum format", () => {
    expect(parseWdrFieldId("amount.sum")).toBe("amount");
    const config = wdrSliceToPivotConfig({
      measures: [{ uniqueName: "qty.average", caption: "Miqdor" }]
    });
    expect(config.values[0]).toMatchObject({ fieldId: "qty", aggregation: "AVG" });
  });

  it("row filter members", () => {
    const config = wdrSliceToPivotConfig({
      rows: [
        {
          uniqueName: "warehouse_name",
          filter: { members: ["Ombor A"] }
        }
      ]
    });
    expect(config.filters[0]).toMatchObject({
      fieldId: "warehouse_name",
      type: "include",
      values: ["Ombor A"]
    });
  });

  it("wdrReportToPivotConfig — nested config.slice", () => {
    const config = wdrReportToPivotConfig({
      config: {
        slice: {
          rows: [{ uniqueName: "agent_name" }],
          measures: [{ uniqueName: "amount", aggregation: "sum" }]
        }
      }
    });
    expect(config.rows).toEqual(["agent_name"]);
  });

  it("wdr-slice-advanced fixture — P2 agregatsiyalar", () => {
    const report = loadFixture("wdr-slice-advanced.json");
    const config = wdrSliceToPivotConfig(report.slice);
    expect(config.values.map((v) => v.aggregation)).toEqual([
      "PRODUCT",
      "INDEX",
      "DIFFERENCE",
      "RUNNING_TOTAL"
    ]);
    expect(config.filters[0]).toMatchObject({
      fieldId: "warehouse_name",
      type: "include",
      values: ["Ombor A"]
    });
  });

  it("wdr-slice-saved-full fixture — to'liq saqlangan hisobot", () => {
    const report = loadFixture("wdr-slice-saved-full.json");
    expect(isWdrSavedReportConfig(report)).toBe(true);
    const config = wdrReportToPivotConfig(report);
    expect(config.rows).toEqual(["agent_name"]);
    expect(config.columns).toEqual(["order_date_month"]);
    expect(config.values[0]).toMatchObject({ fieldId: "amount", aggregation: "SUM" });
    expect(config.values[1]).toMatchObject({ fieldId: "client_id", aggregation: "COUNT_DISTINCT" });
    expect(config.reportFilters).toEqual(["order_status"]);
  });

  it("runningtotals aggregation mapping", () => {
    expect(mapWdrAggregation("runningtotals")).toBe("RUNNING_TOTAL");
  });
});
