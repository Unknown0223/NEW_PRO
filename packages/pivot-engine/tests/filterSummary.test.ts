import { describe, expect, it } from "vitest";
import { summarizePivotFilter } from "../src/utils/filterSummary.js";

describe("summarizePivotFilter", () => {
  it("include — tanlangan soni", () => {
    expect(
      summarizePivotFilter({ fieldId: "a", type: "include", values: ["x", "y"] })
    ).toMatch(/2/);
  });

  it("top_n", () => {
    expect(
      summarizePivotFilter({
        fieldId: "a",
        type: "top_n",
        topN: 5,
        measureFieldId: "amount"
      })
    ).toBe("Top 5");
  });

  it("bottom_n", () => {
    expect(
      summarizePivotFilter({
        fieldId: "a",
        type: "bottom_n",
        topN: 3,
        measureFieldId: "qty"
      })
    ).toBe("Bottom 3");
  });
});
