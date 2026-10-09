import type { DailyKpiAgentSummary } from "./daily-kpi-api";

export type DailyKpiViewMode = "agents" | "supervisors" | "branches";

export const DAILY_KPI_NO_BRANCH = "Без филиала";
export const DAILY_KPI_NO_SUPERVISOR = "Без супервайзера";

export type DailyKpiMonthFilters = {
  search: string;
  branch: string;
  supervisor: string;
  status: string;
};

export const EMPTY_DAILY_KPI_FILTERS: DailyKpiMonthFilters = {
  search: "",
  branch: "",
  supervisor: "",
  status: ""
};

export type DailyKpiMonthRow = {
  key: string;
  kind: DailyKpiViewMode;
  agent_id: number | null;
  name: string;
  code: string | null;
  branch: string;
  supervisor: string;
  agents_count: number;
  today_plan_sum: number;
  today_fact_sum: number;
  today_execution_pct: number | null;
  today_remaining_sum: number;
  month_plan_sum: number;
  month_fact_sum: number;
  month_execution_pct: number | null;
  working_days_total: number;
  remaining_working_days: number;
  carry_forward_sum: number;
  status: string;
};

export type DailyKpiSortKey =
  | "name"
  | "code"
  | "branch"
  | "supervisor"
  | "agents_count"
  | "today_plan_sum"
  | "today_fact_sum"
  | "today_execution_pct"
  | "today_remaining_sum"
  | "month_plan_sum"
  | "month_fact_sum"
  | "month_execution_pct"
  | "working_days_total"
  | "remaining_working_days"
  | "carry_forward_sum"
  | "status";

export type DailyKpiSort = { key: DailyKpiSortKey; dir: "asc" | "desc" };

export type DailyKpiMonthTotals = {
  agents: number;
  agents_with_plans: number;
  month_plan_sum: number;
  month_fact_sum: number;
  month_execution_pct: number | null;
  today_plan_sum: number;
  today_fact_sum: number;
  today_execution_pct: number | null;
  today_remaining_sum: number;
  carry_forward_sum: number;
  done: number;
  warn: number;
  pending: number;
  over: number;
  off: number;
  no_plan: number;
};

/** Backend `executionPctFromPlanFact` bilan bir xil (0…100, 2 xona). */
export function executionPct(plan: number, fact: number): number | null {
  if (!Number.isFinite(plan) || plan <= 0 || !Number.isFinite(fact)) return null;
  return Math.min(100, Math.max(0, Math.round((fact / plan) * 10000) / 100));
}

export function agentBranch(a: DailyKpiAgentSummary): string {
  return a.branch?.trim() || DAILY_KPI_NO_BRANCH;
}

export function agentSupervisor(a: DailyKpiAgentSummary): string {
  return a.supervisor_name?.trim() || DAILY_KPI_NO_SUPERVISOR;
}

const STATUS_ORDER = ["over", "done", "warn", "pending", "off", "no_plan"];

function uniqSorted(values: string[], emptyLabel: string): string[] {
  const set = new Set(values);
  const named = [...set].filter((v) => v !== emptyLabel).sort((a, b) => a.localeCompare(b, "ru"));
  return set.has(emptyLabel) ? [...named, emptyLabel] : named;
}

export function dailyKpiFilterOptions(agents: DailyKpiAgentSummary[]) {
  return {
    branches: uniqSorted(agents.map(agentBranch), DAILY_KPI_NO_BRANCH),
    supervisors: uniqSorted(agents.map(agentSupervisor), DAILY_KPI_NO_SUPERVISOR),
    statuses: STATUS_ORDER.filter((s) => agents.some((a) => a.status === s))
  };
}

