/**
 * ЗАРПЛАТА — mapper / rekvizit pure testlari (Prisma talab qilmaydi).
 */
import { describe, expect, it } from "vitest";
import {
  mapFormulaRow,
  mapGridRow,
  parseComponents,
  parseConfig,
  parseGates,
  parseGridSteps
} from "../src/modules/payroll/payroll.mappers";
import { plannedWorkdays, workdayRoleFor, WORKDAY_ROLE_BY_USER_ROLE } from "../src/modules/payroll/payroll.planned-days";
import { daysInMonth, percentOf, round2, roundTo, sumAmounts, toNumber } from "../src/modules/payroll/payroll.money";
import { PAYROLL_ROLES, payrollDefaultKindForRole, payrollRoleLabel } from "../src/modules/payroll/payroll.roles";

/** Prisma `Decimal` o‘rniga — `toNumber()` shu shaklni ham taniydi. */
function decimalLike(v: number) {
  return { toNumber: () => v } as unknown as number;
}

describe("payroll mappers", () => {
  it("Decimal / string qiymatlarni number ga aylantiradi", () => {
    expect(toNumber(decimalLike(1234.5))).toBe(1234.5);
    expect(toNumber("1 234,50")).toBe(1234.5);
    expect(toNumber(null, 7)).toBe(7);
    expect(toNumber("abc", 3)).toBe(3);
  });

  it("komponentlarni parse qiladi, nol qiymatlarni tashlaydi", () => {
    const rows = parseComponents([
      { code: "fuel", label: "Yoqilg‘i", kind: "allowance", mode: "fixed", value: 500_000 },
      { code: "fine", label: "Jarima", kind: "deduction", mode: "percent_base", value: 5 },
      { code: "zero", label: "Nol", kind: "allowance", mode: "fixed", value: 0 },
      "buzilgan"
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ code: "fuel", kind: "allowance", value: 500_000 });
    expect(rows[1]).toMatchObject({ code: "fine", kind: "deduction", mode: "percent_base", value: 5 });
  });

  it("noto‘g‘ri shartlarni (gate) tashlab yuboradi", () => {
    const gates = parseGates([
      { metric: "sales_count", op: "lt", value: 20, effect: "zero_variable" },
      { metric: "kpi_percent", op: "gte", value: 120, effect: "reduce_percent", reduce_percent: 25 },
      { metric: "unknown_metric", op: "lt", value: 1, effect: "zero_variable" },
      { metric: "visits", op: "??", value: 1, effect: "zero_variable" },
      null
    ]);
    expect(gates.length).toBe(2);
    expect(gates[0]).toMatchObject({ metric: "sales_count", op: "lt", effect: "zero_variable" });
    expect(gates[1]).toMatchObject({ metric: "kpi_percent", reduce_percent: 25 });
  });

  it("config ni normallashtiradi", () => {
    const cfg = parseConfig({
      percent: "2,5",
      unit_metric: "deliveries",
      percent_metric: "sales_sum",
      bonus_base_metric: "noma’lum",
      attendance_prorate: "all",
      round_to: 100,
      junk: "x"
    });
    expect(cfg.percent).toBe(2.5);
    expect(cfg.unit_metric).toBe("deliveries");
    expect(cfg.percent_metric).toBe("sales_sum");
    expect(cfg.bonus_base_metric).toBe("sales_sum"); // fallback
    expect(cfg.attendance_prorate).toBe("all");
    expect(cfg.round_to).toBe(100);
    expect((cfg as Record<string, unknown>).junk).toBeUndefined();
  });

  it("setka qatorlarini saralaydi va oylik/baza ajratadi", () => {
    const steps = parseGridSteps([
      { month: "2026-10", from_value: "100", to_value: null, coefficient: "1.5", amount: 0 },
      { month: null, from_value: 0, to_value: "100", coefficient: 0.5, amount: 0 },
      { id: 9 }
    ]);
    expect(steps[0]).toMatchObject({ month: "2026-10", from_value: 100, coefficient: 1.5 });
    expect(steps[1].month).toBeNull();
    expect(steps[2].coefficient).toBe(1);
  });

  it("formula qatorini domain obyektiga aylantiradi", () => {
    const row = mapFormulaRow(
      {
        id: 3,
        name: "Agent KPI",
        kind: "kpi_bonus",
        roles: ["agent"],
        kpi_group_id: 5,
        base_amount: decimalLike(2_000_000),
        config: { percent: 10, grid_id: 7 },
        components: [{ code: "a", label: "A", kind: "allowance", mode: "fixed", value: 100 }],
        gates: [{ metric: "sales_count", op: "lt", value: 10, effect: "zero_variable" }],
        priority: 5,
        is_default: false,
        is_active: true,
        valid_from: new Date("2026-01-01T00:00:00.000Z"),
        valid_to: null
      },
      mapGridRow({ id: 7, name: "Сетка", metric: "kpi_percent", mode: "coefficient", rows: [] })
    );
    expect(row.base_amount).toBe(2_000_000);
    expect(row.kind).toBe("kpi_bonus");
    expect(row.grid?.id).toBe(7);
    expect(row.components.length).toBe(1);
    expect(row.gates.length).toBe(1);
    expect(row.valid_from).toBe("2026-01-01T00:00:00.000Z");
    expect(row.valid_to).toBeNull();
  });

  it("noma’lum hisob turi → fixed", () => {
    const row = mapFormulaRow({ id: 1, name: "x", kind: "magic" });
    expect(row.kind).toBe("fixed");
    expect(row.is_active).toBe(true);
  });
});

