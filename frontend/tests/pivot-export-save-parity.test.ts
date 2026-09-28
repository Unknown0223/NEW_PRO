import { describe, expect, it } from "vitest";
import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { canSavePivotConfig, hasFlatSlice } from "@/lib/pivot-layout-form";
import { flattenConfigZones } from "@/lib/pivot-flat-layout";
import {
  getFieldFormatOverride,
  isLeavingFlatLayout,
  restoreFromPreFlatSnapshot
} from "@/lib/pivot-config-extras";
import {
  applyCellFormatToConfig,
  DEFAULT_CELL_FORMAT
} from "@/components/reports/virtual-pivot-format-dialogs";
import { getFlatColumnFieldIds } from "@/lib/build-flat-pivot-data";

const classicConfig: PivotConfig = {
  rows: ["agent_branch", "brand_name"],
  columns: [],
  values: [
    { fieldId: "volume", aggregation: "SUM" },
    { fieldId: "amount", aggregation: "SUM" }
  ],
  reportFilters: [],
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

describe("pivot save + flat layout parity", () => {
  it("canSavePivotConfig — flat da values yo‘q bo‘lsa ham saqlash mumkin", () => {
    expect(canSavePivotConfig(classicConfig)).toBe(true);
    const flat = flattenConfigZones(classicConfig);
    expect(flat.values).toEqual([]);
    expect(hasFlatSlice(flat)).toBe(true);
    expect(canSavePivotConfig(flat)).toBe(true);
    expect(
      canSavePivotConfig({
        ...flat,
        rows: [],
        columns: [],
        values: [],
        reportFilters: []
      })
    ).toBe(false);
  });

  it("flatten saqlaydi preFlatSnapshot — classic ga qaytganda values tiklanadi", () => {
    const flat = flattenConfigZones(classicConfig);
    expect(isLeavingFlatLayout(flat, "classic")).toBe(true);
    const restored = restoreFromPreFlatSnapshot(flat, "classic");
    expect(restored.values.map((v) => v.fieldId)).toEqual(["volume", "amount"]);
    expect(restored.rows).toEqual(["agent_branch", "brand_name"]);
    expect(restored.options.layoutForm).toBe("classic");
  });

  it("flat shablon (snapshot boshqa ustunlar) → classic: o‘lchamlar Ряды, raqamlar Значения", () => {
    const fields: PivotField[] = [
      { id: "client_name", label: "Клиент", dataType: "string" },
      { id: "agent_name", label: "Агент", dataType: "string" },
      { id: "order_id", label: "Заказ ID", dataType: "number" },
      { id: "order_date_month", label: "Дата заказа.Месяц", dataType: "number" },
      { id: "amount", label: "Сумма", dataType: "currency" },
      { id: "volume", label: "Объём", dataType: "number" }
    ];
    const flat = flattenConfigZones({
      ...classicConfig,
      rows: ["client_name", "agent_name", "order_id", "order_date_month", "amount"],
      values: []
    });
    const next = restoreFromPreFlatSnapshot(flat, "classic", fields);
    expect(next.rows).toEqual(["client_name", "agent_name", "order_id", "order_date_month"]);
    expect(next.values).toEqual([{ fieldId: "amount", aggregation: "SUM" }]);
    expect(next.options.layoutForm).toBe("classic");
  });

  it("flat da raqamli ustun yo‘q → compact: fallback qiymat qo‘shiladi", () => {
    const fields: PivotField[] = [
      { id: "client_name", label: "Клиент", dataType: "string" },
      { id: "amount", label: "Сумма", dataType: "currency" }
    ];
    const flat: PivotConfig = {
      ...classicConfig,
      rows: ["client_name"],
      values: [],
      options: { ...classicConfig.options, layoutForm: "flat" }
    };
    const next = restoreFromPreFlatSnapshot(flat, "compact", fields);
    expect(next.rows).toEqual(["client_name"]);
    expect(next.values).toEqual([{ fieldId: "amount", aggregation: "SUM" }]);
    expect(next.options.compactMode).toBe(true);
  });

  it("flat ustun tartibi ekran/export uchun bir xil (rows tartibi)", () => {
    const flat = flattenConfigZones(classicConfig);
    expect(getFlatColumnFieldIds(flat)).toEqual([
      "agent_branch",
      "brand_name",
      "volume",
      "amount"
    ]);
  });

  it("applyCellFormatToConfig flat da fieldFormats ga yozadi", () => {
    const flat = flattenConfigZones(classicConfig);
    const next = applyCellFormatToConfig(flat, {
      ...DEFAULT_CELL_FORMAT,
      valueScope: "selected",
      selectedFieldId: "volume",
      formatType: "currency",
      currency: "UZS",
      decimalPlaces: "0"
    });
    expect(getFieldFormatOverride(next, "volume")?.type).toBe("currency");
    expect(getFieldFormatOverride(next, "volume")?.decimals).toBe(0);
    expect(getFieldFormatOverride(next, "amount")).toBeUndefined();
  });
});
