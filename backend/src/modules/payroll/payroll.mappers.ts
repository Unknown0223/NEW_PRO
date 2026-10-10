/**
 * ЗАРПЛАТА — DB qatorlarini domain obyektlariga aylantirish (sof).
 *
 * Prisma `Decimal` → `number`, `Json` → tipga mos massiv/obyekt.
 * Barcha parserlar noto‘g‘ri JSON ga chidaydi (xato tashlamaydi).
 */
import { toNumber } from "./payroll.money";
import {
  PAYROLL_FORMULA_KINDS,
  PAYROLL_GRID_MODES,
  PAYROLL_METRIC_KEYS,
  type PayrollComponent,
  type PayrollFormulaConfig,
  type PayrollFormulaData,
  type PayrollFormulaKind,
  type PayrollGate,
  type PayrollGridData,
  type PayrollGridMetric,
  type PayrollGridMode,
  type PayrollGridStep,
  type PayrollMetricKey
} from "./payroll.types";

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function pickKind(v: unknown): PayrollFormulaKind {
  const s = String(v ?? "").trim();
  return (PAYROLL_FORMULA_KINDS as readonly string[]).includes(s) ? (s as PayrollFormulaKind) : "fixed";
}

function pickGridMode(v: unknown): PayrollGridMode {
  const s = String(v ?? "").trim();
  return (PAYROLL_GRID_MODES as readonly string[]).includes(s) ? (s as PayrollGridMode) : "coefficient";
}

function pickMetric(v: unknown, fallback: PayrollMetricKey): PayrollMetricKey {
  const s = String(v ?? "").trim();
  if ((PAYROLL_METRIC_KEYS as readonly string[]).includes(s)) return s as PayrollMetricKey;
  return fallback;
}

/** Сетка metrikasi: `kpi_percent` ham ruxsat etilgan. */
function pickGridMetric(v: unknown, fallback: PayrollGridMetric): PayrollGridMetric {
  const s = String(v ?? "").trim();
  if (s === "kpi_percent") return "kpi_percent";
  if ((PAYROLL_METRIC_KEYS as readonly string[]).includes(s)) return s as PayrollMetricKey;
  return fallback;
}

export function parseComponents(v: unknown): PayrollComponent[] {
  return asArray(v)
    .map((raw, i) => {
      const o = asObject(raw);
      const mode = String(o.mode ?? "fixed");
      const kind = String(o.kind ?? "allowance") === "deduction" ? "deduction" : "allowance";
      return {
        code: String(o.code ?? `component_${i + 1}`).slice(0, 64),
        label: String(o.label ?? (kind === "deduction" ? "Удержание" : "Надбавка")).slice(0, 200),
        kind: kind as PayrollComponent["kind"],
        mode: (["fixed", "percent_base", "percent_gross"].includes(mode)
          ? mode
          : "fixed") as PayrollComponent["mode"],
        value: toNumber(o.value, 0)
      } satisfies PayrollComponent;
    })
    .filter((c) => c.value !== 0);
}

const GATE_OPS = ["lt", "lte", "gt", "gte", "eq"];
const GATE_EFFECTS = ["zero_variable", "reduce_percent"];

export function parseGates(v: unknown): PayrollGate[] {
  const parsed = asArray(v).map((raw): PayrollGate | null => {
    const o = asObject(raw);
    const metric = String(o.metric ?? "").trim();
    const op = String(o.op ?? "lt");
    const effect = String(o.effect ?? "zero_variable");
    if (!(PAYROLL_METRIC_KEYS as readonly string[]).includes(metric) && metric !== "kpi_percent") return null;
    if (!GATE_OPS.includes(op) || !GATE_EFFECTS.includes(effect)) return null;
    const gate: PayrollGate = {
      metric: metric as PayrollGate["metric"],
      op: op as PayrollGate["op"],
      value: toNumber(o.value, 0),
      effect: effect as PayrollGate["effect"],
      reduce_percent: toNumber(o.reduce_percent, 0)
    };
    if (o.label) gate.label = String(o.label).slice(0, 200);
    return gate;
  });
  return parsed.filter((g): g is PayrollGate => g !== null);
}

