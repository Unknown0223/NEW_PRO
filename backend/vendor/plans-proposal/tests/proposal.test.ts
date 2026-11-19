import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  addMoney,
  calculateProposal,
  calculateMultiProposal,
  cloneConfig,
  employeeKey,
  formatMoney,
  parseMoneyInput,
  percentChange,
  previousPeriod,
  resolveRule,
  roundMoney,
  scopeMatches,
  shiftPeriod,
  validateConfig,
  validateFormula,
  type EmployeeSource,
  type ProposalConfig,
  type ProposalInput,
  type ProposalRule
} from "../src";

const employee = (patch: Partial<EmployeeSource> = {}): EmployeeSource => ({
  employeeId: 1,
  workSlotId: 101,
  name: "Test agent",
  code: "A001",
  role: "agent",
  branchId: 1,
  branch: "Toshkent",
  supervisorId: 10,
  supervisor: "Test SVR",
  linked: true,
  active: true,
  fact: {
    status: "final",
    gross: "1200000000",
    returns: "200000000",
    net: "1000000000",
    observedDays: 26,
    daysInMonth: 26,
    updatedAt: "2026-11-01T00:00:00Z"
  },
  previousPlan: { status: "approved", value: "900000000", updatedAt: "2026-10-01T00:00:00Z" },
  history: [
    { period: "2026-10", net: "1000000000" },
    { period: "2026-09", net: "950000000" },
    { period: "2026-08", net: "1050000000" }
  ],
  ...patch
});

const input = (
  config: ProposalConfig = DEFAULT_CONFIG,
  employees = [employee()]
): ProposalInput => ({
  context: {
    tenantId: 1,
    directionId: 1,
    kpiGroupId: 1,
    target: { year: 2026, month: 12 },
    source: { year: 2026, month: 11 },
    metric: "cost"
  },
  config,
  employees
});

const rule = (patch: Partial<ProposalRule> = {}): ProposalRule => ({
  id: "r1",
  name: "Maxsus qoida",
  enabled: true,
  scope: { kind: "employees", employeeIds: [1], branchIds: [], supervisorIds: [] },
  formula: { basis: "previous_plan", mode: "amount", value: 1000000 },
  ...patch
});

describe("exact money and periods", () => {
  it("parses and adds decimal money without binary float drift", () => {
    expect(parseMoneyInput("1 234,56")).toBe("123456");
    expect(addMoney("10", "20", "0")).toBe("30");
    expect(formatMoney("123456", 2)).toBe("1 234,56");
    expect(formatMoney("199", 0)).toBe("2");
    expect(formatMoney("-199", 0)).toBe("−2");
    expect(() => parseMoneyInput("1.005")).toThrow();
    expect(() => parseMoneyInput("NaN")).toThrow();
  });
  it("rounds half-up to the configured step and floors at zero", () => {
    expect(roundMoney("123450", "1000")).toBe("123000");
    expect(roundMoney("123500", "1000")).toBe("124000");
    expect(roundMoney("-1", "1000")).toBe("0");
    expect(() => roundMoney("1", "0")).toThrow();
  });
  it("handles year boundaries and negative shifts", () => {
    expect(previousPeriod({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(shiftPeriod({ year: 2026, month: 1 }, -2)).toEqual({ year: 2025, month: 11 });
    expect(percentChange("10000", "11000")).toBe(10);
    expect(percentChange("0", "10")).toBeNull();
  });
});

describe("the two bases × two adjustment methods", () => {
  it("uses net KPI fact plus a percentage", () => {
    const r = calculateProposal(input()).rows[0]!;
    expect(r.base).toBe("1000000000");
    expect(r.value).toBe("1100000000");
    expect(r.adjustment).toBe("100000000");
    expect(r.ready).toBe(true);
  });
  it("uses net KPI fact plus an absolute amount", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula = { basis: "fact", mode: "amount", value: 500000 };
    expect(calculateProposal(input(c)).rows[0]!.value).toBe("1050000000");
  });
  it("uses the previous approved plan plus a percentage", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula = { basis: "previous_plan", mode: "percent", value: 10 };
    expect(calculateProposal(input(c)).rows[0]!.value).toBe("990000000");
  });
  it("uses the previous approved plan plus an absolute amount", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula = { basis: "previous_plan", mode: "amount", value: 500000 };
    expect(calculateProposal(input(c)).rows[0]!.value).toBe("950000000");
  });
  it("supports reductions and clamps negative results", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula.value = -10;
    expect(calculateProposal(input(c)).rows[0]!.value).toBe("900000000");
    c.defaultFormula = { basis: "fact", mode: "amount", value: -20000000 };
    const r = calculateProposal(input(c)).rows[0]!;
    expect(r.value).toBe("0");
    expect(r.ready).toBe(false);
  });
});

