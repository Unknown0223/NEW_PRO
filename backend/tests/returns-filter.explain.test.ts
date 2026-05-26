import { describe, expect, it } from "vitest";
import {
  buildReturnFilterExplanation,
  buildReturnFilterLog,
  returnFilterModeFromSettings,
  type ReturnFilterStats
} from "../src/modules/returns/returns-filter.explain";
import { resolveReturnEligibleWindowSync } from "../src/modules/returns/returns-filter.service";
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

describe("returnFilterModeFromSettings", () => {
  it("period + balance zero", () => {
    const w = resolveReturnEligibleWindowSync(
      settings({ period_enabled: true, balance_zero_enabled: true }),
      null
    );
    expect(returnFilterModeFromSettings(w)).toBe("period_and_balance_zero");
  });
});

function stats(partial: Partial<ReturnFilterStats> & Pick<ReturnFilterStats, "delivered_after_filter">): ReturnFilterStats {
  return {
    client_balance: "0",
    ledger_balance: "0",
    unpaid_delivered_total: "0",
    ledger_net_balance: "0",
    delivered_in_period: null,
    ...partial
  };
}

describe("buildReturnFilterExplanation — qarzdorlik + davr", () => {
  const now = new Date("2026-05-24T12:00:00.000Z");

  it("faqat davr: qarz bo‘lsa ham zakazlar chiqadi", () => {
    const w = resolveReturnEligibleWindowSync(settings({ period_enabled: true, period_value: 7 }), null, now);
    const text = buildReturnFilterExplanation(w, stats({
      client_balance: "-11803898",
      delivered_in_period: 12,
      delivered_after_filter: 12
    }));
    expect(text).toContain("7 kun");
    expect(text).toContain("12 ta");
    expect(text).toContain("Balans 0 hisobga olinmaydi");
  });

  it("davr + balans 0: davrda zakaz bor, 0 yo‘q — bo‘sh", () => {
    const w = resolveReturnEligibleWindowSync(
      settings({ period_enabled: true, period_value: 7, balance_zero_enabled: true }),
      null,
      now
    );
    expect(w.empty).toBe(true);
    const text = buildReturnFilterExplanation(w, stats({
      client_balance: "-11803898",
      ledger_net_balance: "-1530000",
      delivered_in_period: 12,
      delivered_after_filter: 0
    }));
    expect(text).toContain("balans 0");
    expect(text).toContain("12 ta yetkazilgan zakaz");
  });

  it("log qadamlari", () => {
    const w = resolveReturnEligibleWindowSync(
      settings({ period_enabled: true, period_value: 7, balance_zero_enabled: true }),
      null,
      now
    );
    const log = buildReturnFilterLog(w, stats({
      client_balance: "-5000",
      ledger_net_balance: "-1500000",
      delivered_in_period: 3,
      delivered_after_filter: 0
    }));
    expect(log.some((l) => l.includes("Balans 0: tanlangan davr ichida topilmadi"))).toBe(true);
    expect(log.some((l) => l.includes("Davr ichida yetkazilgan zakazlar: 3"))).toBe(true);
  });
});
