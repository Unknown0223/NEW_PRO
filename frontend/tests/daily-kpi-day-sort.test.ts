import { describe, expect, it } from "vitest";
import {
  dayMetricSortKey,
  nextDailyKpiDaySort,
  sortDailyKpiDayAgents,
  type DailyKpiDayAgentRow
} from "../components/plans/daily-kpi/daily-kpi-day-sort";
import { formatCountdown } from "../lib/workday-status";

function cell(day_plan: number, fact: number) {
  return {
    day_plan,
    sales: fact,
    returns: 0,
    fact,
    execution_pct: day_plan > 0 ? (fact / day_plan) * 100 : null
  } as DailyKpiDayAgentRow["cells"][string];
}

const agents: DailyKpiDayAgentRow[] = [
  { agent_id: 1, name: "Борис", code: "A10", branch: "Юг", cells: { "7": cell(100, 50) } },
  { agent_id: 2, name: "Анна", code: "A2", branch: null, cells: { "7": cell(0, 30) } },
  { agent_id: 3, name: "Вера", code: null, branch: "Север", cells: {} }
];

const names = (rows: DailyKpiDayAgentRow[]) => rows.map((r) => r.name);

describe("sortDailyKpiDayAgents", () => {
  it("sorts by name and code (numeric-aware), empty values last", () => {
    expect(names(sortDailyKpiDayAgents(agents, { key: "name", dir: "asc" }))).toEqual(["Анна", "Борис", "Вера"]);
    expect(names(sortDailyKpiDayAgents(agents, { key: "code", dir: "asc" }))).toEqual(["Анна", "Борис", "Вера"]);
    expect(names(sortDailyKpiDayAgents(agents, { key: "code", dir: "desc" }))).toEqual(["Борис", "Анна", "Вера"]);
    expect(names(sortDailyKpiDayAgents(agents, { key: "branch", dir: "asc" }))).toEqual(["Вера", "Борис", "Анна"]);
  });

  it("sorts by group metric; missing cell counts as 0, missing % goes last", () => {
    const fact = dayMetricSortKey(7, "fact");
    expect(names(sortDailyKpiDayAgents(agents, { key: fact, dir: "desc" }))).toEqual(["Борис", "Анна", "Вера"]);
    const pct = dayMetricSortKey(7, "execution_pct");
    expect(names(sortDailyKpiDayAgents(agents, { key: pct, dir: "asc" }))).toEqual(["Борис", "Анна", "Вера"]);
  });

  it("toggles direction; numbers start descending, text ascending", () => {
    const k = dayMetricSortKey(7, "sales");
    expect(nextDailyKpiDaySort({ key: "name", dir: "asc" }, k)).toEqual({ key: k, dir: "desc" });
    expect(nextDailyKpiDaySort({ key: k, dir: "desc" }, k)).toEqual({ key: k, dir: "asc" });
    expect(nextDailyKpiDaySort({ key: k, dir: "desc" }, "branch")).toEqual({ key: "branch", dir: "asc" });
  });
});

describe("formatCountdown", () => {
  it("formats remaining time for the day-off page", () => {
    expect(formatCountdown(12 * 3600 + 5)).toBe("12:00:05");
    expect(formatCountdown(86_400 + 3661)).toBe("1 д 01:01:01");
    expect(formatCountdown(-4)).toBe("00:00:00");
  });
});
