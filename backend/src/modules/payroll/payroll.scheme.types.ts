import { z } from "zod";

export const RULE_KINDS = ["base", "fixed", "kpi", "rate", "formula", "manual"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const COND_FIELDS = [
  "branch",
  "trade_direction",
  "position",
  "tenure_months",
  "worked_days",
  "worked_pct",
  "kpi_pct",
  "acb_pct",
  "return_pct",
  "team_kpi_pct"
] as const;
export type CondField = (typeof COND_FIELDS)[number];

export const METRICS = ["cost", "count", "volume", "acb", "order_count"] as const;
export type Metric = (typeof METRICS)[number];

export const RATE_METRICS = [
  "exp_orders",
  "exp_sum",
  "exp_volume",
  "exp_clients",
  "sales_sum",
  "sales_count",
  "sales_volume",
  "acb",
  "orders",
  "worked_days"
] as const;
export type RateMetric = (typeof RATE_METRICS)[number];

const condSchema = z.object({
  field: z.enum(COND_FIELDS),
  op: z.enum(["in", "not_in", ">=", ">", "<=", "<", "="]),
  value: z.union([z.number(), z.array(z.union([z.string(), z.number()])).max(200)])
});
export type Cond = z.infer<typeof condSchema>;

const when = z.array(condSchema).max(10).default([]);
const cases = z
  .array(z.object({ when: z.array(condSchema).min(1).max(10), amount: z.number().min(-1e12).max(1e12) }))
  .max(20)
  .default([]);
const money = z.number().min(0).max(1e12);

const scalePoint = z.object({ at: z.number().min(0).max(1000), pay: z.number().min(0).max(1000) });
export type ScalePoint = z.infer<typeof scalePoint>;

const kpiPart = z.object({
  label: z.string().max(80).optional(),
  metric: z.enum(METRICS),
  source: z.enum(["own", "team"]).default("own"),
  mode: z.enum(["total", "groups"]).default("groups"),
  weight: z.number().min(0).max(100),
  groups: z.array(z.number().int().positive()).max(50).default([]),
  split: z.enum(["plan", "equal", "weights"]).default("plan"),
  group_weights: z.record(z.string(), z.number().min(0)).default({})
});
export type KpiPart = z.infer<typeof kpiPart>;

const gate = z.object({
  when: z.array(condSchema).min(1).max(10),
  factor: z.number().min(0).max(10).optional(),
  min_pay: z.number().min(0).max(1000).optional()
});

export const RULE_PARAMS = {
  base: z.object({ amount: money, prorate: z.boolean().default(true), cases, when }),
  fixed: z.object({ amount: money, prorate: z.boolean().default(false), cases, when }),
  kpi: z.object({
    fund: money,
    cases,
    when,
    parts: z.array(kpiPart).min(1).max(12),
    scale: z.array(scalePoint).min(1).max(12),
    gates: z.array(gate).max(10).default([])
  }),
  rate: z.object({ metric: z.enum(RATE_METRICS), rate: z.number().min(0).max(1e9), percent: z.boolean().default(false), cases, when }),
  formula: z.object({ text: z.string().trim().min(1).max(4000), amount: z.number().min(-1e12).max(1e12).default(0), when }),
  manual: z.object({ max: z.number().min(0).nullable().default(null) })
} as const;

export type BaseParams = z.infer<typeof RULE_PARAMS.base>;
export type FixedParams = z.infer<typeof RULE_PARAMS.fixed>;
export type KpiParams = z.infer<typeof RULE_PARAMS.kpi>;
export type RateParams = z.infer<typeof RULE_PARAMS.rate>;
export type FormulaParams = z.infer<typeof RULE_PARAMS.formula>;
export type ManualParams = z.infer<typeof RULE_PARAMS.manual>;

export type SchemeRule =
  | { code: string; name: string; kind: "base"; item_id: null; params: BaseParams }
  | { code: string; name: string; kind: "fixed"; item_id: number; params: FixedParams }
  | { code: string; name: string; kind: "kpi"; item_id: number; params: KpiParams }
  | { code: string; name: string; kind: "rate"; item_id: number; params: RateParams }
  | { code: string; name: string; kind: "formula"; item_id: number; params: FormulaParams }
  | { code: string; name: string; kind: "manual"; item_id: number; params: ManualParams };

/** DB qatori → tekshirilgan qoida. Xato bo'lsa — `{ error }`. */
export function parseSchemeRule(row: {
  code: string;
  name: string;
  kind: string;
  item_id: number | null;
  params: unknown;
}): SchemeRule | { error: string } {
  if (!(RULE_KINDS as readonly string[]).includes(row.kind)) return { error: `Неизвестный тип правила «${row.kind}»` };
  const kind = row.kind as RuleKind;
  const parsed = RULE_PARAMS[kind].safeParse(row.params ?? {});
  if (!parsed.success) return { error: `${row.name}: ${parsed.error.issues[0]?.message ?? "неверные параметры"}` };
  if (kind !== "base" && row.item_id == null) return { error: `${row.name}: не выбрана статья` };
  return { code: row.code, name: row.name, kind, item_id: kind === "base" ? null : row.item_id, params: parsed.data } as SchemeRule;
}

export type EmployeeAttrs = {
  branch: string | null;
  trade_direction_id: number | null;
  position: string | null;
  tenure_months: number | null;
};

export type ExplainPart = {
  label: string;
  plan?: number;
  fact?: number;
  pct?: number;
  pay_pct?: number;
  share?: number;
  amount: number;
};

export type Explain = { text: string; parts?: ExplainPart[]; notes?: string[] };

export type YmInt = number;
export const ymInt = (year: number, month: number): YmInt => year * 100 + month;
