import type { KpiMetrics } from "./payroll-kpi-fact.pure";
import type { PayrollCalcInputs } from "./payroll.formula-vars";
import type {
  Cond,
  CondField,
  EmployeeAttrs,
  Explain,
  ExplainPart,
  KpiParams,
  Metric,
  RateMetric,
  ScalePoint,
  SchemeRule
} from "./payroll.scheme.types";

const r2 = (x: number) => Math.round(x * 100) / 100;
const pctOf = (fact: number, plan: number) => (plan > 0 ? r2((fact / plan) * 100) : 0);
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/\u00a0/g, " ");

export const METRIC_RU: Record<Metric, string> = {
  cost: "Сумма",
  count: "Количество",
  volume: "Объём",
  acb: "АКБ",
  order_count: "Заказы"
};

export type SchemeEnv = {
  inputs: PayrollCalcInputs;
  attrs: EmployeeAttrs;
  overrides: Map<string, number>;
  groupNames: Map<number, string>;
};

/** Shart maydonining qiymati (son yoki matn). */
export function condValue(field: CondField, env: SchemeEnv): number | string | null {
  const i = env.inputs;
  switch (field) {
    case "branch":
      return env.attrs.branch;
    case "trade_direction":
      return env.attrs.trade_direction_id;
    case "position":
      return env.attrs.position;
    case "tenure_months":
      return env.attrs.tenure_months;
    case "worked_days":
      return i.worked_days;
    case "worked_pct":
      return pctOf(Math.min(i.worked_days, i.plan_days), i.plan_days);
    case "kpi_pct":
      return pctOf(i.fact_total.cost, i.plan_total.cost);
    case "acb_pct":
      return pctOf(i.fact_total.acb, i.plan_total.acb);
    case "return_pct":
      return pctOf(i.returned_sum, i.fact_total.cost + i.returned_sum);
    case "team_kpi_pct":
      return pctOf(i.team_total?.cost ?? 0, i.team_plan_total?.cost ?? 0);
  }
}

export function condPasses(c: Cond, env: SchemeEnv): boolean {
  const v = condValue(c.field, env);
  if (c.op === "in" || c.op === "not_in") {
    const list = Array.isArray(c.value) ? c.value.map(String) : [String(c.value)];
    const hit = v != null && list.includes(String(v));
    return c.op === "in" ? hit : !hit;
  }
  if (v == null || typeof v !== "number") return false;
  const t = Array.isArray(c.value) ? Number(c.value[0]) : c.value;
  switch (c.op) {
    case ">=": return v >= t;
    case ">": return v > t;
    case "<=": return v <= t;
    case "<": return v < t;
    case "=": return Math.abs(v - t) < 1e-9;
  }
}

export const allPass = (conds: Cond[], env: SchemeEnv) => conds.every((c) => condPasses(c, env));

/** Summa manbai: xodim farqi → birinchi mos variant → asosiy. */
function pickAmount(rule: SchemeRule, base: number, cases: Array<{ when: Cond[]; amount: number }>, env: SchemeEnv) {
  const ov = env.overrides.get(rule.code);
  if (ov != null) return { amount: ov, note: "индивидуально" };
  const hit = cases.find((c) => allPass(c.when, env));
  if (hit) return { amount: hit.amount, note: "по условию" };
  return { amount: base, note: null as string | null };
}

/** Bajarish % → to'lov %: birinchi nuqtadan past — 0, oraliq — chiziqli, oxirgisidan keyin — oxirgi qiymat. */
export function scalePay(points: ScalePoint[], pct: number): number {
  const p = [...points].sort((a, b) => a.at - b.at);
  if (!p.length || pct < p[0]!.at) return 0;
  for (let k = 0; k < p.length - 1; k++) {
    const a = p[k]!;
    const b = p[k + 1]!;
    if (pct <= b.at) return b.at === a.at ? b.pay : a.pay + ((b.pay - a.pay) * (pct - a.at)) / (b.at - a.at);
  }
  return p[p.length - 1]!.pay;
}

export function prorateFactor(i: PayrollCalcInputs): number {
  return i.plan_days > 0 ? Math.min(i.worked_days, i.plan_days) / i.plan_days : 0;
}

