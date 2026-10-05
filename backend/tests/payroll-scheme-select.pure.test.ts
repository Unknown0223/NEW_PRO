import { describe, expect, it } from "vitest";
import { activeOverrides, pickScheme, ymAdd, type SchemeSelector } from "../src/modules/payroll/payroll.scheme-select.pure";

const s = (id: number, p: Partial<SchemeSelector>): SchemeSelector => ({
  id,
  roles: ["agent"],
  branches: [],
  trade_direction_ids: [],
  positions: [],
  valid_from: 202601,
  valid_to: null,
  is_active: true,
  ...p
});

const agent = { role: "agent", branch: "Toshkent", trade_direction_id: 2, position: null };

describe("pickScheme", () => {
  it("eng aniq filtrli sxema yutadi", () => {
    const all = [s(1, {}), s(2, { branches: ["Toshkent"] }), s(3, { branches: ["Samarqand"] })];
    expect(pickScheme(all, agent, 202610)?.id).toBe(2);
    expect(pickScheme(all, { ...agent, branch: "Buxoro" }, 202610)?.id).toBe(1);
  });

  it("versiya: oy oralig'iga mos keladigan va kechroq boshlangani", () => {
    const all = [s(1, { valid_to: 202608 }), s(2, { valid_from: 202609 })];
    expect(pickScheme(all, agent, 202608)?.id).toBe(1);
    expect(pickScheme(all, agent, 202609)?.id).toBe(2);
    expect(pickScheme(all, agent, 202512)).toBeNull();
  });

  it("boshqa rol, nofaol yoki savdo yo'nalishi mos kelmasa — tanlanmaydi", () => {
    expect(pickScheme([s(1, { roles: ["expeditor"] })], agent, 202610)).toBeNull();
    expect(pickScheme([s(1, { is_active: false })], agent, 202610)).toBeNull();
    expect(pickScheme([s(1, { trade_direction_ids: [5] })], agent, 202610)).toBeNull();
    expect(pickScheme([s(1, { positions: ["katta"] })], agent, 202610)).toBeNull();
  });
});

describe("activeOverrides / ymAdd", () => {
  it("oyda amal qiladigan eng kech farq", () => {
    const m = activeOverrides(
      [
        { rule_code: "base", amount: 5_000_000, valid_from: 202601, valid_to: null },
        { rule_code: "base", amount: 6_000_000, valid_from: 202609, valid_to: null },
        { rule_code: "road", amount: 1, valid_from: 202601, valid_to: 202603 }
      ],
      202610
    );
    expect([...m]).toEqual([["base", 6_000_000]]);
  });

  it("oy qo'shish yil chegarasidan o'tadi", () => {
    expect(ymAdd(202612, 1)).toBe(202701);
    expect(ymAdd(202601, -1)).toBe(202512);
    expect(ymAdd(202610, 0)).toBe(202610);
  });
});
