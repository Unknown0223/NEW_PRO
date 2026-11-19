import { monthToDateYmd } from "../../lib/month-to-date";
import { intList } from "./product-sales.helpers";
import type { SalesCompareGroupBy, SalesCompareReportFilters } from "./sales-compare-report.types";

const GROUP_BY = new Set<SalesCompareGroupBy>(["product", "agent", "client"]);

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** O‘tgan to‘liq kalendar oy (A davri default). */
export function previousMonthYmd(now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toYmd(from), to: toYmd(to) };
}

export function parseSalesCompareReportQuery(q: Record<string, string | undefined>): SalesCompareReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultBFrom, to: defaultBTo } = monthToDateYmd();
  const { from: defaultAFrom, to: defaultATo } = previousMonthYmd();
  const groupRaw = (q.group_by ?? "").trim() as SalesCompareGroupBy;
  return {
    from_a: (q.from_a ?? "").trim() || defaultAFrom,
    to_a: (q.to_a ?? "").trim() || defaultATo,
    from_b: (q.from_b ?? "").trim() || defaultBFrom,
    to_b: (q.to_b ?? "").trim() || defaultBTo,
    group_by: GROUP_BY.has(groupRaw) ? groupRaw : "product",
    agent_ids: intList(q.agent_ids),
    category_ids: intList(q.category_ids),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}