describe("bulk and selected employees with deterministic precedence", () => {
  const people = [
    employee(),
    employee({ employeeId: 2, workSlotId: 102, branchId: 2, supervisorId: 20 }),
    employee({ employeeId: 3, workSlotId: 103 })
  ];
  it("applies the default to every eligible agent", () => {
    const result = calculateProposal(input(DEFAULT_CONFIG, people));
    expect(result.rows.every((r) => r.value === "1100000000")).toBe(true);
    expect(result.totals.proposed).toBe("3300000000");
  });
  it("changes only explicitly selected agents", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.rules = [rule()];
    const result = calculateProposal(input(c, people));
    expect(result.rows[0]!.value).toBe("1000000000");
    expect(result.rows[0]!.origin).toBe("rule");
    expect(result.rows[1]!.value).toBe("1100000000");
  });
  it("uses last matching rule, not cumulative additions", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.rules = [
      rule(),
      rule({ id: "r2", name: "Oxirgi", formula: { basis: "fact", mode: "amount", value: 200000 } })
    ];
    const r = calculateProposal(input(c)).rows[0]!;
    expect(r.ruleId).toBe("r2");
    expect(r.value).toBe("1020000000");
  });
  it("ignores disabled rules and respects branch AND supervisor intersections", () => {
    const r = rule({
      scope: { kind: "all", employeeIds: [], branchIds: [1], supervisorIds: [20] }
    });
    expect(resolveRule([r], people[0]!)).toBeNull();
    expect(scopeMatches({ ...r.scope, supervisorIds: [10] }, people[0]!)).toBe(true);
    expect(resolveRule([{ ...r, enabled: false }], people[0]!)).toBeNull();
  });
  it("manual override beats rules, exclusion beats manual; reset restores rules", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.rules = [rule()];
    c.overrides["1:101"] = { value: "1250000000", reason: "Yangi hudud" };
    expect(calculateProposal(input(c)).rows[0]!.value).toBe("1250000000");
    c.excluded = ["1:101"];
    const excluded = calculateProposal(input(c));
    expect(excluded.rows[0]!.value).toBeNull();
    expect(excluded.totals.proposed).toBe("0");
    delete c.overrides["1:101"];
    c.excluded = [];
    expect(calculateProposal(input(c)).rows[0]!.ruleId).toBe("r1");
  });
});