export type BaseOutcome = { base_full: number; base_salary: number; explain: Explain };

export function evaluateBase(rule: Extract<SchemeRule, { kind: "base" }>, env: SchemeEnv): BaseOutcome {
  const { amount, note } = pickAmount(rule, rule.params.amount, rule.params.cases, env);
  if (!allPass(rule.params.when, env)) return { base_full: 0, base_salary: 0, explain: { text: "Условие не выполнено" } };
  const i = env.inputs;
  const salary = rule.params.prorate ? r2(amount * prorateFactor(i)) : r2(amount);
  const text = rule.params.prorate ? `${fmt(amount)} × ${Math.min(i.worked_days, i.plan_days)} / ${i.plan_days} дн.` : fmt(amount);
  return { base_full: amount, base_salary: salary, explain: { text, notes: note ? [note] : undefined } };
}

function metricsFor(src: "own" | "team", env: SchemeEnv) {
  const i = env.inputs;
  return src === "team"
    ? { planTotal: i.team_plan_total ?? null, factTotal: i.team_total, planBy: i.team_plan_by_group ?? null, factBy: i.team_by_group }
    : { planTotal: i.plan_total, factTotal: i.fact_total, planBy: i.plan_by_group, factBy: i.fact_by_group };
}

const mv = (m: KpiMetrics | null | undefined, metric: Metric) => (m ? Number(m[metric]) || 0 : 0);

/** KPI fondi: bo'laklar (vazn) × guruhlar (ulush) × shkala; keyin darvozalar. */
export function evaluateKpi(rule: { code: string; params: KpiParams } & Pick<SchemeRule, "name">, env: SchemeEnv) {
  const p = rule.params;
  const { amount: fund, note } = pickAmount(rule as SchemeRule, p.fund, p.cases, env);
  const warnings: string[] = [];
  const parts: ExplainPart[] = [];
  if (!allPass(p.when, env)) return { amount: 0, explain: { text: "Условие не выполнено" } as Explain, warnings };
  let total = 0;
  for (const part of p.parts) {
    const partFund = (fund * part.weight) / 100;
    const m = metricsFor(part.source, env);
    const src = part.source === "team" ? "Команда · " : "";
    if (part.mode === "total") {
      const plan = mv(m.planTotal, part.metric);
      const fact = mv(m.factTotal, part.metric);
      if (plan <= 0) warnings.push(`${rule.code}:no_plan`);
      const pct = pctOf(fact, plan);
      const pay = scalePay(p.scale, pct);
      const amount = r2((partFund * pay) / 100);
      total += amount;
      parts.push({ label: part.label || `${src}${METRIC_RU[part.metric]} (общий план)`, plan, fact, pct, pay_pct: r2(pay), share: part.weight, amount });
      continue;
    }
    const planBy = m.planBy ?? new Map<number, KpiMetrics>();
    const candidates = part.groups.length ? part.groups : [...planBy.keys()];
    const groups = candidates.filter((g) => mv(planBy.get(g), part.metric) > 0);
    if (!groups.length) {
      warnings.push(`${rule.code}:no_plan`);
      continue;
    }
    const weightOf = (g: number) =>
      part.split === "equal" ? 1 : part.split === "weights" ? Number(part.group_weights[String(g)] ?? 0) : mv(planBy.get(g), part.metric);
    const wSum = groups.reduce((s, g) => s + weightOf(g), 0);
    for (const g of groups) {
      const share = wSum > 0 ? weightOf(g) / wSum : 0;
      const plan = mv(planBy.get(g), part.metric);
      const fact = mv(m.factBy?.get(g), part.metric);
      const pct = pctOf(fact, plan);
      const pay = scalePay(p.scale, pct);
      const amount = r2((partFund * share * pay) / 100);
      total += amount;
      parts.push({
        label: `${src}${env.groupNames.get(g) ?? `Группа ${g}`} · ${METRIC_RU[part.metric]}`,
        plan,
        fact,
        pct,
        pay_pct: r2(pay),
        share: r2(part.weight * share),
        amount
      });
    }
  }
  const notes: string[] = note ? [note] : [];
  for (const gt of p.gates) {
    if (!allPass(gt.when, env)) continue;
    if (gt.factor != null) {
      total *= gt.factor;
      notes.push(`× ${gt.factor} по условию`);
    }
    if (gt.min_pay != null && total < (fund * gt.min_pay) / 100) {
      total = (fund * gt.min_pay) / 100;
      notes.push(`гарантия ${gt.min_pay}% фонда`);
    }
  }
  return { amount: r2(total), explain: { text: `Фонд ${fmt(fund)}`, parts, notes: notes.length ? notes : undefined } as Explain, warnings };
}

