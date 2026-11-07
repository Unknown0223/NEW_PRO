import { describe, expect, it } from "vitest";
import {
  hourInTimeZone,
  shouldRunTabelRetentionAt,
  TABEL_RETENTION_HOURS,
  ymdInTimeZone
} from "../src/lib/tabel-retention-cron";

describe("tabel retention cron schedule", () => {
  it("runs only at 03:00 and 04:00", () => {
    expect(TABEL_RETENTION_HOURS).toEqual([3, 4]);
    expect(shouldRunTabelRetentionAt(3)).toBe(true);
    expect(shouldRunTabelRetentionAt(4)).toBe(true);
    expect(shouldRunTabelRetentionAt(2)).toBe(false);
    expect(shouldRunTabelRetentionAt(5)).toBe(false);
    expect(shouldRunTabelRetentionAt(15)).toBe(false);
  });

  it("reads hour/ymd in Asia/Tashkent", () => {
    // 2026-11-06 22:30 UTC = 2026-11-07 03:30 Asia/Tashkent (UTC+5)
    const at = new Date("2026-11-06T22:30:00.000Z");
    expect(hourInTimeZone(at, "Asia/Tashkent")).toBe(3);
    expect(ymdInTimeZone(at, "Asia/Tashkent")).toBe("2026-11-07");
    expect(shouldRunTabelRetentionAt(hourInTimeZone(at, "Asia/Tashkent"))).toBe(true);
  });
});
