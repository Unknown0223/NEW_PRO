import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectSavedReportFormat,
  savedReportConfigToPivotConfig
} from "@/lib/pivot-bridge";
import { applyCellFormatToConfig, DEFAULT_CELL_FORMAT } from "@/components/reports/virtual-pivot-format-dialogs";
import { applyDateFormatToConfig } from "@/lib/pivot-date-format";
import { withLayoutForm } from "@/lib/pivot-layout-form";
import type { PivotConfig, PivotField } from "@salec/pivot-engine";

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

  it("salec wrapper with empty slice:{} restores formats (not empty WDR)", () => {
    const fields: PivotField[] = [
      { id: "amount", label: "Сумма", dataType: "number" },
      { id: "agent", label: "Агент", dataType: "string" }
    ];
    let pivot: PivotConfig = {
      rows: ["agent"],
      columns: [],
      reportFilters: [],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      filters: [],
      options: {
        showSubtotals: true,
        showGrandTotal: true,
        showColumnTotals: false,
        compactMode: false,
        layoutForm: "classic",
        drillDown: true
      }
    };
    pivot = applyCellFormatToConfig(pivot, {
      ...DEFAULT_CELL_FORMAT,
      formatType: "currency",
      currency: "UZS",
      decimalPlaces: "0",
      valueScope: "all"
    });
    pivot = applyDateFormatToConfig(pivot, fields, {
      mode: "date",
      pattern: "dd.MM.yyyy"
    });
    pivot = {
      ...pivot,
      options: withLayoutForm(pivot.options, "classic")
    };

    // savePivotConfigReport wrapper — avvalgi bug: slice:{} → WDR → format yo‘qolardi
    const saved = {
      dataSource: { type: "salec-pivot-engine" },
      slice: {},
      salecPivotConfig: pivot,
      savdoDatasetFilters: {
        datasetId: "orders_sales_lines",
        dateMode: "order_date",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30"
      },
      datasetId: "orders_sales_lines",
      dateMode: "order_date",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30"
    };

    expect(detectSavedReportFormat(saved)).toBe("pivot");
    const restored = savedReportConfigToPivotConfig(saved);
    expect(restored).not.toBeNull();
    expect(restored!.rows).toEqual(["agent"]);
    expect(restored!.options.layoutForm).toBe("classic");
    expect(restored!.values[0]?.format?.type).toBe("currency");
    expect(restored!.values[0]?.format?.decimals).toBe(0);
    expect(restored!.options.dateDisplayMode).toBe("date");
    expect(restored!.options.datePattern).toBe("dd.MM.yyyy");
  });

  it("flat fieldFormats round-trip through salec wrapper", () => {
    let pivot: PivotConfig = {
      rows: ["agent", "amount"],
      columns: [],
      reportFilters: [],
      values: [],
      filters: [],
      options: {
        showSubtotals: false,
        showGrandTotal: false,
        showColumnTotals: false,
        compactMode: false,
        layoutForm: "flat",
        drillDown: false
      }
    };
    pivot = applyCellFormatToConfig(pivot, {
      ...DEFAULT_CELL_FORMAT,
      formatType: "number",
      decimalPlaces: "2",
      valueScope: "selected",
      selectedFieldId: "amount"
    });

    const saved = {
      dataSource: { type: "salec-pivot-engine" },
      slice: {},
      salecPivotConfig: pivot
    };
    const restored = savedReportConfigToPivotConfig(saved)!;
    expect(restored.options.layoutForm).toBe("flat");
    const formats = (restored.options as { fieldFormats?: Record<string, { decimals?: number }> })
      .fieldFormats;
    expect(formats?.amount?.decimals).toBe(2);
  });
});