describe("payroll me’yoriy kunlar", () => {
  const snapshot = {
    schedules: {
      Агент: [true, true, true, true, true, true, false], // Дш–Шн
      Супервайзер: [true, true, true, true, true, false, false] // 5 kun
    },
    exceptions: [
      { role: "ALL", date: "2026-10-01", type: "holiday" as const },
      { role: "Супервайзер", date: "2026-10-04", type: "forced" as const }
    ],
    overrides: []
  };

  it("rol bo‘yicha me’yorni hisoblaydi (2026-10)", () => {
    // 2026-10: 31 kun, 5 ta yakshanba (4, 11, 18, 25) — 4 ta
    expect(plannedWorkdays({ snapshot, month: "2026-10", userRole: "agent" })).toBe(31 - 4 - 1);
    expect(plannedWorkdays({ snapshot, month: "2026-10", userRole: "supervisor" })).toBe(22);
  });

  it("individual grafik roldan ustun", () => {
    const withOverride = {
      ...snapshot,
      overrides: [{ employeeId: "77", schedule: [true, false, false, false, false, false, false] }]
    };
    const count = plannedWorkdays({ snapshot: withOverride, month: "2026-10", userRole: "agent", userId: 77 });
    // 2026-10 da dushanbalar: 5, 12, 19, 26 → 4 kun
    expect(count).toBe(4);
  });

  it("snapshot bo‘lmasa — standart 6 kunlik grafik", () => {
    expect(plannedWorkdays({ snapshot: null, month: "2026-10", userRole: "driver" })).toBe(31 - 4);
    expect(daysInMonth("2026-10")).toBe(31);
  });

  it("rol xaritasi", () => {
    expect(workdayRoleFor("agent")).toBe("Агент");
    expect(WORKDAY_ROLE_BY_USER_ROLE.supervisor).toBe("Супервайзер");
    expect(workdayRoleFor("noma’lum")).toBe("Складчик");
  });
});

describe("payroll rol katalogi", () => {
  it("har bir rol uchun standart hisob turi bor", () => {
    expect(PAYROLL_ROLES.length).toBeGreaterThan(15);
    for (const r of PAYROLL_ROLES) {
      expect(r.kinds).toContain(r.defaultKind);
      expect(payrollDefaultKindForRole(r.role)).toBe(r.defaultKind);
      expect(payrollRoleLabel(r.role)).toBeTruthy();
    }
    expect(payrollDefaultKindForRole("bunday_rol_yoq")).toBe("fixed");
    expect(payrollRoleLabel(null)).toBe("—");
  });
});

describe("payroll pul yordamchilari", () => {
  it("yaxlitlash va foiz", () => {
    expect(round2(1234.567)).toBe(1234.57);
    expect(roundTo(1499, 100)).toBe(1500);
    expect(roundTo(1499, null)).toBe(1499);
    expect(percentOf(200_000, 2.5)).toBe(5000);
    expect(sumAmounts([1.5, 2.25, null, undefined])).toBe(3.75);
  });
});
