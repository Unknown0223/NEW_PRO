/** Pure logic tests — intent + slots (no DB). */
import { describe, it, expect } from "vitest";
import { detectIntent, isWriteIntent, extractSlots } from "../src/modules/ai/ai.intent";

describe("detectIntent — read", () => {
  const cases: Array<[string, string]> = [
    ["bugun savdo qancha bo‘ldi", "sales.summary"],
    ["oxirgi 7 kun to‘lovlar", "payments.list"],
    ["ombordagi qoldiq", "stock.balances"],
    ["mijozlar ro‘yxati", "clients.list"],
    ["ish haqi shu oy", "payroll.list"],
    ["qarzdorlar kimlar?", "finance.receivables"]
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    const m = detectIntent(q);
    expect(m.intent).toBe(intent);
    expect(m.score).toBeGreaterThan(0);
  });
});

describe("detectIntent — write", () => {
  const cases: Array<[string, string]> = [
    ["SKU-001 narxini 150000 qil", "write.set_price"],
    ["yangi agent qo‘sh: Aziz", "write.create_employee"],
    ["mijoz qo‘sh: MMC", "write.create_client"],
    ["vazifa ber: ombor tekshiruv", "write.create_task"],
    ["kompaniya sozlamasini o‘zgartir", "write.update_settings"]
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    const m = detectIntent(q);
    expect(m.intent).toBe(intent);
    expect(isWriteIntent(m.intent)).toBe(true);
  });
});

describe("isWriteIntent", () => {
  it("read → false", () => {
    expect(isWriteIntent("sales.summary")).toBe(false);
    expect(isWriteIntent("help.capabilities")).toBe(false);
  });
});

describe("extractSlots", () => {
  it("period aniqlanadi", () => {
    const s = extractSlots("oxirgi 7 kun to‘lovlar", "2026-11-12");
    expect(s.from).toBeDefined();
    expect(s.to).toBe("2026-11-12");
  });
  it("limit aniqlanadi", () => {
    const s = extractSlots("top 5 mahsulot", "2026-11-12");
    expect(s.limit).toBe(5);
  });
  it("search so‘zi ajratiladi", () => {
    const s = extractSlots("mijoz Ivanov telefon", "2026-11-12");
    expect(s.search).toContain("Ivanov");
  });
  it("priceType 'gros' → gros", () => {
    const s = extractSlots("narx turi gros", "2026-11-12");
    expect(s.priceType).toBe("gros");
  });
});
