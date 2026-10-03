import { describe, expect, it } from "vitest";
import {
  applyAgentNormToDays,
  consignmentOpenDays,
  DEFAULT_AGENT_NORM,
  describeAgentNormChanges,
  parseAgentNormConfig,
  summarizeAgentNorm,
  type AgentDaySales,
  type NormDay
} from "../src/modules/timesheet/timesheet.agent-norm.pure";

function day(date: string, extra: Partial<NormDay> = {}): NormDay {
  return { date, status: "absent", source: "auto", manual: false, ...extra };
}

const SUNDAYS = new Set(["2026-10-04", "2026-10-11"]);

function run(days: NormDay[], sales: Record<string, AgentDaySales>, opts: { open?: string[]; planDays?: number; today?: string } = {}) {
  applyAgentNormToDays(days, {
    cfg: DEFAULT_AGENT_NORM,
    today: opts.today ?? "2026-10-31",
    isWorkingDay: (ymd) => !SUNDAYS.has(ymd),
    planDays: opts.planDays ?? 26,
    sales: (ymd) => sales[ymd],
    consignmentOpen: (ymd) => (opts.open ?? []).includes(ymd)
  });
}

const s = (gross: number, refused = 0, returned = 0): AgentDaySales => ({ gross, refused, returned, orders: 1 });

describe("agent kunlik normasi", () => {
  it("konsignatsiya ochiq: 1 000 000 dan kam → kelmadi, sabab bilan", () => {
    const d = [day("2026-10-01")];
    run(d, { "2026-10-01": s(900_000) }, { open: ["2026-10-01"] });
    expect(d[0]!.status).toBe("absent");
    expect(d[0]!.norm).toBe(1_000_000);
    expect(d[0]!.comment).toContain("заказы 900 000 сум");
    expect(d[0]!.comment).toContain("не хватает 100 000 сум");
    expect(d[0]!.comment).toContain("консигнация открыта");
  });

  it("konsignatsiya yopiq: 650 000 yetarli → ishladi", () => {
    const d = [day("2026-10-02")];
    run(d, { "2026-10-02": s(700_000) });
    expect(d[0]!.status).toBe("worked");
    expect(d[0]!.norm).toBe(650_000);
    expect(d[0]!.comment).toBe("Норма выполнена: заказы 700 000 сум, норма 650 000 сум (консигнация закрыта).");
  });

  it("otkaz va vozvrat summani kamaytiradi va holatni o‘zgartiradi", () => {
    const d = [day("2026-10-02")];
    run(d, { "2026-10-02": s(900_000, 200_000, 100_000) });
    expect(d[0]!.status).toBe("absent");
    expect(d[0]!.net_sales).toBe(600_000);
    expect(d[0]!.comment).toContain("заказы 900 000 − отказ 200 000 − возврат 100 000 = 600 000 сум");
  });

  it("qo‘lda belgilangan va normadan oldingi kunlar o‘zgarmaydi", () => {
    const d = [day("2026-09-30", { status: "worked", source: "gps" }), day("2026-10-01", { status: "sick", manual: true })];
    run(d, {});
    expect(d[0]!.status).toBe("worked");
    expect(d[0]!.comment).toBeUndefined();
    expect(d[1]!.status).toBe("sick");
  });

  it("zakaz yo‘q → kelmadi; kelajak kunlar tegilmaydi", () => {
    const d = [day("2026-10-01"), day("2026-10-05")];
    run(d, {}, { today: "2026-10-03" });
    expect(d[0]!.comment).toContain("заказов нет");
    expect(d[1]!.comment).toBeUndefined();
  });

  it("dam olish kuni normani bajarsa — ish kunlari limitigacha qo‘shiladi", () => {
    const d = [day("2026-10-02", { manual: true, status: "worked" }), day("2026-10-03", { manual: true, status: "worked" }), day("2026-10-04"), day("2026-10-11")];
    run(d, { "2026-10-04": s(700_000), "2026-10-11": s(800_000) }, { planDays: 3 });
    expect(d[2]!.status).toBe("worked");
    expect(d[2]!.comment).toContain("Засчитан как рабочий день");
    expect(d[3]!.status).toBe("holiday");
    expect(d[3]!.comment).toContain("лимит уже набран");
  });

  it("dam olish kuni normaga yetmasa — Выходной", () => {
    const d = [day("2026-10-04")];
    run(d, { "2026-10-04": s(100_000) });
    expect(d[0]!.status).toBe("holiday");
  });
});

describe("consignmentOpenDays", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-25", "2026-10-26"];

  it("oy o‘rtasida yoqilib, 25-da o‘chirilgan", () => {
    const logs = [
      { ymd: "2000-01-01", enabled: false },
      { ymd: "2026-10-02", enabled: true },
      { ymd: "2026-10-25", enabled: false }
    ];
    expect([...consignmentOpenDays(logs, days, false)]).toEqual(["2026-10-02", "2026-10-03", "2026-10-25"]);
  });

  it("tarix bo‘lmasa — joriy bayroq", () => {
    expect(consignmentOpenDays([], days, true).size).toBe(days.length);
    expect(consignmentOpenDays([], days, false).size).toBe(0);
  });

  it("birinchi yozuv oy ichida bo‘lsa, undan oldin teskari holat", () => {
    expect([...consignmentOpenDays([{ ymd: "2026-10-03", enabled: false }], days, false)]).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03"
    ]);
  });
});

describe("norma sozlamalari tarixi", () => {
  it("nima nimaga o‘zgargani yoziladi", () => {
    const next = { ...DEFAULT_AGENT_NORM, open_amount: 1_200_000, enabled: false };
    expect(describeAgentNormChanges(DEFAULT_AGENT_NORM, next)).toEqual([
      "Расчёт по нормативу: включён → выключен",
      "Норма при открытой консигнации: 1 000 000 → 1 200 000 сум"
    ]);
    expect(describeAgentNormChanges(DEFAULT_AGENT_NORM, DEFAULT_AGENT_NORM)).toEqual([]);
    expect(summarizeAgentNorm(DEFAULT_AGENT_NORM)).toBe("Включено с 01.10.2026 · открыта 1 000 000 · закрыта 650 000 сум");
    expect(summarizeAgentNorm(next)).toBe("Выключено");
  });
});

describe("parseAgentNormConfig", () => {
  it("standart qiymatlar va tenant sozlamasi", () => {
    expect(parseAgentNormConfig(null)).toEqual(DEFAULT_AGENT_NORM);
    expect(parseAgentNormConfig({ timesheet: { agent_norm: { open_amount: 1_200_000, enabled: false } } })).toMatchObject({
      enabled: false,
      open_amount: 1_200_000,
      closed_amount: 650_000
    });
  });
});
