import { describe, expect, it } from "vitest";
import { computeMultiSelectPopoverWidth } from "@/lib/multi-select-popover-width";

describe("computeMultiSelectPopoverWidth", () => {
  it("trigger kengligiga moslashadi — 380 majburiy emas", () => {
    expect(computeMultiSelectPopoverWidth(152, 0, 1200)).toBe(152);
    expect(computeMultiSelectPopoverWidth(152, 260, 1200)).toBe(260);
  });

  it("viewport dan chiqib ketmaydi", () => {
    expect(computeMultiSelectPopoverWidth(800, 0, 400)).toBe(384);
  });
});
