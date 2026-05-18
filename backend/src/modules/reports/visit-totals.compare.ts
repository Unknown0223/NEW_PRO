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
import {
  bigToNum,
  decToString,
  fetchVisitTotalsForSingleDay
} from "./visit-totals.helpers";
import type { VisitTotalsFilters } from "./visit-totals.types";

export async function compareVisitTotalsWithDashboardVisitReport(
  tenantId: number,
  dayYmd: string,
  agentId: number
): Promise<{
  dashboard_planned: number;
  totals_planned: number;
  dashboard_visited_planned: number;
  totals_visited_planned: number;
  dashboard_visited_total: number;
  totals_visited_total: number;
  dashboard_sales: string;
  totals_sales: string;
}> {
  const { getSupervisorDashboardSnapshot } = await import("../dashboard/dashboard.service");
  const snap = await getSupervisorDashboardSnapshot(tenantId, {
    date: dayYmd,
    agent_ids: [agentId],
    supervisor_ids: [],
    payment_types: [],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: []
  });
  const dashRow = snap.visit_report.rows.find((x) => x.agent_id === agentId);
  const vf: VisitTotalsFilters = {
    from: dayYmd,
    to: dayYmd,
    agent_ids: [agentId],
    order_statuses: [],
    page: 1,
    limit: 200
  };
  const rawDay = (await fetchVisitTotalsForSingleDay(tenantId, dayYmd, vf, undefined)).find(
    (x) => x.agent_id === agentId
  );

  return {
    dashboard_planned: dashRow?.planned_visits ?? -1,
    totals_planned: rawDay ? bigToNum(rawDay.planned_visits) : -1,
    dashboard_visited_planned: dashRow?.visited_planned ?? -1,
    totals_visited_planned: rawDay ? bigToNum(rawDay.visited_planned) : -1,
    dashboard_visited_total: dashRow?.visited_total ?? -1,
    totals_visited_total: rawDay ? bigToNum(rawDay.visited_total) : -1,
    dashboard_sales: dashRow?.sales_sum ?? "",
    totals_sales: rawDay ? decToString(rawDay.sales_sum) : ""
  };
}

