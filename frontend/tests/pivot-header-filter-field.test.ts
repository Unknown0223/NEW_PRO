import { describe, expect, it } from "vitest";
import { DEFAULT_PIVOT_CONFIG, type PivotConfig, type PivotHeader } from "@salec/pivot-engine";
import { resolveHeaderFilterFieldId } from "../components/pivot/PivotTable/headerFields";

const baseConfig: PivotConfig = {
  ...DEFAULT_PIVOT_CONFIG,
  rows: ["region", "product"],
  columns: ["month"],
  values: [
    { fieldId: "amount", aggregation: "SUM", label: "Summa" },
    { fieldId: "qty", aggregation: "SUM", label: "Miqdor" }
  ]
};

function hdr(partial: Partial<PivotHeader> & Pick<PivotHeader, "key" | "label">): PivotHeader {
  return {
    colspan: 1,
    rowspan: 1,
    depth: 0,
    isValue: false,
    ...partial
  };
}

describe("resolveHeaderFilterFieldId", () => {
  it("flat headers use key as field id (including numeric measures)", () => {
    expect(
      resolveHeaderFilterFieldId(hdr({ key: "amount", label: "Summa", isValue: true }), baseConfig, 0, true)
    ).toBe("amount");
    expect(
      resolveHeaderFilterFieldId(hdr({ key: "region", label: "Hudud" }), baseConfig, 0, true)
    ).toBe("region");
  });

  it("column dimension level maps to config.columns[level]", () => {
    expect(
      resolveHeaderFilterFieldId(hdr({ key: "col_0_0", label: "Yan" }), baseConfig, 0, false)
    ).toBe("month");
  });

  it("measure headers resolve by label and by __fieldId key suffix", () => {
    expect(
      resolveHeaderFilterFieldId(
        hdr({ key: "Yan__amount", label: "Summa", isValue: true, depth: 1 }),
        baseConfig,
        1,
        false
      )
    ).toBe("amount");
    expect(
      resolveHeaderFilterFieldId(
        hdr({ key: "Yan__qty", label: "Miqdor", isValue: true, depth: 1 }),
        baseConfig,
        1,
        false
      )
    ).toBe("qty");
  });
});
