import { describe, expect, it } from "vitest";
import {
  detectReturnFilterMode,
  RETURN_FILTER_MODE_PRESETS
} from "@/lib/return-filter-settings";

describe("return-filter-settings", () => {
  it("detectReturnFilterMode", () => {
    expect(
      detectReturnFilterMode({
        period_enabled: true,
        period_unit: "day",
        period_value: 2,
        balance_zero_enabled: false
      })
    ).toBe("period_only");

    expect(
      detectReturnFilterMode({
        period_enabled: true,
        period_unit: "day",
        period_value: 7,
        balance_zero_enabled: true
      })
    ).toBe("both");
  });

  it("4 ta preset", () => {
    expect(RETURN_FILTER_MODE_PRESETS).toHaveLength(4);
  });
});
