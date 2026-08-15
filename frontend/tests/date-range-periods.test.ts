import { describe, expect, it } from "vitest";
import {
  envelopeFromPeriods,
  monthsCoveredByRange,
  parseDatePeriods,
  selectedMonthsToPeriods,
  serializeDatePeriods,
  ymIndex
} from "@/components/ui/date-range-periods";

describe("date-range-periods (month multi-select)", () => {
  it("merges contiguous months into one period", () => {
    const jan = ymIndex(2026, 0);
    const feb = ymIndex(2026, 1);
    const periods = selectedMonthsToPeriods([jan, feb]);
    expect(periods).toEqual([{ from: "2026-01-01", to: "2026-02-28" }]);
  });

  it("keeps gaps as separate periods (Jan + Mar)", () => {
    const jan = ymIndex(2026, 0);
    const mar = ymIndex(2026, 2);
    const periods = selectedMonthsToPeriods([mar, jan]);
    expect(periods).toEqual([
      { from: "2026-01-01", to: "2026-01-31" },
      { from: "2026-03-01", to: "2026-03-31" }
    ]);
    const env = envelopeFromPeriods(periods);
    expect(env).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });

  it("round-trips serialize/parse", () => {
    const raw = serializeDatePeriods([
      { from: "2026-01-01", to: "2026-01-31" },
      { from: "2026-03-01", to: "2026-03-31" }
    ]);
    expect(raw).toBe("2026-01-01_2026-01-31,2026-03-01_2026-03-31");
    expect(parseDatePeriods(raw)).toEqual([
      { from: "2026-01-01", to: "2026-01-31" },
      { from: "2026-03-01", to: "2026-03-31" }
    ]);
  });

  it("monthsCoveredByRange includes all months in span", () => {
    expect(monthsCoveredByRange("2026-01-15", "2026-03-02")).toEqual([
      ymIndex(2026, 0),
      ymIndex(2026, 1),
      ymIndex(2026, 2)
    ]);
  });
});
