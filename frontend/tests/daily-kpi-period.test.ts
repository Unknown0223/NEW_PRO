import { describe, expect, it } from "vitest";
import {
  clampRangeToMonth,
  formatPeriodLabel,
  monthLastYmd,
  periodDays,
  periodForAnchor,
  presetRange,
  weekRangeInMonth
} from "../components/plans/daily-kpi/daily-kpi-period";

describe("daily KPI period (strictly one month)", () => {
  it("month preset covers only the anchor month", () => {
    expect(presetRange("month", "2026-09-17")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthLastYmd("2026-08-05")).toBe("2026-08-31");
  });

  it("week preset is Mon–Sun but never leaves the month", () => {
    // 2026-09-02 (ср): неделя 31.08–06.09 → обрезано до 01.09
    expect(weekRangeInMonth("2026-09-02")).toEqual({ from: "2026-09-01", to: "2026-09-06" });
    // 2026-09-30 (ср): неделя 28.09–04.10 → обрезано до 30.09
    expect(weekRangeInMonth("2026-09-30")).toEqual({ from: "2026-09-28", to: "2026-09-30" });
    expect(weekRangeInMonth("2026-09-16")).toEqual({ from: "2026-09-14", to: "2026-09-20" });
  });

  it("custom range is clamped into the anchor month, never a day from August", () => {
    expect(clampRangeToMonth("2026-08-25", "2026-09-10", "2026-09-15")).toEqual({
      from: "2026-09-01",
      to: "2026-09-10"
    });
    expect(clampRangeToMonth("2026-09-20", "2026-10-03", "2026-09-15")).toEqual({
      from: "2026-09-20",
      to: "2026-09-30"
    });
    expect(clampRangeToMonth("2026-09-20", "2026-09-05", "2026-09-15")).toEqual({
      from: "2026-09-20",
      to: "2026-09-20"
    });
  });

  it("anchor change keeps preset, resets custom only when month changes", () => {
    expect(periodForAnchor({ preset: "month", from: "2026-08-01", to: "2026-08-31" }, "2026-09-05")).toEqual({
      preset: "month",
      from: "2026-09-01",
      to: "2026-09-30"
    });
    const custom = { preset: "custom" as const, from: "2026-09-03", to: "2026-09-09" };
    expect(periodForAnchor(custom, "2026-09-20")).toBe(custom);
    expect(periodForAnchor(custom, "2026-10-02")).toEqual({ preset: "custom", from: "2026-10-02", to: "2026-10-02" });
  });

  it("labels and day counts", () => {
    expect(periodDays("2026-09-01", "2026-09-30")).toBe(30);
    expect(formatPeriodLabel("2026-09-01", "2026-09-07")).toBe("01.09–07.09.2026 · 7 дн.");
    expect(formatPeriodLabel("2026-09-27", "2026-09-27")).toBe("27.09.2026 · вс");
  });
});
