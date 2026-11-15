import { calculateProposal } from "./calculate";
import { DEFAULT_CONFIG, cloneConfig, employeeKey } from "./config";
import { addMoney, assertMoney } from "./money";
import type {
  DirectionContext,
  EmployeeSource,
  Money,
  Period,
  ProposalConfig,
  ProposalContext
} from "./types";

/** Yopilgan oy fakti bilan solishtiriladigan taklif usullari. */
export type OutcomeMethodId = "fact_10" | "fact_5" | "previous_plan" | "history_median" | "draft";

export type OutcomeMethod = { id: OutcomeMethodId; name: string; description: string };

export const OUTCOME_METHODS: OutcomeMethod[] = [
  {
    id: "fact_10",
    name: "Sof fakt +10%",
    description: "Standart taklif: oldingi oy sof fakti +10%"
  },
  {
    id: "fact_5",
    name: "Sof fakt +5%",
    description: "Ehtiyotkor taklif: oldingi oy sof fakti +5%"
  },
  {
    id: "previous_plan",
    name: "Eski reja (o‘zgarishsiz)",
    description: "Oldingi oyning tasdiqlangan rejasi ko‘chiriladi"
  },
  {
    id: "history_median",
    name: "3 oy medianasi",
    description: "Oldingi 3 yakunlangan oy sof faktining medianasi"
  },
  {
    id: "draft",
    name: "Joriy umumiy draft",
    description: "Hozirgi draft qoidalari o‘sha davrga qayta qo‘llanadi"
  }
];

export const OUTCOME_METHOD_IDS = OUTCOME_METHODS.map((m) => m.id);
export const DEFAULT_OUTCOME_TOLERANCE = 5;

export type OutcomeVerdict = "justified" | "over" | "under" | "no_data";

export type OutcomeDataset = {
  kpiGroupId: number;
  /** Taklif tuzilgan oy (manba) xodimlari: fakt, eski reja va tarix shu yerda. */
  sourceEmployees: EmployeeSource[];
  /** Baholanayotgan yopilgan oyning haqiqiy sof fakti, employeeKey bo‘yicha. */
  actualByKey: Record<string, Money | null>;
};

export type OutcomeInput = {
  context: DirectionContext & { target: Period; source: Period };
  datasets: OutcomeDataset[];
  draftConfigs: Record<string, ProposalConfig>;
  tolerancePercent?: number;
};

export type OutcomeCell = {
  key: string;
  employeeName: string;
  kpiGroupId: number;
  actual: Money | null;
  predictions: Record<OutcomeMethodId, Money | null>;
  /** (taklif − fakt) / fakt, foizda; fakt bo‘lmasa null. */
  deviations: Record<OutcomeMethodId, number | null>;
  verdicts: Record<OutcomeMethodId, OutcomeVerdict>;
};

export type OutcomeSummary = {
  id: OutcomeMethodId;
  name: string;
  description: string;
  cells: number;
  compared: number;
  justified: number;
  over: number;
  under: number;
  noData: number;
  accuracyPercent: number | null;
  meanAbsErrorPercent: number | null;
  predictedTotal: Money;
  actualTotal: Money;
  verdict: OutcomeVerdict;
};

export type OutcomeReport = {
  target: Period;
  source: Period;
  tolerancePercent: number;
  methods: OutcomeMethod[];
  cells: OutcomeCell[];
  summaries: OutcomeSummary[];
  comparedCells: number;
};

function medianOf(values: bigint[]): bigint | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2n;
}

function keyOf(employee: EmployeeSource): string {
  return employeeKey(employee.employeeId, employee.workSlotId);
}

function configForMethod(
  method: OutcomeMethodId,
  employees: EmployeeSource[],
  draftConfig: ProposalConfig
): ProposalConfig {
  const config = cloneConfig(DEFAULT_CONFIG);
  if (method === "fact_5") {
    config.defaultFormula = { basis: "fact", mode: "percent", value: 5 };
  } else if (method === "previous_plan") {
    config.defaultFormula = { basis: "previous_plan", mode: "percent", value: 0 };
  } else if (method === "history_median") {
    config.excluded = [];
    for (const employee of employees) {
      const nets = employee.history
        .slice(0, 3)
        .map((h) => assertMoney(h.net))
        .filter((n) => n > 0n);
      const median = medianOf(nets);
      if (median == null) config.excluded.push(keyOf(employee));
      else
        config.overrides[keyOf(employee)] = {
          value: median.toString(),
          reason: "3 oy medianasi (backtest)"
        };
    }
  } else if (method === "draft") {
    return cloneConfig(draftConfig);
  }
  return config;
}

function predictionsFor(
  method: OutcomeMethodId,
  dataset: OutcomeDataset,
  context: ProposalContext,
  draftConfig: ProposalConfig
): Map<string, Money | null> {
  const config = configForMethod(method, dataset.sourceEmployees, draftConfig);
  const result = calculateProposal({ context, config, employees: dataset.sourceEmployees });
  return new Map(
    result.rows.map((row) => [row.key, row.ready && row.value != null ? row.value : null])
  );
}

