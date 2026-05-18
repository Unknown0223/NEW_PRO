/**
 * Foundation Sprint 1 — report-builder POST kontraktlar.
 */
import { describe, expect, it } from "vitest";
import {
  reportBuilderConfigBodySchema,
  reportBuilderDatasetBodySchema,
  reportBuilderSavedCreateBodySchema
} from "../src/contracts/report-builder.schemas";

describe("report-builder schemas (unit)", () => {
  it("reportBuilderDatasetBodySchema — bo‘sh body INVALID_BODY", () => {
    const r = reportBuilderDatasetBodySchema.safeParse(null);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("INVALID_BODY");
    }
  });

  it("reportBuilderDatasetBodySchema — minimal yaroqli dataset", () => {
    const r = reportBuilderDatasetBodySchema.safeParse({
      datasetId: "orders_sales_lines",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31"
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.datasetId).toBe("orders_sales_lines");
      expect(r.data.dateFrom).toBe("2026-01-01");
    }
  });

  it("reportBuilderConfigBodySchema — metrikalar yo‘q — NO_METRICS", () => {
    const r = reportBuilderConfigBodySchema.safeParse({
      datasetId: "orders_sales_lines",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      metrics: { amount: false, qty: false, volume: false, akb: false }
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("NO_METRICS");
    }
  });

  it("reportBuilderSavedCreateBodySchema — name majburiy", () => {
    expect(reportBuilderSavedCreateBodySchema.safeParse({ config: {} }).success).toBe(false);
  });
});
