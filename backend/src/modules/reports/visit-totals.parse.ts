import type { VisitTotalsFilters, VisitTotalsRow } from "./visit-totals.types";
import { VISIT_TOTALS_ORDER_STATUS_IDS } from "./visit-totals.types";
import { intList } from "./visit-totals.helpers";

export function parseVisitTotalsQuery(q: Record<string, string | undefined>): VisitTotalsFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = (q.from ?? "").trim() || defaultFrom;
  const to = (q.to ?? "").trim() || defaultTo;
  const order_statuses = (q.order_statuses ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => VISIT_TOTALS_ORDER_STATUS_IDS.has(s));

  return {
    from,
    to,
    agent_ids: intList(q.agent_ids),
    order_statuses,
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
