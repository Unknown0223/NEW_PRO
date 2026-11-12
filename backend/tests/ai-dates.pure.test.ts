/** Pure logic tests — Tashkent date helpers (no DB). */
import { describe, it, expect } from "vitest";
import {
  tashkentToday,
  addDays,
  parsePeriod,
  formatPeriodLabel,
  isValidYmd,
  monthStart,
  weekStart
} from "../src/modules/ai/ai.dates";

describe("tashkentToday", () => {
  it("YYYY-MM-DD formatida qaytaradi", () => {
    const d = tashkentToday();
    expect(isValidYmd(d)).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true);
  });
});

describe("addDays", () => {
  it("kun qo‘shadi / ayiradi", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("parsePeriod", () => {
  it("uz-lotin: 'bu oy'", () => {
    const p = parsePeriod("bu oy", "2026-11-15");
    expect(p.from).toBe("2026-11-01");
    expect(p.to).toBe("2026-11-30");
  });

  it("uz-lotin: 'shu hafta'", () => {
    const p = parsePeriod("shu hafta", "2026-11-12");
    expect(p.from).toBe(weekStart("2026-11-12"));
    expect(p.to).toBe("2026-11-12");
  });

  it("ru: 'yesterday'", () => {
    const p = parsePeriod("вчера", "2026-11-12");
    expect(p.from).toBe("2026-11-11");
    expect(p.to).toBe("2026-11-11");
  });

  it("explicit range: '2026-10-01 dan 2026-10-31 gacha'", () => {
    const p = parsePeriod("2026-10-01 dan 2026-10-31 gacha", "2026-11-12");
    expect(p.from).toBe("2026-10-01");
    expect(p.to).toBe("2026-10-31");
  });

  it("quarter: 'shu chorak'", () => {
    const p = parsePeriod("shu chorak", "2026-11-12");
    expect(p.from).toBe("2026-10-01");
    expect(p.to).toBe("2026-12-31");
  });
});

describe("formatPeriodLabel", () => {
  it("label qaytaradi", () => {
    expect(formatPeriodLabel("2026-11-01", "2026-11-30")).toContain("2026");
  });
});

describe("monthStart / weekStart", () => {
  it("monthStart", () => {
    expect(monthStart("2026-11-12")).toBe("2026-11-01");
  });
  it("weekStart", () => {
    const ws = weekStart("2026-11-12");
    expect(isValidYmd(ws)).toBe(true);
  });
});
