import { describe, expect, it } from "vitest";
import {
  clampFiniteMaxSessions,
  formatMaxSessionsLabel,
  isUnlimitedMaxSessions,
  isValidMaxSessionsValue
} from "@/lib/max-sessions";

describe("max-sessions labels", () => {
  it("formats unlimited as Russian label", () => {
    expect(formatMaxSessionsLabel(0)).toBe("Неограниченно");
    expect(formatMaxSessionsLabel(2)).toBe("2");
    expect(formatMaxSessionsLabel(null)).toBe("1");
  });

  it("accepts 0 as valid unlimited", () => {
    expect(isUnlimitedMaxSessions(0)).toBe(true);
    expect(isValidMaxSessionsValue(0)).toBe(true);
    expect(isValidMaxSessionsValue(100)).toBe(false);
    expect(clampFiniteMaxSessions(0)).toBe(1);
  });
});
