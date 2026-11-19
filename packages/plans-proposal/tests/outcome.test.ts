import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  DEFAULT_OUTCOME_TOLERANCE,
  OUTCOME_METHOD_IDS,
  buildOutcomeReport,
  cloneConfig,
  outcomeVerdictLabel,
  type EmployeeSource,
  type OutcomeDataset,
  type OutcomeInput
} from "../src";

const money = (som: number) => (BigInt(som) * 100n).toString();
const PERIODS = { source: { year: 2026, month: 9 }, target: { year: 2026, month: 10 } };

function employee(id: number, net: number, plan: number, history: number[]): EmployeeSource {
  return {
    employeeId: id,
    workSlotId: 1000 + id,
    name: `Agent ${id}`,
    code: `AG-${id}`,
    role: "agent",
    branchId: 1,
    branch: "Toshkent",
    supervisorId: 10,
    supervisor: "SVR",
    linked: true,
    active: true,
    fact: {
      status: "final",
      gross: money(net * 1.1),
      returns: money(net * 0.1),
      net: money(net),
      observedDays: 30,
      daysInMonth: 30,
      updatedAt: "2026-09-30T18:00:00+05:00"
    },
    previousPlan: {
      status: "approved",
      value: money(plan),
      updatedAt: "2026-09-01T10:00:00+05:00"
    },
    history: history.map((value, i) => ({ period: `2026-0${6 + i}`, net: money(value) }))
  };
}

function setup(): { dataset: OutcomeDataset; input: OutcomeInput } {
  const dataset: OutcomeDataset = {
    kpiGroupId: 1,
    sourceEmployees: [
      employee(1, 1_000_000, 1_200_000, [900_000, 950_000, 1_000_000]),
      employee(2, 2_000_000, 2_100_000, []),
      employee(3, 500_000, 550_000, [480_000, 500_000, 520_000])
    ],
    actualByKey: {
      "1:1001": money(1_100_000),
      "2:1002": money(2_000_000),
      "3:1003": null
    }
  };
  const draft = cloneConfig(DEFAULT_CONFIG);
  draft.defaultFormula = { basis: "fact", mode: "percent", value: 20 };
  draft.cellFormulas = { "1:1001": { basis: "fact", mode: "percent", value: 10 } };
  return {
    dataset,
    input: {
      context: { tenantId: 1, directionId: 1, metric: "cost", ...PERIODS },
      datasets: [dataset],
      draftConfigs: { "1": draft },
      tolerancePercent: 2
    }
  };
}

describe("takliflarning o‘zini oqlashi (backtest)", () => {
  it("har bir usulni yopilgan oy fakti bilan solishtiradi va hukm chiqaradi", () => {
    const report = buildOutcomeReport(setup().input);
    expect(report.methods.map((m) => m.id)).toEqual(OUTCOME_METHOD_IDS);
    expect(report.cells).toHaveLength(3);
    expect(report.comparedCells).toBe(2);
    const first = report.cells[0]!;
    expect(first.verdicts.fact_10).toBe("justified");
    expect(first.verdicts.fact_5).toBe("under");
    expect(first.verdicts.previous_plan).toBe("over");
    expect(first.verdicts.history_median).toBe("under");
    expect(first.verdicts.draft).toBe("justified");
    expect(first.deviations.fact_10).toBe(0);
    expect(first.deviations.previous_plan).toBeCloseTo(9.09, 1);
    const second = report.cells[1]!;
    expect(second.verdicts.fact_10).toBe("over");
    expect(second.predictions.history_median).toBeNull();
    expect(second.predictions.draft).toBe(money(2_400_000));
    const third = report.cells[2]!;
    expect(third.actual).toBeNull();
    expect(OUTCOME_METHOD_IDS.every((id) => third.verdicts[id] === "no_data")).toBe(true);
  });

  it("usullar bo‘yicha xulosa jadvali uchun aniqlik va xatolikni hisoblaydi", () => {
    const report = buildOutcomeReport(setup().input);
    const fact10 = report.summaries.find((s) => s.id === "fact_10")!;
    expect(fact10.cells).toBe(3);
    expect(fact10.compared).toBe(2);
    expect(fact10.justified).toBe(1);
    expect(fact10.over).toBe(1);
    expect(fact10.under).toBe(0);
    expect(fact10.noData).toBe(1);
    expect(fact10.accuracyPercent).toBe(50);
    expect(fact10.verdict).toBe("over");
    expect(fact10.predictedTotal).toBe(money(3_300_000));
    expect(fact10.actualTotal).toBe(money(3_100_000));
    const median = report.summaries.find((s) => s.id === "history_median")!;
    expect(median.compared).toBe(1);
    expect(median.noData).toBe(2);
    expect(median.verdict).toBe("under");
    expect(median.meanAbsErrorPercent).toBeGreaterThan(0);
    expect(outcomeVerdictLabel("justified")).toBe("O‘zini oqladi");
    expect(outcomeVerdictLabel("no_data")).toBe("Ma’lumot yo‘q");
  });

  it("draft qoidalari o‘zgarsa faqat draft usuli natijasi o‘zgaradi", () => {
    const { input } = setup();
    const before = buildOutcomeReport(input);
    const draft = cloneConfig(input.draftConfigs["1"]!);
    draft.cellFormulas = { "1:1001": { basis: "fact", mode: "percent", value: 30 } };
    const after = buildOutcomeReport({ ...input, draftConfigs: { "1": draft } });
    expect(before.cells[0]!.predictions.fact_10).toBe(after.cells[0]!.predictions.fact_10);
    expect(after.cells[0]!.predictions.draft).toBe(money(1_300_000));
    expect(after.cells[0]!.verdicts.draft).toBe("over");
  });

  it("chegara keng bo‘lsa ko‘proq taklif oqlanadi", () => {
    const { input } = setup();
    const strict = buildOutcomeReport(input).summaries.find((s) => s.id === "fact_5")!;
    const loose = buildOutcomeReport({ ...input, tolerancePercent: 10 }).summaries.find(
      (s) => s.id === "fact_5"
    )!;
    expect(loose.justified).toBeGreaterThan(strict.justified);
    expect(DEFAULT_OUTCOME_TOLERANCE).toBe(5);
  });

  it("noto‘g‘ri chegara rad etadi; bo‘sh dataset — bo‘sh hisobot", () => {
    const { input } = setup();
    expect(() => buildOutcomeReport({ ...input, tolerancePercent: -1 })).toThrow("chegarasi");
    const empty = buildOutcomeReport({ ...input, datasets: [] });
    expect(empty.cells).toEqual([]);
    expect(empty.comparedCells).toBe(0);
    expect(empty.summaries.length).toBeGreaterThan(0);
  });
});