function deviationOf(predicted: Money | null, actual: Money | null): number | null {
  if (predicted == null || actual == null) return null;
  const p = assertMoney(predicted);
  const a = assertMoney(actual);
  if (a <= 0n) return null;
  return Number(((p - a) * 10000n) / a) / 100;
}

function verdictOf(deviation: number | null, tolerance: number): OutcomeVerdict {
  if (deviation == null) return "no_data";
  if (Math.abs(deviation) <= tolerance) return "justified";
  return deviation > 0 ? "over" : "under";
}

/**
 * Taklif usullarini yopilgan oyning haqiqiy fakti bilan solishtiradi.
 * Faqat sof hisob: API, localStorage va tasdiqlash oqimi yo‘q.
 */
export function buildOutcomeReport(input: OutcomeInput): OutcomeReport {
  const tolerance = input.tolerancePercent ?? DEFAULT_OUTCOME_TOLERANCE;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1000)
    throw new Error("Baholash chegarasi 0–1000 foiz oralig‘ida bo‘lishi kerak");
  if (!input.datasets.length) throw new Error("Kamida bitta KPI dataset kerak");
  const byMethod = new Map<OutcomeMethodId, Map<number, Map<string, Money | null>>>();
  for (const method of OUTCOME_METHODS) {
    const perKpi = new Map<number, Map<string, Money | null>>();
    for (const dataset of input.datasets) {
      const context: ProposalContext = {
        ...input.context,
        kpiGroupId: dataset.kpiGroupId
      };
      const draft = input.draftConfigs[String(dataset.kpiGroupId)] ?? DEFAULT_CONFIG;
      perKpi.set(dataset.kpiGroupId, predictionsFor(method.id, dataset, context, draft));
    }
    byMethod.set(method.id, perKpi);
  }

  const cells: OutcomeCell[] = [];
  for (const dataset of input.datasets) {
    for (const employee of dataset.sourceEmployees) {
      const key = keyOf(employee);
      const actual = dataset.actualByKey[key] ?? null;
      const predictions = {} as Record<OutcomeMethodId, Money | null>;
      const deviations = {} as Record<OutcomeMethodId, number | null>;
      const verdicts = {} as Record<OutcomeMethodId, OutcomeVerdict>;
      for (const method of OUTCOME_METHODS) {
        const predicted = byMethod.get(method.id)!.get(dataset.kpiGroupId)!.get(key) ?? null;
        const deviation = deviationOf(predicted, actual);
        predictions[method.id] = predicted;
        deviations[method.id] = deviation;
        verdicts[method.id] = verdictOf(deviation, tolerance);
      }
      cells.push({
        key,
        employeeName: employee.name,
        kpiGroupId: dataset.kpiGroupId,
        actual,
        predictions,
        deviations,
        verdicts
      });
    }
  }

  const summaries = OUTCOME_METHODS.map((method): OutcomeSummary => {
    let justified = 0;
    let over = 0;
    let under = 0;
    let noData = 0;
    let absSum = 0;
    let predictedItems: Money[] = [];
    let actualItems: Money[] = [];
    for (const cell of cells) {
      const verdict = cell.verdicts[method.id];
      if (verdict === "justified") justified++;
      else if (verdict === "over") over++;
      else if (verdict === "under") under++;
      else noData++;
      const deviation = cell.deviations[method.id];
      if (deviation != null) {
        absSum += Math.abs(deviation);
        predictedItems.push(cell.predictions[method.id]!);
        actualItems.push(cell.actual!);
      }
    }
    const compared = justified + over + under;
    const accuracy = compared ? Math.round((justified / compared) * 100) : null;
    const verdict: OutcomeVerdict = !compared
      ? "no_data"
      : justified / compared >= 0.6
        ? "justified"
        : over >= under
          ? "over"
          : "under";
    return {
      id: method.id,
      name: method.name,
      description: method.description,
      cells: cells.length,
      compared,
      justified,
      over,
      under,
      noData,
      accuracyPercent: accuracy,
      meanAbsErrorPercent: compared ? Math.round((absSum / compared) * 100) / 100 : null,
      predictedTotal: addMoney(...predictedItems),
      actualTotal: addMoney(...actualItems),
      verdict
    };
  });

  return {
    target: input.context.target,
    source: input.context.source,
    tolerancePercent: tolerance,
    methods: OUTCOME_METHODS,
    cells,
    summaries,
    comparedCells: cells.filter((c) => c.verdicts.fact_10 !== "no_data").length
  };
}

export function outcomeVerdictLabel(verdict: OutcomeVerdict): string {
  return {
    justified: "O‘zini oqladi",
    over: "Oqlanmadi · yuqori",
    under: "Oqlanmadi · past",
    no_data: "Ma’lumot yo‘q"
  }[verdict];
}