export function rateMetricValue(metric: RateMetric, i: PayrollCalcInputs): number {
  switch (metric) {
    case "exp_orders": return i.expeditor.delivered_count;
    case "exp_sum": return i.expeditor.delivered_sum;
    case "exp_volume": return i.expeditor.delivered_volume;
    case "exp_clients": return i.expeditor.clients;
    case "sales_sum": return i.fact_total.cost;
    case "sales_count": return i.fact_total.count;
    case "sales_volume": return i.fact_total.volume;
    case "acb": return i.fact_total.acb;
    case "orders": return i.fact_total.order_count;
    case "worked_days": return i.worked_days;
  }
}

export const RATE_METRIC_RU: Record<RateMetric, string> = {
  exp_orders: "доставлено заказов",
  exp_sum: "сумма доставки",
  exp_volume: "объём доставки",
  exp_clients: "клиентов доставки",
  sales_sum: "сумма продаж",
  sales_count: "кол-во продаж",
  sales_volume: "объём продаж",
  acb: "АКБ",
  orders: "заказов",
  worked_days: "отработанных дней"
};

export type RuleOutcome = { amount: number; explain: Explain; warnings: string[] };

/** formula turidan tashqari qoidalar (formula — `computePayroll` ichida, joriy jamilar bilan). */
export function evaluateSimpleRule(rule: SchemeRule, env: SchemeEnv): RuleOutcome | null {
  const i = env.inputs;
  if (rule.kind === "fixed") {
    const { amount, note } = pickAmount(rule, rule.params.amount, rule.params.cases, env);
    if (!allPass(rule.params.when, env)) return { amount: 0, explain: { text: "Условие не выполнено" }, warnings: [] };
    const k = rule.params.prorate ? prorateFactor(i) : 1;
    const text = rule.params.prorate ? `${fmt(amount)} × ${Math.min(i.worked_days, i.plan_days)} / ${i.plan_days} дн.` : fmt(amount);
    return { amount: r2(amount * k), explain: { text, notes: note ? [note] : undefined }, warnings: [] };
  }
  if (rule.kind === "rate") {
    const { amount: rate, note } = pickAmount(rule, rule.params.rate, rule.params.cases, env);
    if (!allPass(rule.params.when, env)) return { amount: 0, explain: { text: "Условие не выполнено" }, warnings: [] };
    const qty = rateMetricValue(rule.params.metric, i);
    const amount = rule.params.percent ? r2((qty * rate) / 100) : r2(qty * rate);
    const text = rule.params.percent
      ? `${rate}% × ${fmt(qty)} (${RATE_METRIC_RU[rule.params.metric]})`
      : `${fmt(rate)} × ${fmt(qty)} (${RATE_METRIC_RU[rule.params.metric]})`;
    return { amount, explain: { text, notes: note ? [note] : undefined }, warnings: [] };
  }
  if (rule.kind === "kpi") return evaluateKpi(rule, env);
  return null;
}

/** Formula qoidasi uchun «Оклад статьи»: xodim farqi yoki qoida summasi. */
export function formulaItemAmount(rule: Extract<SchemeRule, { kind: "formula" }>, env: SchemeEnv): number {
  return env.overrides.get(rule.code) ?? rule.params.amount;
}

/** Oy oxiriga staj (to'liq oylar). */
export function tenureMonths(hiredAt: Date | null, year: number, month: number): number | null {
  if (!hiredAt) return null;
  const months = (year - hiredAt.getUTCFullYear()) * 12 + (month - (hiredAt.getUTCMonth() + 1));
  return Math.max(0, months);
}