export function filterDailyKpiAgents(
  agents: DailyKpiAgentSummary[],
  f: DailyKpiMonthFilters
): DailyKpiAgentSummary[] {
  const q = f.search.trim().toLowerCase();
  return agents.filter((a) => {
    if (f.branch && agentBranch(a) !== f.branch) return false;
    if (f.supervisor && agentSupervisor(a) !== f.supervisor) return false;
    if (f.status && a.status !== f.status) return false;
    if (q) {
      const hay = `${a.name} ${a.code ?? ""} ${agentBranch(a)} ${agentSupervisor(a)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function agentRow(a: DailyKpiAgentSummary): DailyKpiMonthRow {
  return {
    key: `a:${a.agent_id}`,
    kind: "agents",
    agent_id: a.agent_id,
    name: a.name,
    code: a.code,
    branch: agentBranch(a),
    supervisor: agentSupervisor(a),
    agents_count: 1,
    today_plan_sum: a.today_plan_sum,
    today_fact_sum: a.today_fact_sum,
    today_execution_pct: a.today_execution_pct,
    today_remaining_sum: a.today_remaining_sum,
    month_plan_sum: a.month_plan_sum,
    month_fact_sum: a.month_fact_sum,
    month_execution_pct: a.month_execution_pct,
    working_days_total: a.working_days_total,
    remaining_working_days: a.remaining_working_days,
    carry_forward_sum: a.carry_forward_sum,
    status: a.status
  };
}

/** Guruh statusi — backend `statusFromDay` mantiqi, a’zolar yig‘indisi bo‘yicha. */
export function aggregateStatus(members: DailyKpiAgentSummary[]): string {
  const monthPlan = members.reduce((s, a) => s + a.month_plan_sum, 0);
  if (monthPlan <= 0) return "no_plan";
  const planned = members.filter((a) => a.has_plans);
  if (planned.length > 0 && planned.every((a) => a.status === "off")) return "off";
  const plan = members.reduce((s, a) => s + a.today_plan_sum, 0);
  const fact = members.reduce((s, a) => s + a.today_fact_sum, 0);
  if (plan <= 0 && fact <= 0) return "pending";
  if (fact > plan && plan > 0) return "over";
  const pct = executionPct(plan, fact);
  if (pct != null && pct >= 100) return "done";
  if (fact > 0) return "warn";
  return "pending";
}

function groupRow(
  kind: DailyKpiViewMode,
  label: string,
  members: DailyKpiAgentSummary[]
): DailyKpiMonthRow {
  const sum = (pick: (a: DailyKpiAgentSummary) => number) => members.reduce((s, a) => s + pick(a), 0);
  const todayPlan = sum((a) => a.today_plan_sum);
  const todayFact = sum((a) => a.today_fact_sum);
  const monthPlan = sum((a) => a.month_plan_sum);
  const monthFact = sum((a) => a.month_fact_sum);
  const branches = uniqSorted(members.map(agentBranch), DAILY_KPI_NO_BRANCH);
  return {
    key: `${kind}:${label}`,
    kind,
    agent_id: null,
    name: label,
    code: null,
    branch: kind === "branches" ? label : branches.join(", "),
    supervisor: kind === "supervisors" ? label : "",
    agents_count: members.length,
    today_plan_sum: todayPlan,
    today_fact_sum: todayFact,
    today_execution_pct: executionPct(todayPlan, todayFact),
    today_remaining_sum: sum((a) => a.today_remaining_sum),
    month_plan_sum: monthPlan,
    month_fact_sum: monthFact,
    month_execution_pct: executionPct(monthPlan, monthFact),
    working_days_total: Math.max(0, ...members.map((a) => a.working_days_total)),
    remaining_working_days: Math.max(0, ...members.map((a) => a.remaining_working_days)),
    carry_forward_sum: sum((a) => a.carry_forward_sum),
    status: aggregateStatus(members)
  };
}

export function buildDailyKpiRows(
  agents: DailyKpiAgentSummary[],
  mode: DailyKpiViewMode
): DailyKpiMonthRow[] {
  if (mode === "agents") return agents.map(agentRow);
  const pick = mode === "branches" ? agentBranch : agentSupervisor;
  const groups = new Map<string, DailyKpiAgentSummary[]>();
  for (const a of agents) {
    const k = pick(a);
    const list = groups.get(k);
    if (list) list.push(a);
    else groups.set(k, [a]);
  }
  return [...groups.entries()].map(([label, members]) => groupRow(mode, label, members));
}

function sortValue(r: DailyKpiMonthRow, key: DailyKpiSortKey): string | number | null {
  switch (key) {
    case "name":
    case "branch":
    case "supervisor":
      return r[key];
    case "code":
      return r.code ?? "";
    case "status":
      return STATUS_ORDER.indexOf(r.status);
    default:
      return r[key];
  }
}

export function sortDailyKpiRows(rows: DailyKpiMonthRow[], sort: DailyKpiSort): DailyKpiMonthRow[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    // Bo‘sh qiymatlar (— / null) har doim oxirida.
    if (va == null && vb != null) return 1;
    if (vb == null && va != null) return -1;
    let cmp = 0;
    if (typeof va === "string" && typeof vb === "string") cmp = va.localeCompare(vb, "ru");
    else if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
    if (cmp !== 0) return cmp * dir;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function dailyKpiTotals(agents: DailyKpiAgentSummary[]): DailyKpiMonthTotals {
  const sum = (pick: (a: DailyKpiAgentSummary) => number) => agents.reduce((s, a) => s + pick(a), 0);
  const count = (st: string) => agents.filter((a) => a.status === st).length;
  const monthPlan = sum((a) => a.month_plan_sum);
  const monthFact = sum((a) => a.month_fact_sum);
  const todayPlan = sum((a) => a.today_plan_sum);
  const todayFact = sum((a) => a.today_fact_sum);
  return {
    agents: agents.length,
    agents_with_plans: agents.filter((a) => a.has_plans).length,
    month_plan_sum: monthPlan,
    month_fact_sum: monthFact,
    month_execution_pct: executionPct(monthPlan, monthFact),
    today_plan_sum: todayPlan,
    today_fact_sum: todayFact,
    today_execution_pct: executionPct(todayPlan, todayFact),
    today_remaining_sum: sum((a) => a.today_remaining_sum),
    carry_forward_sum: sum((a) => a.carry_forward_sum),
    done: count("done"),
    warn: count("warn"),
    pending: count("pending"),
    over: count("over"),
    off: count("off"),
    no_plan: count("no_plan")
  };
}
