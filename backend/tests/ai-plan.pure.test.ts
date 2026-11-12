/** Pure logic tests — AI plan (no DB, no network). */
import { describe, it, expect } from "vitest";
import { planFromQuestion, planPeriod } from "../src/modules/ai/ai.plan";

describe("planFromQuestion — read intents", () => {
  it("umumiy holat → dashboard.stats + sales.summary + receivables + cash_desks", () => {
    const built = planFromQuestion("umumiy holat: savdo, qarz, kassa");
    expect(built.write).toBe(false);
    expect(built.intent).toBe("overview");
    const tools = built.plan.calls.map((c) => c.tool);
    expect(tools).toContain("dashboard.stats");
    expect(tools).toContain("sales.summary");
    expect(tools).toContain("finance.receivables");
    expect(tools).toContain("finance.cash_desks");
    expect(built.plan.calls.length).toBeLessThanOrEqual(4);
  });

  it("bugungi savdo → sales.summary bugungi kun", () => {
    const built = planFromQuestion("bugun savdo qancha bo‘ldi");
    expect(built.intent).toBe("sales.summary");
    const call = built.plan.calls.find((c) => c.tool === "sales.summary");
    expect(call).toBeDefined();
    expect(call!.params.from).toBeDefined();
    expect(call!.params.to).toBeDefined();
  });

  it("oxirgi 7 kun to‘lovlar → payments.list", () => {
    const built = planFromQuestion("oxirgi 7 kun to‘lovlar");
    expect(built.intent).toBe("payments.list");
    expect(built.plan.calls.some((c) => c.tool === "payments.list")).toBe(true);
  });

  it("ombordagi qoldiq → stock.balances", () => {
    const built = planFromQuestion("ombordagi qoldiq");
    expect(built.intent).toBe("stock.balances");
  });

  it("ish haqi shu oy → payroll.list joriy oy bilan", () => {
    const built = planFromQuestion("ish haqi shu oy");
    expect(built.intent).toBe("payroll.list");
    const call = built.plan.calls.find((c) => c.tool === "payroll.list");
    expect(call).toBeDefined();
    expect(typeof call!.params.year).toBe("number");
    expect(typeof call!.params.month).toBe("number");
  });

  it("plansiz savol → missing bo‘ladi", () => {
    const built = planFromQuestion("nimagap");
    expect(built.write).toBe(false);
    expect(built.plan.missing.length).toBeGreaterThan(0);
  });
});

describe("planFromQuestion — write intents", () => {
  it("narx o‘zgartirish → write.set_price, parametrlari aniqlanadi", () => {
    const built = planFromQuestion("SKU-001 narxini 150000 so‘m qil");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.set_price");
    expect(built.plan.calls[0]?.tool).toBe("write.set_price");
    expect(built.plan.calls[0]?.params.price_type).toBe("retail");
  });

  it("xodim qo‘shish → write.create_employee, maydonlar bor", () => {
    const built = planFromQuestion("yangi agent qo‘sh: Aziz Karimov, login aziz, parol 12345678");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.create_employee");
    const params = built.plan.calls[0]?.params;
    expect(params.first_name).toBe("Aziz");
    expect(params.login).toBe("aziz");
    expect(params.password).toBe("12345678");
  });

  it("mijoz yaratish → write.create_client", () => {
    const built = planFromQuestion("mijoz qo‘sh: O‘zbekiston MMC, telefon +998901234567, viloyat Tashkent");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.create_client");
  });

  it("vazifa berish → write.create_task", () => {
    const built = planFromQuestion("vazifa: skladga ombor kelganini tekshir, Kimga: expeditor");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.create_task");
  });

  it("sozlama o‘zgartirish → write.update_settings", () => {
    const built = planFromQuestion("kompaniya nomini 'Yangi MMC' qil");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.update_settings");
  });
});

describe("planPeriod", () => {
  it("payroll call → yil/oy'dan period", () => {
    const period = planPeriod({ calls: [{ tool: "payroll.list", params: { year: 2026, month: 11 } }] } as any);
    expect(period.from).toBe("2026-11-01");
  });
});

function planFromButtonNotExistsQ(q: string) {
  return planFromQuestion(q);
}
