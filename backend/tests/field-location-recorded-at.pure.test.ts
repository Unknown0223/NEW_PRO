import { describe, expect, it } from "vitest";
import { clampClientRecordedAt } from "../src/modules/field/field.service";

describe("clampClientRecordedAt", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  it("returns null for invalid", () => {
    expect(clampClientRecordedAt(null, now)).toBeNull();
    expect(clampClientRecordedAt(new Date("invalid"), now)).toBeNull();
  });

  it("clamps far future to now", () => {
    const far = new Date("2026-09-05T14:00:00.000Z");
    expect(clampClientRecordedAt(far, now)?.toISOString()).toBe(now.toISOString());
  });

  it("clamps far past to 7 days", () => {
    const far = new Date("2026-01-01T00:00:00.000Z");
    const clamped = clampClientRecordedAt(far, now)!;
    expect(clamped.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  });

  it("keeps recent past", () => {
    const ok = new Date("2026-09-05T11:00:00.000Z");
    expect(clampClientRecordedAt(ok, now)?.toISOString()).toBe(ok.toISOString());
  });
});