describe("quality gates and incomplete data", () => {
  it("does not silently turn missing fact or missing plan into zero", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    const missingFact = calculateProposal(input(c, [employee({ fact: null })])).rows[0]!;
    expect(missingFact.value).toBeNull();
    expect(missingFact.issues.some((i) => i.code === "NO_FACT")).toBe(true);
    c.defaultFormula.basis = "previous_plan";
    const missingPlan = calculateProposal(input(c, [employee({ previousPlan: null })])).rows[0]!;
    expect(missingPlan.value).toBeNull();
    expect(missingPlan.ready).toBe(false);
  });
  it("filters unapproved source plans unless explicitly opted in", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula.basis = "previous_plan";
    const e = employee({
      previousPlan: { status: "pending_approval", value: "900000000", updatedAt: null }
    });
    expect(calculateProposal(input(c, [e])).rows[0]!.ready).toBe(false);
    c.settings.sourceStatus = "official";
    expect(calculateProposal(input(c, [e])).rows[0]!.ready).toBe(true);
  });
  it("keeps unlinked and inactive employees out of totals", () => {
    const result = calculateProposal(
      input(DEFAULT_CONFIG, [
        employee({ linked: false }),
        employee({ employeeId: 2, active: false })
      ])
    );
    expect(result.totals.ready).toBe(0);
    expect(result.totals.blockers).toBe(2);
    expect(result.totals.proposed).toBe("0");
  });
  it("warns on MTD and projects only with explicit opt-in", () => {
    const e = employee();
    e.fact!.status = "provisional";
    e.fact!.observedDays = 14;
    const c = cloneConfig(DEFAULT_CONFIG);
    const normal = calculateProposal(input(c, [e])).rows[0]!;
    expect(normal.value).toBe("1100000000");
    expect(normal.issues.some((i) => i.code === "PARTIAL_PERIOD")).toBe(true);
    c.settings.projection = { enabled: true, elapsedWorkingDays: 12, totalWorkingDays: 24 };
    const projected = calculateProposal(input(c, [e])).rows[0]!;
    expect(projected.base).toBe("2000000000");
    expect(projected.value).toBe("2200000000");
    expect(projected.issues.some((i) => i.code === "PROJECTED")).toBe(true);
  });
  it("clamps negative net and requires a positive final target", () => {
    const e = employee();
    e.fact!.net = "-100";
    const r = calculateProposal(input(DEFAULT_CONFIG, [e])).rows[0]!;
    expect(r.value).toBe("0");
    expect(r.ready).toBe(false);
    expect(r.issues.some((i) => i.code === "NEGATIVE_NET")).toBe(true);
  });
  it("allows a reasoned manual target to resolve missing data", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.overrides[employeeKey(1, 101)] = { value: "500000000", reason: "Yangi agent, hudud rejasi" };
    const r = calculateProposal(input(c, [employee({ fact: null })])).rows[0]!;
    expect(r.ready).toBe(true);
    expect(r.value).toBe("500000000");
    expect(r.origin).toBe("manual");
  });
  it("warns on anomalous growth without changing the arithmetic", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.defaultFormula.value = 75;
    const r = calculateProposal(input(c)).rows[0]!;
    expect(r.value).toBe("1750000000");
    expect(r.issues.some((i) => i.code === "BIG_INCREASE")).toBe(true);
  });
  it("flags a genuine historical outlier, but not ordinary variation", () => {
    const normal = calculateProposal(input()).rows[0]!;
    expect(normal.issues.some((i) => i.code === "OUTLIER")).toBe(false);
    const e = employee();
    e.fact!.net = "3000000000";
    const spiked = calculateProposal(input(DEFAULT_CONFIG, [e])).rows[0]!;
    expect(spiked.issues.some((i) => i.code === "OUTLIER")).toBe(true);
  });
  it("is deterministic and does not mutate inputs", () => {
    const data = input();
    const before = JSON.stringify(data);
    expect(calculateProposal(data)).toEqual(calculateProposal(data));
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe("inline cells and multi-KPI workspace", () => {
  it("inline cell beats the matching rule and default, but reasoned manual still wins", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.rules = [rule()];
    c.cellFormulas = { "1:101": { basis: "fact", mode: "amount", value: 7000000 } };
    let r = calculateProposal(input(c)).rows[0]!;
    expect(r.origin).toBe("inline");
    expect(r.value).toBe("1700000000");
    expect(r.ruleName).toBe("Jadval formula");
    c.overrides["1:101"] = { value: "1200000000", reason: "Kelishuv" };
    r = calculateProposal(input(c)).rows[0]!;
    expect(r.origin).toBe("manual");
    expect(r.value).toBe("1200000000");
    delete c.overrides["1:101"];
    c.excluded = ["1:101"];
    expect(calculateProposal(input(c)).rows[0]!.origin).toBe("excluded");
  });
  it("keeps separate formulas and totals for each KPI without cross-contamination", () => {
    const a = cloneConfig(DEFAULT_CONFIG);
    const b = cloneConfig(DEFAULT_CONFIG);
    b.defaultFormula = { basis: "previous_plan", mode: "amount", value: 5000000 };
    b.cellFormulas = { "1:101": { basis: "fact", mode: "percent", value: 20 } };
    const base = input();
    const result = calculateMultiProposal({
      context: {
        tenantId: 1,
        directionId: 1,
        target: base.context.target,
        source: base.context.source,
        metric: "cost"
      },
      datasets: [
        { kpiGroupId: 1, employees: [employee()] },
        { kpiGroupId: 2, employees: [employee()] }
      ],
      configs: { "1": a, "2": b }
    });
    expect(result.kpis[0]!.result.rows[0]!.value).toBe("1100000000");
    expect(result.kpis[1]!.result.rows[0]!.value).toBe("1200000000");
    expect(result.totals.proposed).toBe("2300000000");
    expect(result.totals.ready).toBe(2);
  });
  it("rejects duplicate KPI datasets and invalid inline formulas", () => {
    const base = input();
    const context = {
      tenantId: 1,
      directionId: 1,
      target: base.context.target,
      source: base.context.source,
      metric: "cost" as const
    };
    expect(() =>
      calculateMultiProposal({
        context,
        datasets: [
          { kpiGroupId: 1, employees: [] },
          { kpiGroupId: 1, employees: [] }
        ],
        configs: { "1": DEFAULT_CONFIG }
      })
    ).toThrow("takrorlangan");
    const c = cloneConfig(DEFAULT_CONFIG);
    c.cellFormulas = { "1:101": { basis: "fact", mode: "percent", value: 1001 } };
    expect(validateConfig(c)).toContain("1:101");
  });
});

describe("configuration validation", () => {
  it("rejects invalid percentages, empty selections and invalid workdays", () => {
    expect(validateFormula({ basis: "fact", mode: "percent", value: -101 })).toBeTruthy();
    expect(validateFormula({ basis: "fact", mode: "percent", value: 1.005 })).toBeTruthy();
    const c = cloneConfig(DEFAULT_CONFIG);
    c.rules = [
      rule({ scope: { kind: "employees", employeeIds: [], branchIds: [], supervisorIds: [] } })
    ];
    expect(validateConfig(c)).toContain("kamida bitta");
    c.rules = [];
    c.settings.projection.elapsedWorkingDays = 25;
    expect(validateConfig(c)).toContain("Ish kunlari");
  });
  it("requires a manual reason", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    c.overrides["1:101"] = { value: "100", reason: " " };
    expect(validateConfig(c)).toContain("sababi");
  });
});
