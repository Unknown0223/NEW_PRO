import { describe, expect, it } from "vitest";
import {
  resolveReturnEligibleWindowSync,
  subtractReturnPeriod
} from "../src/modules/returns/returns-filter.service";
import type { ReturnFilterSettings } from "../src/modules/returns/returns-filter.types";

function settings(partial: Partial<ReturnFilterSettings>): ReturnFilterSettings {
  return {
    period_enabled: false,
    period_unit: "day",
    period_value: 7,
    balance_zero_enabled: false,
    ...partial
  };
}

describe("resolveReturnEligibleWindowSync — MISOL 1–4", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");
  const zeroAt = new Date("2026-06-09T10:00:00.000Z");

  it("MISOL 1: faqat davr 7 kun", () => {
    const w = resolveReturnEligibleWindowSync(settings({ period_enabled: true, period_value: 7 }), null, now);
    expect(w.empty).toBe(false);
    expect(w.min_order_created_at).toEqual(subtractReturnPeriod(now, 7, "day"));
    expect(w.balance_zero_at).toBeNull();
  });

  it("MISOL 2: faqat balans 0", () => {
    const w = resolveReturnEligibleWindowSync(settings({ balance_zero_enabled: true }), zeroAt, now);
    expect(w.empty).toBe(false);
    expect(w.min_order_created_at?.getTime()).toBe(zeroAt.getTime() + 1);
  });

  it("MISOL 3: davr + balans 0, zero topildi", () => {
    const w = resolveReturnEligibleWindowSync(
      settings({ period_enabled: true, period_value: 7, balance_zero_enabled: true }),
      zeroAt,
      now
    );
    expect(w.empty).toBe(false);
    expect(w.min_order_created_at?.getTime()).toBe(zeroAt.getTime() + 1);
  });

  it("MISOL 4: davr + balans 0, zero topilmadi", () => {
    const w = resolveReturnEligibleWindowSync(
      settings({ period_enabled: true, period_value: 7, balance_zero_enabled: true }),
      null,
      now
    );
    expect(w.empty).toBe(true);
    expect(w.empty_reason).toBe("balance_zero_not_in_period");
  });

  it("ikkala filtr o‘chiq — barcha zakazlar", () => {
    const w = resolveReturnEligibleWindowSync(settings({}), null, now);
    expect(w.empty).toBe(false);
    expect(w.min_order_created_at).toBeUndefined();
  });

  it("faqat balans 0, zero topilmadi — cheklovsiz (eski qarzli mijoz)", () => {
    const w = resolveReturnEligibleWindowSync(settings({ balance_zero_enabled: true }), null, now);
    expect(w.empty).toBe(false);
    expect(w.min_order_created_at).toBeUndefined();
  });
});

describe("subtractReturnPeriod", () => {
  it("7 kun orqaga", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const from = subtractReturnPeriod(now, 7, "day");
    expect(from.toISOString().slice(0, 10)).toBe("2026-06-08");
  });
});