export function parseConfig(v: unknown): PayrollFormulaConfig {
  const o = asObject(v);
  const cfg: PayrollFormulaConfig = {};
  const numKeys: Array<keyof PayrollFormulaConfig> = [
    "percent",
    "rate_per_unit",
    "absence_penalty_percent",
    "round_to",
    "min_net",
    "max_net"
  ];
  for (const k of numKeys) {
    if (o[k] != null && o[k] !== "") {
      const n = toNumber(o[k]);
      if (Number.isFinite(n)) (cfg as Record<string, unknown>)[k] = n;
    }
  }
  if (typeof o.percent_metric === "string") {
    cfg.percent_metric = pickMetric(o.percent_metric, "sales_sum");
  }
  if (typeof o.unit_metric === "string") {
    cfg.unit_metric = pickMetric(o.unit_metric, "deliveries");
  }
  if (typeof o.bonus_base_metric === "string") {
    cfg.bonus_base_metric = pickMetric(o.bonus_base_metric, "sales_sum");
  }
  if (typeof o.bonus_base_is_oklad === "boolean") cfg.bonus_base_is_oklad = o.bonus_base_is_oklad;
  const prorate = String(o.attendance_prorate ?? "");
  if (["base", "all", "none"].includes(prorate)) {
    cfg.attendance_prorate = prorate as PayrollFormulaConfig["attendance_prorate"];
  }
  return cfg;
}

export function parseGridSteps(rows: Array<Record<string, unknown>>): PayrollGridStep[] {
  return rows.map((r, i) => ({
    id: r.id != null ? Number(r.id) : undefined,
    month: typeof r.month === "string" && /^\d{4}-\d{2}$/.test(r.month) ? r.month : null,
    from_value: r.from_value == null ? null : toNumber(r.from_value, 0),
    to_value: r.to_value == null ? null : toNumber(r.to_value, 0),
    coefficient: toNumber(r.coefficient, 1),
    amount: toNumber(r.amount, 0),
    sort_order: toNumber(r.sort_order, i)
  }));
}

type GridRowLike = {
  id: number;
  name: string;
  code?: string | null;
  kpi_group_id?: number | null;
  metric?: string;
  mode?: string;
  rows?: Array<Record<string, unknown>>;
};

export function mapGridRow(row: GridRowLike): PayrollGridData {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    kpi_group_id: row.kpi_group_id ?? null,
    metric: pickGridMetric(row.metric, "kpi_percent"),
    mode: pickGridMode(row.mode),
    steps: parseGridSteps(row.rows ?? [])
  };
}

type FormulaRowLike = {
  id: number;
  name: string;
  code?: string | null;
  kind: string;
  roles?: string[] | null;
  kpi_group_id?: number | null;
  base_amount?: unknown;
  config?: unknown;
  components?: unknown;
  gates?: unknown;
  priority?: number | null;
  is_default?: boolean;
  is_active?: boolean;
  valid_from?: Date | string | null;
  valid_to?: Date | string | null;
  sort_order?: number | null;
  comment?: string | null;
};

function isoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function mapFormulaRow(row: FormulaRowLike, grid?: PayrollGridData | null): PayrollFormulaData {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    kind: pickKind(row.kind),
    roles: Array.isArray(row.roles) ? row.roles.map((r) => String(r)) : [],
    kpi_group_id: row.kpi_group_id ?? null,
    base_amount: toNumber(row.base_amount, 0),
    config: parseConfig(row.config),
    components: parseComponents(row.components),
    gates: parseGates(row.gates),
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    is_default: row.is_default === true,
    is_active: row.is_active !== false,
    valid_from: isoOrNull(row.valid_from),
    valid_to: isoOrNull(row.valid_to),
    grid: grid ?? null
  };
}
