export type RuleKind = "base" | "fixed" | "kpi" | "rate" | "formula" | "manual";
export type CondField =
  | "branch"
  | "trade_direction"
  | "position"
  | "tenure_months"
  | "worked_days"
  | "worked_pct"
  | "kpi_pct"
  | "acb_pct"
  | "return_pct"
  | "team_kpi_pct";
export type CondOp = "in" | "not_in" | ">=" | ">" | "<=" | "<" | "=";
export type Cond = { field: CondField; op: CondOp; value: number | Array<string | number> };
export type Case = { when: Cond[]; amount: number };
export type Metric = "cost" | "count" | "volume" | "acb" | "order_count";
export type RateMetric =
  | "exp_orders"
  | "exp_sum"
  | "exp_volume"
  | "exp_clients"
  | "sales_sum"
  | "sales_count"
  | "sales_volume"
  | "acb"
  | "orders"
  | "worked_days";

export type KpiPart = {
  label?: string;
  metric: Metric;
  source: "own" | "team";
  mode: "total" | "groups";
  weight: number;
  groups: number[];
  split: "plan" | "equal" | "weights";
  group_weights: Record<string, number>;
};
export type ScalePoint = { at: number; pay: number };
export type Gate = { when: Cond[]; factor?: number; min_pay?: number };

export type RuleParams = {
  amount?: number;
  prorate?: boolean;
  cases?: Case[];
  when?: Cond[];
  fund?: number;
  parts?: KpiPart[];
  scale?: ScalePoint[];
  gates?: Gate[];
  metric?: RateMetric;
  rate?: number;
  percent?: boolean;
  text?: string;
  max?: number | null;
};

export type SchemeRuleDraft = { key: string; code: string; name: string; kind: RuleKind; item_id: number | null; params: RuleParams };

export type SchemeDraft = {
  id?: number;
  name: string;
  roles: string[];
  branches: string[];
  trade_direction_ids: number[];
  positions: string[];
  valid_from: number;
  valid_to: number | null;
  is_active: boolean;
  note: string | null;
  rules: SchemeRuleDraft[];
};

export type SchemeRow = Omit<SchemeDraft, "rules"> & {
  id: number;
  rules: Array<Omit<SchemeRuleDraft, "key"> & { id: number; sort: number }>;
  records: number;
  locked_by: string | null;
  updated_at: string;
};

export type SchemeMatch = {
  user_id: number;
  name: string;
  role: string;
  branch: string | null;
  trade_direction_id: number | null;
  position: string | null;
  scheme_id: number | null;
  scheme_name: string | null;
  scheme_errors: string[];
};

export type ExplainPart = { label: string; plan?: number; fact?: number; pct?: number; pay_pct?: number; share?: number; amount: number };
export type Explain = { text: string; parts?: ExplainPart[]; notes?: string[] };

export type SchemePreview = {
  base_salary: number;
  base_explain: Explain | null;
  lines: Array<{ item_id: number; name: string; type: string; amount: number; source: string; explain: Explain | null }>;
  allowances_total: number;
  deductions_total: number;
  gross: number;
  current_gross: number | null;
  warnings: string[];
  errors: string[];
  facts: { plan_days: number; worked_days: number; sales_sum: number; plan_sum: number; acb: number; returned_sum: number };
};

export type SchemeOverride = {
  id: number;
  user_id: number;
  user_name: string | null;
  rule_code: string;
  amount: number;
  valid_from: number;
  valid_to: number | null;
  note: string | null;
  locked_by: string | null;
};

export const KIND_META: Record<RuleKind, { label: string; hint: string }> = {
  base: { label: "Оклад", hint: "Основной оклад, пропорционально отработанным дням" },
  fixed: { label: "Фикс. надбавка", hint: "Постоянная сумма: дорожные, связь, ноллаш" },
  kpi: { label: "KPI-фонд", hint: "Фонд × выполнение плана по шкале, части с весами" },
  rate: { label: "Ставка", hint: "Ставка × показатель: заказ, тонна, % от суммы" },
  formula: { label: "Формула", hint: "Свободная формула для особых случаев" },
  manual: { label: "Вручную", hint: "Сумма вводится в ведомости" }
};

