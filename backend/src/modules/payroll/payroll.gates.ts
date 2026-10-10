/**
 * ЗАРПЛАТА — shartlar (gates).
 *
 * Har bir shart **bloklovchi** holatni tasvirlaydi: agar ifoda bajarilsa,
 * o‘zgaruvchan qism (bonus/foiz/stawka) kesiladi.
 *
 * Misollar:
 *   { metric: "order_count", op: "lt",  value: 20,  effect: "zero_variable" }
 *      → 20 tadan kam zakaz bo‘lsa, bonus 0.
 *   { metric: "kpi_percent", op: "lt",  value: 80,  effect: "reduce_percent", reduce_percent: 50 }
 *      → bajarilish 80% dan past bo‘lsa, bonus yarmiga kesiladi.
 *   { metric: "absent_days", op: "gt",  value: 3,   effect: "zero_variable" }
 *      → 3 kundan ko‘p прогул bo‘lsa, bonus 0.
 */
import type { PayrollBreakdownLine, PayrollGate, PayrollMetrics } from "./payroll.types";

export type GateOutcome = {
  /** Kamida bitta shart o‘zgaruvchan qismni to‘liq kesti. */
  blocked: boolean;
  /** O‘zgaruvchan qismga qo‘llanadigan koeffitsiyent (0..1). */
  multiplier: number;
  /** Ishlagan shartlar (traceability). */
  triggered: PayrollGate[];
  warnings: string[];
  lines: PayrollBreakdownLine[];
};

export const EMPTY_GATE_OUTCOME: GateOutcome = {
  blocked: false,
  multiplier: 1,
  triggered: [],
  warnings: [],
  lines: []
};

function gateMetricValue(
  gate: PayrollGate,
  metrics: PayrollMetrics,
  achievementPercent: number | null
): number | null {
  if (gate.metric === "kpi_percent") return achievementPercent;
  const v = metrics[gate.metric];
  return Number.isFinite(v) ? v : null;
}

function compare(value: number, op: PayrollGate["op"], threshold: number): boolean {
  switch (op) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "eq":
      return Math.abs(value - threshold) < 1e-9;
    default:
      return false;
  }
}

const OP_LABEL_RU: Record<PayrollGate["op"], string> = {
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  eq: "="
};

export function gateLabel(gate: PayrollGate): string {
  if (gate.label?.trim()) return gate.label.trim();
  return `${gate.metric} ${OP_LABEL_RU[gate.op]} ${gate.value}`;
}

export function evaluateGates(
  gates: PayrollGate[] | null | undefined,
  metrics: PayrollMetrics,
  achievementPercent: number | null
): GateOutcome {
  if (!gates || gates.length === 0) return EMPTY_GATE_OUTCOME;

  let multiplier = 1;
  let blocked = false;
  const triggered: PayrollGate[] = [];
  const warnings: string[] = [];
  const lines: PayrollBreakdownLine[] = [];

  for (const gate of gates) {
    const value = gateMetricValue(gate, metrics, achievementPercent);
    if (value == null) {
      warnings.push(`Шарт «${gateLabel(gate)}» tekshirilmadi: ko‘rsatkich mavjud emas`);
      continue;
    }
    if (!compare(value, gate.op, gate.value)) continue;

    triggered.push(gate);
    if (gate.effect === "zero_variable") {
      blocked = true;
      multiplier = 0;
      warnings.push(`Шарт bajarildi: «${gateLabel(gate)}» → bonus/ustama 0`);
      lines.push({
        code: `gate_${gate.metric}_${gate.op}`,
        label: `Шарт: ${gateLabel(gate)}`,
        amount: 0,
        note: "O‘zgaruvchan qism to‘liq kesildi"
      });
      continue;
    }

    const rawReduce = typeof gate.reduce_percent === "number" && Number.isFinite(gate.reduce_percent)
      ? gate.reduce_percent
      : 0;
    const reduce = Math.min(100, Math.max(0, rawReduce));
    const factor = 1 - reduce / 100;
    multiplier = Math.min(multiplier, factor);
    warnings.push(`Шарт bajarildi: «${gateLabel(gate)}» → −${reduce}%`);
    lines.push({
      code: `gate_${gate.metric}_${gate.op}`,
      label: `Шарт: ${gateLabel(gate)}`,
      amount: 0,
      note: `O‘zgaruvchan qism −${reduce}%`
    });
  }

  return { blocked, multiplier, triggered, warnings, lines };
}
