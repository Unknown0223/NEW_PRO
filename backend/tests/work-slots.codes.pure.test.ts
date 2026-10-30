import { describe, expect, it } from "vitest";
import {
  assertSlotCodeMatchesType,
  expectedSmartPrefixForSlotType,
  isValidSlotCode,
  normalizeSlotCode,
  parseSmartSlotCodePrefix
} from "../src/modules/work-slots/work-slots.codes";
import { SLOT_TYPE_CODE_PREFIX, WORK_SLOT_TYPES } from "../src/modules/work-slots/work-slots.constants";

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

  it("parseSmartSlotCodePrefix reads first letter of ROLE-BRANCH-NNN", () => {
    expect(parseSmartSlotCodePrefix("V-ANDIJON-001")).toBe("V");
    expect(parseSmartSlotCodePrefix("a-main-12")).toBe("A");
    expect(parseSmartSlotCodePrefix("PMXRZ002")).toBeNull();
    expect(parseSmartSlotCodePrefix("T-12")).toBeNull();
  });

  it("every slot type has a unique smart prefix", () => {
    const prefixes = WORK_SLOT_TYPES.map((t) => SLOT_TYPE_CODE_PREFIX[t]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const t of WORK_SLOT_TYPES) {
      expect(expectedSmartPrefixForSlotType(t)).toBe(SLOT_TYPE_CODE_PREFIX[t]);
    }
  });

  it("assertSlotCodeMatchesType allows matching smart codes and custom codes", () => {
    expect(() => assertSlotCodeMatchesType("A-MAIN-001", "agent")).not.toThrow();
    expect(() => assertSlotCodeMatchesType("V-ANDIJON-001", "sales_director")).not.toThrow();
    expect(() => assertSlotCodeMatchesType("N-SERGELI-010", "supervisor")).not.toThrow();
    expect(() => assertSlotCodeMatchesType("PMXRZ002", "agent")).not.toThrow();
  });

  it("assertSlotCodeMatchesType rejects wrong smart prefix for role", () => {
    expect(() => assertSlotCodeMatchesType("V-ANDIJON-001", "supervisor")).toThrow(
      "BAD_SLOT_CODE_PREFIX"
    );
    expect(() => assertSlotCodeMatchesType("N-MAIN-001", "sales_director")).toThrow(
      "BAD_SLOT_CODE_PREFIX"
    );
    expect(() => assertSlotCodeMatchesType("A-MAIN-001", "expeditor")).toThrow(
      "BAD_SLOT_CODE_PREFIX"
    );
  });
});
