import { describe, expect, it } from "vitest";
import { isValidSlotCode, normalizeSlotCode } from "../src/modules/work-slots/work-slots.codes";

describe("work-slots.codes", () => {
  it("normalizeSlotCode trims and uppercases", () => {
    expect(normalizeSlotCode("  t-12  ")).toBe("T-12");
  });

  it("isValidSlotCode accepts alphanumeric dash codes", () => {
    expect(isValidSlotCode("T-12")).toBe(true);
    expect(isValidSlotCode("A-MAIN-001")).toBe(true);
  });

  it("isValidSlotCode rejects empty or invalid chars", () => {
    expect(isValidSlotCode("")).toBe(false);
    expect(isValidSlotCode("T 12")).toBe(false);
    expect(isValidSlotCode("т-12")).toBe(false);
  });
});
