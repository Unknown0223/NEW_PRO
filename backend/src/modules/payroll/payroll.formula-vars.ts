import { normalizeVarName } from "./payroll.formula-engine";
import { ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";
import { partVarName } from "./payroll.item-amounts.pure";

export type PayrollCalcInputs = {
  base_full: number;
  base_salary: number;
  plan_days: number;
  worked_days: number;
  vacation_days: number;
  sick_days: number;
  trip_days: number;
  absent_days: number;
  half_days: number;
  fact_total: KpiMetrics;
  fact_by_group: Map<number, KpiMetrics>;
  returned_sum: number;
  plan_total: KpiMetrics;
  plan_by_group: Map<number, KpiMetrics>;
  expeditor: { delivered_count: number; delivered_sum: number; delivered_volume: number; clients: number };
  team_total: KpiMetrics | null;
  team_by_group: Map<number, KpiMetrics> | null;
  /** Supervayzer: jamoa agentlari rejalari yig'indisi. */
  team_plan_total?: KpiMetrics | null;
  team_plan_by_group?: Map<number, KpiMetrics> | null;
  advances_paid: number;
  /** Базовые оклады: xodimning надбавка qismlari (item_id → summa). */
  item_parts?: Map<number, number>;
};

const METRIC_LABELS: Array<[keyof KpiMetrics, string]> = [
  ["count", "Количество"],
  ["cost", "Сумма"],
  ["volume", "Объем"],
  ["acb", "АКБ"],
  ["order_count", "Количество заказа"]
];

export const VAR_BASE = "Базовый оклад";
export const VAR_BASE_WORKED = "Оклад за отработанное время";
export const VAR_PLAN_DAYS = "Кол-во рабочих дней текущего месяца";
export const VAR_WORKED_DAYS = "Всего отработанных дней";
/** Formula yoziladigan statyaning xodimdagi summasi («Базовые оклады» matritsasi). */
export const VAR_ITEM_AMOUNT = "Оклад статьи";

export function staticVariableGroups(): Array<{ group: string; items: string[] }> {
  return [
    { group: "Оклад", items: [VAR_BASE, VAR_BASE_WORKED, VAR_ITEM_AMOUNT] },
    {
      group: "Рабочие дни",
      items: [
        VAR_WORKED_DAYS,
        VAR_PLAN_DAYS,
        "Рабочие дни (план)",
        "Рабочие дни (факт)",
        "Отпуск",
        "Больничный",
        "Командировка",
        "Прогул",
        "Полдня"
      ]
    },
    { group: "KPI — План", items: METRIC_LABELS.map(([, l]) => `KPI - ${l} (План)`) },
    {
      group: "KPI — Факт",
      items: [
        ...METRIC_LABELS.map(([, l]) => `KPI - ${l} (Факт)`),
        "KPI - АКБ (Факт, все группы)",
        "KPI - Заказ (Сумма)",
        "KPI - Возврат (Сумма)",
        "KPI - Выполнение (%)"
      ]
    },
    {
      group: "Экспедитор",
      items: ["Экспедитор - Доставлено заказов", "Экспедитор - Сумма доставки", "Экспедитор - Объем доставки", "Экспедитор - Клиенты"]
    },
    {
      group: "Команда",
      items: [
        ...METRIC_LABELS.map(([, l]) => `Команда - ${l} (Факт)`),
        ...METRIC_LABELS.map(([, l]) => `Команда - ${l} (План)`),
        "Команда - Выполнение (%)"
      ]
    },
    { group: "Итоги", items: ["Надбавки (итого)", "Удержания (итого)", "Аванс"] }
  ];
}

export function knownVariableSet(itemNames: string[]): Set<string> {
  const s = new Set<string>();
  for (const g of staticVariableGroups()) g.items.forEach((i) => s.add(normalizeVarName(i)));
  itemNames.forEach((n) => {
    s.add(normalizeVarName(n));
    s.add(normalizeVarName(partVarName(n)));
  });
  return s;
}

const pct = (fact: number, plan: number) => (plan > 0 ? (fact / plan) * 100 : 0);

/**
 * Formula o'zgaruvchilari. `kpiGroupId` berilsa — KPI qiymatlari shu guruh bo'yicha,
 * aks holda barcha guruhlar jami (АКБ — umumiy mijozlar soni).
 */
export function buildFormulaVars(
  inp: PayrollCalcInputs,
  kpiGroupId: number | null,
  itemValues: Map<string, number>,
  totals: { allowances: number; deductions: number },
  items?: Map<number, { name: string }>,
  targetItemId: number | null = null
): Map<string, number> {
  const m = new Map<string, number>();
  const set = (k: string, v: number) => m.set(normalizeVarName(k), Number.isFinite(v) ? v : 0);

  set(VAR_BASE, inp.base_full);
  set(VAR_BASE_WORKED, inp.base_salary);
  set(VAR_ITEM_AMOUNT, targetItemId != null ? inp.item_parts?.get(targetItemId) ?? 0 : 0);
  set(VAR_WORKED_DAYS, inp.worked_days);
  set(VAR_PLAN_DAYS, inp.plan_days);
  set("Рабочие дни (план)", inp.plan_days);
  set("Рабочие дни (факт)", inp.worked_days);
  set("Отпуск", inp.vacation_days);
  set("Больничный", inp.sick_days);
  set("Командировка", inp.trip_days);
  set("Прогул", inp.absent_days);
  set("Полдня", inp.half_days);

  const fact = kpiGroupId ? inp.fact_by_group.get(kpiGroupId) ?? ZERO_METRICS : inp.fact_total;
  const plan = kpiGroupId ? inp.plan_by_group.get(kpiGroupId) ?? ZERO_METRICS : inp.plan_total;
  for (const [key, label] of METRIC_LABELS) {
    set(`KPI - ${label} (План)`, plan[key]);
    set(`KPI - ${label} (Факт)`, fact[key]);
  }
  set("KPI - АКБ (Факт, все группы)", inp.fact_total.acb);
  set("KPI - Возврат (Сумма)", inp.returned_sum);
  set("KPI - Заказ (Сумма)", inp.fact_total.cost + inp.returned_sum);
  set("KPI - Выполнение (%)", pct(fact.cost, plan.cost));

  set("Экспедитор - Доставлено заказов", inp.expeditor.delivered_count);
  set("Экспедитор - Сумма доставки", inp.expeditor.delivered_sum);
  set("Экспедитор - Объем доставки", inp.expeditor.delivered_volume);
  set("Экспедитор - Клиенты", inp.expeditor.clients);

  const team = kpiGroupId ? inp.team_by_group?.get(kpiGroupId) ?? ZERO_METRICS : inp.team_total ?? ZERO_METRICS;
  const hasTeamPlan = (inp.team_plan_total?.cost ?? 0) > 0;
  const teamPlan = !hasTeamPlan
    ? plan
    : kpiGroupId
      ? inp.team_plan_by_group?.get(kpiGroupId) ?? ZERO_METRICS
      : inp.team_plan_total!;
  for (const [key, label] of METRIC_LABELS) {
    set(`Команда - ${label} (Факт)`, team[key]);
    set(`Команда - ${label} (План)`, teamPlan[key]);
  }
  set("Команда - Выполнение (%)", pct(team.cost, teamPlan.cost));

  set("Надбавки (итого)", totals.allowances);
  set("Удержания (итого)", totals.deductions);
  set("Аванс", inp.advances_paid);
  for (const [name, v] of itemValues) set(name, v);
  if (items) {
    for (const [id, it] of items) set(partVarName(it.name), inp.item_parts?.get(id) ?? 0);
  }
  return m;
}
