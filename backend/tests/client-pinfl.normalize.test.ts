import { describe, expect, it } from "vitest";
import { normalizeClientPinfl } from "../src/modules/clients/clients.write.helpers";

describe("normalizeClientPinfl", () => {
  it("treats placeholder 0 as null", () => {
    expect(normalizeClientPinfl("0")).toBeNull();
    expect(normalizeClientPinfl("000")).toBeNull();
  });

  it("accepts 14 digits", () => {
    expect(normalizeClientPinfl("12345678901234")).toBe("12345678901234");
  });

  it("rejects partial pinfl", () => {
    expect(() => normalizeClientPinfl("12345")).toThrow("VALIDATION");
  });
});
