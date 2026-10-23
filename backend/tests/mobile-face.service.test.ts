import { describe, expect, it } from "vitest";
import {
  facePolicyFromMobileConfig,
  pickDailyOrderCheckpoints,
  workRegionDateString
} from "../src/modules/mobile/mobile-face.service";

describe("mobile-face.service", () => {
  it("facePolicyFromMobileConfig reads misc flags", () => {
    const p = facePolicyFromMobileConfig({
      schema_version: 1,
      misc: {
        face_verification_enabled: true,
        face_verification_max_random_orders_per_day: 8
      }
    });
    expect(p.enabled).toBe(true);
    expect(p.maxRandomOrdersPerDay).toBe(5);
  });

  it("pickDailyOrderCheckpoints is stable per user/day and max 5", () => {
    const d = workRegionDateString(new Date("2026-08-22T12:00:00Z"));
    const a = pickDailyOrderCheckpoints(42, d, 5);
    const b = pickDailyOrderCheckpoints(42, d, 5);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(a.every((n) => n >= 1 && n <= 30)).toBe(true);
  });
});
