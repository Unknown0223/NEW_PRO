import { describe, expect, it } from "vitest";
import {
  emptyReportBuilderExtraFilters,
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
      {
        datasetId: "orders_sales_lines",
        dateMode: "order_date",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [],
        statuses: [],
        orderTypes: [],
        ...emptyReportBuilderExtraFilters()
      },
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
});
