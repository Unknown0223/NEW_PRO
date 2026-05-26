import { describe, expect, it } from "vitest";
import { polkiReturnEmptyListMessage } from "../lib/return-filter-messages";

describe("polkiReturnEmptyListMessage", () => {
  it("MISOL 4: qisqa xabar", () => {
    const msg = polkiReturnEmptyListMessage({
      filterMeta: {
        period_from: "2026-05-17T00:00:00.000Z",
        balance_zero_at: null,
        empty_reason: "balance_zero_not_in_period",
        period_enabled: true,
        balance_zero_enabled: true,
        explanation: "Uzun tushuntirish — faqat debug panelda."
      },
      deliveredOrdersCount: 12,
      returnableCount: 0,
      isByOrder: true
    });
    expect(msg).toBe("Qaytarish filtri: davr ichida balans 0 topilmadi.");
  });

  it("yetkazilgan bor, filtr tufayli bo‘sh", () => {
    const msg = polkiReturnEmptyListMessage({
      filterMeta: {
        period_from: null,
        balance_zero_at: null,
        empty_reason: null,
        period_enabled: true,
        balance_zero_enabled: false
      },
      deliveredOrdersCount: 5,
      returnableCount: 0,
      isByOrder: true
    });
    expect(msg).toContain("filtr");
  });
});
