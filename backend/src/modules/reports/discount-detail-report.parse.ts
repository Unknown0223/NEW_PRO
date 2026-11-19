import { monthToDateYmd } from "../../lib/month-to-date";
import { intList } from "./expeditor-returns.helpers";
import type { DiscountDetailReportFilters } from "./discount-detail-report.types";

export function parseDiscountDetailReportQuery(q: Record<string, string | undefined>): DiscountDetailReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}