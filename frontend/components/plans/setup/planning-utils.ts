import type { PlanningEmployee } from "./planning-api";

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("ru-RU").format(num);
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "director":
      return "Директор";
    case "sales_director":
      return "Директор по продажам";
    case "commercial_director":
      return "Коммерческий директор";
    case "manager":
      return "Менеджер";
    case "regional_manager":
      return "Региональный менеджер";
    case "supervisor":
      return "Супервайзер";
    case "agent":
      return "Агент";
    case "admin":
      return "Администратор";
    case "operator":
      return "Оператор";
    default:
      return role;
  }
}

export const PLANNING_MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

export const ROLE_SORT_PRIORITY: Record<string, number> = {
  director: 0,
  sales_director: 1,
  commercial_director: 2,
  manager: 3,
  regional_manager: 3,
  admin: 3,
  operator: 3,
  supervisor: 4,
  agent: 5
};

export function sortEmployeesByRole(a: PlanningEmployee, b: PlanningEmployee): number {
  const pa = ROLE_SORT_PRIORITY[a.role] ?? 99;
  const pb = ROLE_SORT_PRIORITY[b.role] ?? 99;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name, "ru");
}

/** Reja kiritish — daraxtdagi barcha xodimlar (agentlar ham). */
export function canRoleSetPlan(role: string): boolean {
  const r = role.trim();
  return (
    r === "supervisor" ||
    r === "manager" ||
    r === "director" ||
    r === "sales_director" ||
    r === "commercial_director" ||
    r === "admin" ||
    r === "operator" ||
    r === "regional_manager" ||
    r === "agent"
  );
}

/** Jadvaldagi rol ustuni — tizim roli + «Степень N» (agar zanjirda bo‘lsa). */
export function getPlanningRoleLabel(emp: PlanningEmployee): string {
  const base = getRoleLabel(emp.role);
  if (emp.chain_level != null && emp.chain_level > 0) {
    return `${base} · Степень ${emp.chain_level}`;
  }
  return base;
}

/** Reja kiritish: zanjir bosqichlari (Степень) ham SVR kabi. */
export function canEmployeeSetPlan(emp: PlanningEmployee): boolean {
  if (emp.chain_level != null && emp.chain_level > 0) return true;
  return canRoleSetPlan(emp.role);
}

/** Qidiruv: mos kelgan xodim + uning barcha ota-zanjirlari saqlanadi (daraxt buzilmasin). */
export function filterEmployeesWithAncestors(
  employees: PlanningEmployee[],
  query: string
): PlanningEmployee[] {
  const q = query.trim().toLowerCase();
  if (!q) return employees;

  const byId = new Map(employees.map((e) => [e.id, e]));
  const keep = new Set<number>();

  for (const e of employees) {
    if (!e.name.toLowerCase().includes(q)) continue;
    keep.add(e.id);
    let pid = e.parent_id;
    while (pid != null) {
      keep.add(pid);
      pid = byId.get(pid)?.parent_id ?? null;
    }
  }

  return employees.filter((e) => keep.has(e.id));
}

/** Metrika nomi uchun minimal ustun kengligi (px). */
export const METRIC_LABEL_MIN_WIDTH: Record<string, number> = {
  Сумма: 76,
  Количество: 92,
  Объем: 76,
  АКБ: 68,
  "Кол-во-заказов": 108
};

const METRIC_FIELD_BY_LABEL: Record<string, string> = {
  Сумма: "cost",
  Количество: "count",
  Объем: "volume",
  АКБ: "acb",
  "Кол-во-заказов": "order_count"
};

/** Matn uzunligidan taxminiy kenglik (11px shrift). */
export function estimateTextWidthPx(text: string, pxPerChar = 6.8): number {
  return Math.ceil(text.length * pxPerChar);
}

/** KPI ustuni: sarlavha va katak qiymatlaridan kenglik hisoblash. */
export function computeMetricColumnWidths(input: {
  groups: Array<{ id: number; metrics: string[] }>;
  employees: PlanningEmployee[];
  kpiTargets: Array<{
    id: number;
    plan_id: number;
    user_id: number;
    cost: string;
    count: string;
    volume: string;
    acb: string;
    order_count: number;
  }>;
  plans: Array<{ id: number; kpi_group_id: number }>;
  localValues: Record<string, string>;
}): Record<string, number> {
  const { groups, employees, kpiTargets, plans, localValues } = input;
  const widths: Record<string, number> = {};
  const planByGroup = new Map(plans.map((p) => [p.kpi_group_id, p.id]));

  for (const group of groups) {
    const planId = planByGroup.get(group.id);
    for (const metric of group.metrics) {
      const field = METRIC_FIELD_BY_LABEL[metric] as keyof (typeof kpiTargets)[0] | undefined;
      const colKey = `${group.id}:${metric}`;
      let w = METRIC_LABEL_MIN_WIDTH[metric] ?? estimateTextWidthPx(metric) + 16;

      if (planId != null && field) {
        for (const emp of employees) {
          const target = kpiTargets.find((t) => t.plan_id === planId && t.user_id === emp.id);
          if (!target) continue;
          const override = localValues[`${target.id}:${field}`];
          const raw =
            override !== undefined
              ? override
              : typeof target[field] === "number"
                ? String(target[field])
                : String(target[field] ?? "0");
          const num = Number.parseFloat(String(raw).replace(/\s/g, "").replace(/,/g, "."));
          if (Number.isFinite(num) && num !== 0) {
            const display = formatNumber(raw);
            w = Math.max(w, estimateTextWidthPx(display) + 30);
          }
        }
      }

      widths[colKey] = Math.min(Math.max(w, 72), 176);
    }
  }

  return widths;
}

/** @deprecated — computeMetricColumnWidths ishlatiladi */
export const METRIC_COL_WIDTH = 76;
