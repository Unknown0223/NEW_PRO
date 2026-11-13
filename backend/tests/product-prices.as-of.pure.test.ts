import { describe, expect, it } from "vitest";
import {
  canUseCurrentPriceAsOf,
  shouldSnapshotPreviousPrice,
  snapshotEffectiveAt
} from "../src/modules/products/product-prices.as-of.pure";
import { endOfDayUtcFromYmd } from "../src/modules/products/product-prices.as-of";

describe("product-prices as-of pure", () => {
  it("endOfDayUtcFromYmd is Tashkent day end (UTC+5)", () => {
    const d = endOfDayUtcFromYmd("2026-11-11");
    expect(d.toISOString()).toBe("2026-11-11T18:59:59.999Z");
  });

  it("canUseCurrentPriceAsOf rejects prices updated after as-of", () => {
    const asOf = endOfDayUtcFromYmd("2026-11-11");
    expect(
      canUseCurrentPriceAsOf({
        asOf,
        updatedAt: new Date("2026-11-12T05:02:28.000Z"),
        createdAt: new Date("2026-07-21T12:30:58.000Z")
      })
    ).toBe(false);
    expect(
      canUseCurrentPriceAsOf({
        asOf,
        updatedAt: new Date("2026-11-10T10:00:00.000Z"),
        createdAt: new Date("2026-07-21T12:30:58.000Z")
      })
    ).toBe(true);
  });

  it("shouldSnapshotPreviousPrice when history missing or diverged", () => {
    expect(
      shouldSnapshotPreviousPrice({
        previousPrice: "109000",
        nextPrice: "85000",
        latestSchedulePrice: null
      })
    ).toBe(true);
    expect(
      shouldSnapshotPreviousPrice({
        previousPrice: "109000",
        nextPrice: "85000",
        latestSchedulePrice: "109000"
      })
    ).toBe(false);
    expect(
      shouldSnapshotPreviousPrice({
        previousPrice: "109000",
        nextPrice: "109000",
        latestSchedulePrice: null
      })
    ).toBe(false);
  });

  it("snapshotEffectiveAt stays strictly before now", () => {
    const now = new Date("2026-11-12T05:02:28.000Z");
    const created = new Date("2026-07-21T12:30:58.000Z");
    const updated = new Date("2026-11-12T05:02:28.000Z");
    const first = snapshotEffectiveAt({
      now,
      createdAt: created,
      updatedAt: updated,
      hasPriorSchedule: false
    });
    expect(first.getTime()).toBe(created.getTime());
    const clamped = snapshotEffectiveAt({
      now,
      createdAt: created,
      updatedAt: updated,
      hasPriorSchedule: true
    });
    expect(clamped.getTime()).toBeLessThan(now.getTime());
  });
});
