import { describe, expect, it } from "vitest";
import type { DailyKpiAgentSummary } from "../components/plans/daily-kpi/daily-kpi-api";
import {
  aggregateStatus,
  buildDailyKpiRows,
  dailyKpiFilterOptions,
  dailyKpiTotals,
  DAILY_KPI_NO_BRANCH,
  DAILY_KPI_NO_SUPERVISOR,
  EMPTY_DAILY_KPI_FILTERS,
  executionPct,
  filterDailyKpiAgents,
  sortDailyKpiRows
} from "../components/plans/daily-kpi/daily-kpi-month-view";

function agent(p: Partial<DailyKpiAgentSummary> & { agent_id: number; name: string }): DailyKpiAgentSummary {
  return {
    code: null,
    branch: null,
    supervisor_id: null,
    supervisor_name: null,
    trade_direction_id: 1,
    trade_direction_name: "Retail",
    month_plan_sum: 0,
    month_fact_sum: 0,
    month_execution_pct: null,
    today_plan_sum: 0,
    today_fact_sum: 0,
    today_execution_pct: null,
    today_remaining_sum: 0,
    working_days_total: 26,
    remaining_working_days: 3,
    carry_forward_sum: 0,
    surplus_sum: 0,
    status: "pending",
    has_plans: false,
    ...p
  };
}

const AGENTS: DailyKpiAgentSummary[] = [
  agent({
    agent_id: 1,
    name: "Бахром",
    code: "PM01",
    branch: "Самарканд",
    supervisor_name: "Алиев",
    month_plan_sum: 1000,
    month_fact_sum: 500,
    month_execution_pct: 50,
    today_plan_sum: 100,
    today_fact_sum: 150,
    status: "over",
    has_plans: true
  }),
  agent({
    agent_id: 2,
    name: "Азиза",
    code: "PM02",
    branch: "Самарканд",
    supervisor_name: "Каримов",
    month_plan_sum: 2000,
    month_fact_sum: 400,
    month_execution_pct: 20,
    today_plan_sum: 200,
    today_fact_sum: 50,
    today_remaining_sum: 150,
    status: "warn",
    has_plans: true
  }),
  agent({
    agent_id: 3,
    name: "Виктор",
    code: "PM03",
    branch: "Ташкент",
    supervisor_name: "Алиев",
    month_plan_sum: 3000,
    month_fact_sum: 3000,
    month_execution_pct: 100,
    status: "off",
    has_plans: true
  }),
  agent({ agent_id: 4, name: "Гулнора", code: "PM04", status: "no_plan" })
];

describe("daily KPI month view", () => {
  it("executionPct matches backend (capped 0..100, null without plan)", () => {
    expect(executionPct(0, 10)).toBeNull();
    expect(executionPct(200, 50)).toBe(25);
    expect(executionPct(100, 150)).toBe(100);
  });

  it("filters by branch, supervisor, status and search (incl. empty buckets)", () => {
    const f = EMPTY_DAILY_KPI_FILTERS;
    expect(filterDailyKpiAgents(AGENTS, { ...f, branch: "Самарканд" }).map((a) => a.agent_id)).toEqual([1, 2]);
    expect(filterDailyKpiAgents(AGENTS, { ...f, supervisor: "Алиев" }).map((a) => a.agent_id)).toEqual([1, 3]);
    expect(filterDailyKpiAgents(AGENTS, { ...f, branch: DAILY_KPI_NO_BRANCH }).map((a) => a.agent_id)).toEqual([4]);
    expect(filterDailyKpiAgents(AGENTS, { ...f, status: "off" }).map((a) => a.agent_id)).toEqual([3]);
    expect(filterDailyKpiAgents(AGENTS, { ...f, search: "pm02" }).map((a) => a.agent_id)).toEqual([2]);
  });

  it("filter options are sorted with empty bucket last", () => {
    const o = dailyKpiFilterOptions(AGENTS);
    expect(o.branches).toEqual(["Самарканд", "Ташкент", DAILY_KPI_NO_BRANCH]);
    expect(o.supervisors).toEqual(["Алиев", "Каримов", DAILY_KPI_NO_SUPERVISOR]);
    expect(o.statuses).toEqual(["over", "warn", "off", "no_plan"]);
  });

  it("totals equal the sum of visible agents", () => {
    const t = dailyKpiTotals(AGENTS.slice(0, 2));
    expect(t.agents).toBe(2);
    expect(t.month_plan_sum).toBe(3000);
    expect(t.month_fact_sum).toBe(900);
    expect(t.month_execution_pct).toBe(30);
    expect(t.today_plan_sum).toBe(300);
    expect(t.today_fact_sum).toBe(200);
    expect(t.today_remaining_sum).toBe(150);
    expect(t.over).toBe(1);
    expect(t.warn).toBe(1);
  });

  it("groups by supervisor and branch with summed metrics", () => {
    const bySvr = buildDailyKpiRows(AGENTS, "supervisors");
    const aliev = bySvr.find((r) => r.name === "Алиев")!;
    expect(aliev.agents_count).toBe(2);
    expect(aliev.month_plan_sum).toBe(4000);
    expect(aliev.month_fact_sum).toBe(3500);
    expect(aliev.month_execution_pct).toBe(87.5);
    expect(aliev.branch).toBe("Самарканд, Ташкент");

    const byBranch = buildDailyKpiRows(AGENTS, "branches");
    expect(byBranch.map((r) => r.name).sort()).toEqual(["Без филиала", "Самарканд", "Ташкент"].sort());
    const sam = byBranch.find((r) => r.name === "Самарканд")!;
    expect(sam.today_plan_sum).toBe(300);
    expect(sam.today_fact_sum).toBe(200);
    // group sums must equal overall totals
    const total = byBranch.reduce((s, r) => s + r.month_plan_sum, 0);
    expect(total).toBe(dailyKpiTotals(AGENTS).month_plan_sum);
  });

  it("aggregate status: all planned members off → off; no plan → no_plan", () => {
    expect(aggregateStatus([AGENTS[2]!])).toBe("off");
    expect(aggregateStatus([AGENTS[3]!])).toBe("no_plan");
    expect(aggregateStatus([AGENTS[0]!, AGENTS[1]!])).toBe("warn");
  });

  it("sorts by name (ru) and by numbers desc", () => {
    const rows = buildDailyKpiRows(AGENTS, "agents");
    expect(sortDailyKpiRows(rows, { key: "name", dir: "asc" }).map((r) => r.name)).toEqual([
      "Азиза",
      "Бахром",
      "Виктор",
      "Гулнора"
    ]);
    expect(sortDailyKpiRows(rows, { key: "month_plan_sum", dir: "desc" }).map((r) => r.agent_id)).toEqual([
      3, 2, 1, 4
    ]);
    expect(sortDailyKpiRows(rows, { key: "month_execution_pct", dir: "desc" }).map((r) => r.agent_id)).toEqual([3, 1, 2, 4]);
    expect(sortDailyKpiRows(rows, { key: "month_execution_pct", dir: "asc" }).map((r) => r.agent_id)).toEqual([2, 1, 3, 4]);
  });
});
