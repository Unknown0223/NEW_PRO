import { describe, expect, it } from "vitest";
import { hydratePivotValueLabels, resolvePivotValueLabel } from "../src/utils/valueLabels.js";
import type { PivotField } from "../src/types/pivot.types.js";

const fields: PivotField[] = [
  { id: "amount", label: "Сумма", dataType: "currency" },
  { id: "client_id", label: "АКБ", dataType: "number" },
  { id: "agent_name", label: "Агент", dataType: "string" }
];

describe("resolvePivotValueLabel", () => {
  it("uses explicit value label when set", () => {
    expect(resolvePivotValueLabel({ fieldId: "amount", label: "Итого сумма" }, fields)).toBe(
      "Итого сумма"
    );
  });

  it("falls back to field catalog label (Поля), not raw id", () => {
    expect(resolvePivotValueLabel({ fieldId: "amount" }, fields)).toBe("Сумма");
    expect(resolvePivotValueLabel({ fieldId: "client_id" }, fields)).toBe("АКБ");
  });

  it("falls back to fieldId only when catalog has no caption", () => {
    expect(resolvePivotValueLabel({ fieldId: "unknown_metric" }, fields)).toBe("unknown_metric");
  });
});

describe("hydratePivotValueLabels", () => {
  it("fills missing labels from catalog without overwriting explicit ones", () => {
    const hydrated = hydratePivotValueLabels(
      [
        { fieldId: "amount", aggregation: "SUM" },
        { fieldId: "client_id", aggregation: "COUNT_DISTINCT", label: "Custom AKB" }
      ],
      fields
    );
    expect(hydrated[0]?.label).toBe("Сумма");
    expect(hydrated[1]?.label).toBe("Custom AKB");
  });
});
