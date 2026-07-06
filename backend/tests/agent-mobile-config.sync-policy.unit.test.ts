import { describe, expect, it } from "vitest";
import {
  evaluateMobileSyncPolicy,
  minutesOfDayInTimeZone
} from "../src/modules/staff/agent-mobile-config.sync-policy";

describe("evaluateMobileSyncPolicy", () => {
  it("blocks when block_sync is true", () => {
    const r = evaluateMobileSyncPolicy({ block_sync: true }, new Date(Date.UTC(2026, 5, 1, 12, 0)), "UTC");
    expect(r.allowed).toBe(false);
    expect(r.message).toContain("bloklangan");
  });

  it("denies after allowed_window_to (in given time zone)", () => {
    const r = evaluateMobileSyncPolicy(
      { allowed_window_to: "16:00" },
      new Date(Date.UTC(2026, 5, 1, 16, 1)),
      "UTC"
    );
    expect(r.allowed).toBe(false);
  });

  it("allows inside window (in given time zone)", () => {
    const r = evaluateMobileSyncPolicy(
      { allowed_window_from: "08:00", allowed_window_to: "16:00" },
      new Date(Date.UTC(2026, 5, 1, 10, 0)),
      "UTC"
    );
    expect(r.allowed).toBe(true);
  });

  it("uses tenant time zone (Asia/Tashkent = UTC+5), not server process tz", () => {
    // 06:00 UTC = 11:00 Asia/Tashkent — oyna 08:00–17:30 ichida.
    const inside = evaluateMobileSyncPolicy(
      { allowed_window_from: "08:00", allowed_window_to: "17:30" },
      new Date(Date.UTC(2026, 5, 1, 6, 0))
    );
    expect(inside.allowed).toBe(true);

    // 03:00 UTC = 08:00 Asia/Tashkent chegarasida — ruxsat (>= 08:00).
    expect(minutesOfDayInTimeZone(new Date(Date.UTC(2026, 5, 1, 3, 0)), "Asia/Tashkent")).toBe(8 * 60);
    // 13:00 UTC = 18:00 Asia/Tashkent — oynadan tashqari (> 17:30).
    const outside = evaluateMobileSyncPolicy(
      { allowed_window_from: "08:00", allowed_window_to: "17:30" },
      new Date(Date.UTC(2026, 5, 1, 13, 0))
    );
    expect(outside.allowed).toBe(false);
  });
});
