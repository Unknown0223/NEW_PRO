import { describe, expect, it } from "vitest";
import { isReportBuilderFieldId, listWdrFieldsForDataset } from "../src/modules/report-builder/report-builder.metadata";
import {
  validateReportBuilderConfig,
  validateReportBuilderDatasetRequest,
  validateReportBuilderSavedConfigBody
} from "../src/modules/report-builder/report-builder.validate";

describe("validateReportBuilderConfig", () => {
  it("accepts minimal valid body", () => {
    const v = validateReportBuilderConfig(
      {
        datasetId: "orders_sales_lines",
        dateMode: "order_date",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [],
        statuses: [],
        orderTypes: [],
        rowFieldIds: ["product_name"],
        colFieldIds: [],
        metrics: { amount: true, qty: false, volume: false, akb: false }
      },
      {}
    );
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.config.rowFieldIds).toEqual(["product_name"]);
  });

  it("rejects unknown field", () => {
    const v = validateReportBuilderConfig(
      {
        datasetId: "orders_sales_lines",
        dateMode: "order_date",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [],
        statuses: [],
        orderTypes: [],
        rowFieldIds: ["not_a_field"],
        colFieldIds: [],
        metrics: { amount: true, qty: false, volume: false, akb: false }
      },
      {}
    );
    expect(v.ok).toBe(false);
  });

  it("rejects no metrics", () => {
    const v = validateReportBuilderConfig(
      {
        datasetId: "orders_sales_lines",
        dateMode: "order_date",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        agentIds: [],
        statuses: [],
        orderTypes: [],
        rowFieldIds: [],
        colFieldIds: [],
        metrics: { amount: false, qty: false, volume: false, akb: false }
      },
      {}
    );
    expect(v.ok).toBe(false);
  });
});

describe("validateReportBuilderDatasetRequest", () => {
  it("accepts filter-only body", () => {
    const v = validateReportBuilderDatasetRequest({
      datasetId: "orders_sales_lines",
      dateMode: "order_date",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      agentIds: [1, 2],
      statuses: ["delivered"],
      orderTypes: ["order"]
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.filters.agentIds).toEqual([1, 2]);
  });
});

describe("validateReportBuilderSavedConfigBody", () => {
  it("accepts WDR-native config", () => {
    const v = validateReportBuilderSavedConfigBody({
      dataSource: { dataSourceType: "json", data: [] },
      slice: { measures: [{ uniqueName: "amount", aggregation: "sum" }] }
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.variant).toBe("wdr");
  });
});

describe("supervisor_code field + WDR meta", () => {
  it("registers supervisor_code", () => {
    expect(isReportBuilderFieldId("supervisor_code")).toBe(true);
  });

  it("listWdrFieldsForDataset includes supervisor_code", () => {
    const fields = listWdrFieldsForDataset("orders_sales_lines");
    expect(fields.some((f) => f.uniqueName === "supervisor_code")).toBe(true);
    expect(fields.some((f) => f.uniqueName === "amount")).toBe(true);
    expect(fields.some((f) => f.uniqueName === "price")).toBe(true);
    expect(fields.some((f) => f.uniqueName === "client_address")).toBe(true);
  });
});
