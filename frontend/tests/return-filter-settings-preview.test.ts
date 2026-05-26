import { describe, expect, it } from "vitest";
import { previewReturnFilterSettings } from "@/lib/return-filter-settings-preview";

describe("previewReturnFilterSettings", () => {
  it("HOLAT 3 — davr + balans 0", () => {
    const p = previewReturnFilterSettings({
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: true
    });
    expect(p.title).toContain("HOLAT 3");
    expect(p.warning).toBeTruthy();
  });

  it("HOLAT 1 — faqat davr", () => {
    const p = previewReturnFilterSettings({
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: false
    });
    expect(p.body).toContain("Balans 0");
    expect(p.body).toContain("olinmaydi");
  });
});