export const COND_META: Record<CondField, { label: string; text: boolean; unit?: string }> = {
  branch: { label: "Филиал", text: true },
  trade_direction: { label: "Направление торговли", text: true },
  position: { label: "Должность", text: true },
  tenure_months: { label: "Стаж", text: false, unit: "мес." },
  worked_days: { label: "Отработано дней", text: false, unit: "дн." },
  worked_pct: { label: "Отработано", text: false, unit: "%" },
  kpi_pct: { label: "Выполнение плана", text: false, unit: "%" },
  acb_pct: { label: "Выполнение АКБ", text: false, unit: "%" },
  return_pct: { label: "Возвраты", text: false, unit: "%" },
  team_kpi_pct: { label: "План команды", text: false, unit: "%" }
};

export const OP_LABEL: Record<CondOp, string> = { in: "из списка", not_in: "кроме", ">=": "≥", ">": ">", "<=": "≤", "<": "<", "=": "=" };

export const METRIC_LABEL: Record<Metric, string> = { cost: "Сумма", count: "Количество", volume: "Объём", acb: "АКБ", order_count: "Заказы" };

export const RATE_METRIC_LABEL: Record<RateMetric, string> = {
  exp_orders: "Доставлено заказов",
  exp_sum: "Сумма доставки",
  exp_volume: "Объём доставки",
  exp_clients: "Клиентов доставки",
  sales_sum: "Сумма продаж",
  sales_count: "Кол-во продаж",
  sales_volume: "Объём продаж",
  acb: "АКБ",
  orders: "Заказов",
  worked_days: "Отработанных дней"
};

export const SCHEME_ROLES = ["agent", "expeditor", "supervisor", "operator", "manager", "sales_director", "regional_manager", "cashier", "warehouse", "accountant"];

let seq = 0;
export const newKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export function defaultParams(kind: RuleKind): RuleParams {
  switch (kind) {
    case "base":
      return { amount: 0, prorate: true, cases: [], when: [] };
    case "fixed":
      return { amount: 0, prorate: false, cases: [], when: [] };
    case "kpi":
      return {
        fund: 0,
        cases: [],
        when: [],
        parts: [{ metric: "cost", source: "own", mode: "total", weight: 100, groups: [], split: "plan", group_weights: {} }],
        scale: [
          { at: 60, pay: 60 },
          { at: 100, pay: 100 },
          { at: 120, pay: 120 }
        ],
        gates: []
      };
    case "rate":
      return { metric: "exp_orders", rate: 0, percent: false, cases: [], when: [] };
    case "formula":
      return { text: "", amount: 0, when: [] };
    case "manual":
      return { max: null };
  }
}

const CODE_BASE: Record<RuleKind, string> = { base: "base", fixed: "fix", kpi: "kpi", rate: "rate", formula: "f", manual: "man" };

export function nextCode(kind: RuleKind, used: string[]): string {
  if (kind === "base" && !used.includes("base")) return "base";
  for (let i = 1; ; i++) {
    const c = `${CODE_BASE[kind]}${i}`;
    if (!used.includes(c)) return c;
  }
}

export const ymNum = (y: number, m: number) => y * 100 + m;
export const ymText = (v: number | null) => (v == null ? "—" : `${String(v % 100).padStart(2, "0")}.${Math.floor(v / 100)}`);
export const ymFromInput = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
};
export const ymToInputStr = (v: number | null) => (v == null ? "" : `${Math.floor(v / 100)}-${String(v % 100).padStart(2, "0")}`);

export function toDraft(s: SchemeRow): SchemeDraft {
  return {
    id: s.id,
    name: s.name,
    roles: s.roles,
    branches: s.branches,
    trade_direction_ids: s.trade_direction_ids,
    positions: s.positions,
    valid_from: s.valid_from,
    valid_to: s.valid_to,
    is_active: s.is_active,
    note: s.note,
    rules: s.rules.map((r) => ({ key: newKey(), code: r.code, name: r.name, kind: r.kind, item_id: r.item_id, params: r.params }))
  };
}

export function toBody(d: SchemeDraft) {
  return {
    name: d.name,
    roles: d.roles,
    branches: d.branches,
    trade_direction_ids: d.trade_direction_ids,
    positions: d.positions,
    valid_from: d.valid_from,
    valid_to: d.valid_to,
    is_active: d.is_active,
    note: d.note,
    rules: d.rules.map((r) => ({ code: r.code, name: r.name, kind: r.kind, item_id: r.item_id, params: r.params }))
  };
}
