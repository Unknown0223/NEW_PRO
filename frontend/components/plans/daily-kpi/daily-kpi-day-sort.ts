import type { DailyKpiDayMatrix } from "./daily-kpi-api";

export type DailyKpiDayMetric = "day_plan" | "sales" | "returns" | "fact" | "execution_pct";
export type DailyKpiDayAgentRow = DailyKpiDayMatrix["agents"][number];

/** `name` | `code` | `branch` | `m:<kpi_group_id>:<metric>` */
export type DailyKpiDaySortKey = "name" | "code" | "branch" | `m:${string}:${DailyKpiDayMetric}`;
export type DailyKpiDaySort = { key: DailyKpiDaySortKey; dir: "asc" | "desc" };

export function dayMetricSortKey(groupId: number | string, metric: DailyKpiDayMetric): DailyKpiDaySortKey {
  return `m:${groupId}:${metric}`;
}

export function isTextDaySortKey(key: DailyKpiDaySortKey): boolean {
  return key === "name" || key === "code" || key === "branch";
}

function sortValue(a: DailyKpiDayAgentRow, key: DailyKpiDaySortKey): string | number | null {
  if (key === "name") return a.name;
  if (key === "code") return a.code?.trim() ? a.code : null;
  if (key === "branch") return a.branch?.trim() ? a.branch : null;
  const [, groupId, metric] = key.split(":") as [string, string, DailyKpiDayMetric];
  const c = a.cells[groupId];
  if (metric === "execution_pct") return c?.execution_pct ?? null;
  return c ? c[metric] : 0;
}

export function sortDailyKpiDayAgents(
  agents: DailyKpiDayAgentRow[],
  sort: DailyKpiDaySort
): DailyKpiDayAgentRow[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...agents].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    // Bo‘sh qiymatlar (— / null) har doim oxirida.
    if (va == null && vb != null) return 1;
    if (vb == null && va != null) return -1;
    let cmp = 0;
    if (typeof va === "string" && typeof vb === "string") cmp = va.localeCompare(vb, "ru", { numeric: true });
    else if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
    if (cmp !== 0) return cmp * dir;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function nextDailyKpiDaySort(prev: DailyKpiDaySort, key: DailyKpiDaySortKey): DailyKpiDaySort {
  if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { key, dir: isTextDaySortKey(key) ? "asc" : "desc" };
}
