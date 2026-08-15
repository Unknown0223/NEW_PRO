import { describe, expect, it } from "vitest";
import {
  defaultDatasetFilters,
  emptyReportBuilderExtraFilters,
  extractSavedDatasetFilters,
  isWdrSavedConfig,
  migrateLegacyReportBuilderConfigToWdrReport,
  wdrSliceToLegacyExportPayload
} from "@/lib/report-builder-wdr-migrate";

describe("report-builder-wdr-migrate", () => {
  it("migrateLegacy builds slice with measures", () => {
    const wdr = migrateLegacyReportBuilderConfigToWdrReport({
      datasetId: "orders_sales_lines",
      dateMode: "order_date",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      agentIds: [],
      statuses: [],
      orderTypes: [],
      ...emptyReportBuilderExtraFilters(),
      rowFieldIds: ["warehouse_name"],
      colFieldIds: ["supervisor_code"],
      metrics: { amount: true, qty: true, volume: false, akb: true }
    });
    expect(wdr.slice?.rows?.map((r) => r.uniqueName)).toEqual(["warehouse_name"]);
    expect(wdr.slice?.columns?.map((c) => c.uniqueName)).toEqual(["supervisor_code"]);
    const names = (wdr.slice?.measures ?? []).map((m) => `${m.uniqueName}:${m.aggregation}`);
    expect(names).toContain("amount:sum");
    expect(names).toContain("qty:sum");
    expect(names).toContain("client_id:distinctcount");
  });

  it("isWdrSavedConfig detects WebDataRocks report", () => {
    expect(isWdrSavedConfig({ dataSource: { data: [] }, slice: {} })).toBe(true);
    expect(isWdrSavedConfig({ rowFieldIds: [] })).toBe(false);
  });

  it("wdrSliceToLegacyExportPayload maps measures", () => {
    const legacy = wdrSliceToLegacyExportPayload(
      defaultDatasetFilters(),
      {
        rows: [{ uniqueName: "product_name" }],
        columns: [],
        measures: [
          { uniqueName: "amount", aggregation: "sum" },
          { uniqueName: "client_id", aggregation: "distinctcount" }
        ]
      }
    );
    expect(legacy.rowFieldIds).toEqual(["product_name"]);
    expect(legacy.metrics.amount).toBe(true);
    expect(legacy.metrics.akb).toBe(true);
  });

  it("defaultDatasetFilters returns valid range", () => {
    const f = defaultDatasetFilters();
    expect(f.datasetId).toBe("orders_sales_lines");
    expect(f.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.warehouseIds).toEqual([]);
  });

  it("extractSavedDatasetFilters from savdoDatasetFilters", () => {
    const f = extractSavedDatasetFilters({
      savdoDatasetFilters: {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [1],
        warehouseIds: [5]
      }
    });
    expect(f?.dateFrom).toBe("2026-01-01");
    expect(f?.agentIds).toEqual([1]);
    expect(f?.warehouseIds).toEqual([5]);
  });

  it("extractSavedDatasetFilters — WDR saved full fixture", () => {
    const report = {
      savdoDatasetFilters: {
        datasetId: "orders_sales_lines",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [42],
        statuses: ["delivered"]
      }
    };
    const f = extractSavedDatasetFilters(report);
    expect(f?.agentIds).toEqual([42]);
    expect(f?.statuses).toEqual(["delivered"]);
  });
});
