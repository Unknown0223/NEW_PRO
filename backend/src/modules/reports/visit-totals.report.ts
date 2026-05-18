import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  orderScopeSql,
  planScopeSql,
  visitScopeSql,
  type SupervisorDashboardFilters
} from "../dashboard/dashboard.service";
import { ORDER_STATUSES } from "../orders/order-status";
import type { DayMetricRow, VisitTotalsFilters, VisitTotalsPayload, VisitTotalsRow } from "./visit-totals.types";
import { MAX_RANGE_DAYS } from "./visit-totals.types";
import {
  agentLabel,
  bigToNum,
  decToString,
  dedupeVisitTotalsRows,
  eachUtcYmdInclusive,
  fetchActivityBounds,
  fetchVisitTotalsForSingleDay,
  listAgentsForGrid,
  matchesSearch,
  rangeDayCount,
  sortRowsDefaultStable,
  utcDayBounds,
  zeroDayRow
} from "./visit-totals.helpers";

export async function getVisitTotalsReport(
  tenantId: number,
  vf: VisitTotalsFilters,
  actor?: ReportActor
): Promise<VisitTotalsPayload> {
  const days = rangeDayCount(vf.from, vf.to);
  if (days === 0) {
    return { from: vf.from, to: vf.to, page: vf.page, limit: vf.limit, total: 0, rows: [] };
  }
  if (days > MAX_RANGE_DAYS) {
    throw new Error("BAD_RANGE");
  }

  const ymds = eachUtcYmdInclusive(vf.from, vf.to);
  const allRows: VisitTotalsRow[] = [];
  const agentList = await listAgentsForGrid(tenantId, vf, actor);

  for (const ymd of ymds) {
    const bounds = utcDayBounds(ymd);
    const [dayRows, activityMap] = await Promise.all([
      fetchVisitTotalsForSingleDay(tenantId, ymd, vf, actor),
      fetchActivityBounds(tenantId, bounds.dayStart, bounds.dayEnd, vf, actor)
    ]);
    const byAgent = new Map<number, DayMetricRow>();
    for (const r of dayRows) {
      if (!byAgent.has(r.agent_id)) byAgent.set(r.agent_id, r);
    }

    for (const ag of agentList) {
      const r = byAgent.get(ag.id) ?? zeroDayRow(ag);
      const planned = bigToNum(r.planned_visits);
      const visitedPlanned = bigToNum(r.visited_planned);
      const visitedTotal = bigToNum(r.visited_total);
      const notVisited = Math.max(planned - visitedPlanned, 0);
      const ordersCount = bigToNum(r.orders_count);
      const salesStr = decToString(r.sales_sum);
      const salesNum = Number(salesStr);
      const visitPct = planned > 0 ? Math.round((visitedPlanned / planned) * 1000) / 10 : 0;
      const conv =
        visitedTotal > 0 ? Math.round((ordersCount / visitedTotal) * 1000) / 10 : 0;
      const avgOrd =
        ordersCount > 0 ? (salesNum / ordersCount).toFixed(2) : "0";

      const ab = activityMap.get(r.agent_id);
      const label = agentLabel(r.agent_name, r.agent_code);
      if (!matchesSearch(label, vf.search ?? "")) continue;

      allRows.push({
        row_number: 0,
        work_date: ymd,
        agent_id: r.agent_id,
        agent_label: label,
        first_activity_at: ab?.first ? ab.first.toISOString() : null,
        last_activity_at: ab?.last ? ab.last.toISOString() : null,
        planned,
        visited: visitedTotal,
        not_visited: notVisited,
        orders_count: ordersCount,
        sales_sum: salesStr,
        visit_completion_pct: visitPct,
        conversion_orders_per_visit: conv,
        avg_order_value: avgOrd
      });
    }
  }

  const sorted = sortRowsDefaultStable(dedupeVisitTotalsRows(allRows));
  const total = sorted.length;
  const offset = (vf.page - 1) * vf.limit;
  const pageRows = sorted.slice(offset, offset + vf.limit).map((row, i) => ({
    ...row,
    row_number: offset + i + 1
  }));

  return {
    from: vf.from,
    to: vf.to,
    page: vf.page,
    limit: vf.limit,
    total,
    rows: pageRows
  };
}

