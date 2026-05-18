import { Prisma } from "@prisma/client";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorVisitOutsideDetail,
  SupervisorVisitPlanDetail,
  SupervisorVisitRow
} from "./dashboard.supervisor.scope";
import type { SupervisorVisitRawRow } from "./dashboard.supervisor.snapshot-visits.query";

export function mapSupervisorVisitRows(visitRows: SupervisorVisitRawRow[]): {
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
} {
  const mappedVisitRows: SupervisorVisitRow[] = visitRows.map((r) => {
    const planned = bigToNum(r.planned_visits);
    const visitedPlanned = bigToNum(r.visited_planned);
    const visitedTotal = bigToNum(r.visited_total);
    const successful = bigToNum(r.visits_with_orders);
    const planDetail: SupervisorVisitPlanDetail = {
      visited_order_sum: decToString(r.plan_vis_ord_sum),
      visited_order_qty: decToString(r.plan_vis_ord_qty),
      visited_no_order: bigToNum(r.plan_vis_no_order),
      not_visited_order_sum: decToString(r.plan_novis_ord_sum),
      not_visited_order_qty: decToString(r.plan_novis_ord_qty),
      photo: bigToNum(r.plan_photo)
    };
    const outsideDetail: SupervisorVisitOutsideDetail = {
      visited_order_sum: decToString(r.out_vis_ord_sum),
      visited_order_qty: decToString(r.out_vis_ord_qty),
      visited_no_order: bigToNum(r.out_vis_no_order),
      not_visited_order_sum: decToString(r.out_novis_ord_sum),
      not_visited_order_qty: decToString(r.out_novis_ord_qty),
      photo: bigToNum(r.out_photo)
    };
    return {
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      agent_code: r.agent_code != null && String(r.agent_code).trim() !== "" ? String(r.agent_code).trim() : null,
      supervisor_id: r.supervisor_id,
      supervisor_name: r.supervisor_name,
      planned_visits: planned,
      visited_planned: visitedPlanned,
      visited_unplanned: Math.max(visitedTotal - visitedPlanned, 0),
      visited_total: visitedTotal,
      not_visited: Math.max(planned - visitedPlanned, 0),
      visits_with_orders: successful,
      visits_without_orders: Math.max(visitedTotal - successful, 0),
      gps_visits: bigToNum(r.gps_visits),
      photo_reports: bigToNum(r.photo_reports),
      sales_sum: decToString(r.sales_sum),
      sales_qty: decToString(r.sales_qty),
      plan_detail: planDetail,
      outside_detail: outsideDetail
    };
  });

  const totals = mappedVisitRows.reduce<Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">>(
    (acc, row) => ({
      agent_code: null,
      planned_visits: acc.planned_visits + row.planned_visits,
      visited_planned: acc.visited_planned + row.visited_planned,
      visited_unplanned: acc.visited_unplanned + row.visited_unplanned,
      visited_total: acc.visited_total + row.visited_total,
      not_visited: acc.not_visited + row.not_visited,
      visits_with_orders: acc.visits_with_orders + row.visits_with_orders,
      visits_without_orders: acc.visits_without_orders + row.visits_without_orders,
      gps_visits: acc.gps_visits + row.gps_visits,
      photo_reports: acc.photo_reports + row.photo_reports,
      sales_sum: new Prisma.Decimal(acc.sales_sum).plus(row.sales_sum).toFixed(2),
      sales_qty: new Prisma.Decimal(acc.sales_qty).plus(row.sales_qty).toFixed(3),
      plan_detail: {
        visited_order_sum: new Prisma.Decimal(acc.plan_detail.visited_order_sum)
          .plus(row.plan_detail.visited_order_sum)
          .toFixed(2),
        visited_order_qty: new Prisma.Decimal(acc.plan_detail.visited_order_qty)
          .plus(row.plan_detail.visited_order_qty)
          .toFixed(3),
        visited_no_order: acc.plan_detail.visited_no_order + row.plan_detail.visited_no_order,
        not_visited_order_sum: new Prisma.Decimal(acc.plan_detail.not_visited_order_sum)
          .plus(row.plan_detail.not_visited_order_sum)
          .toFixed(2),
        not_visited_order_qty: new Prisma.Decimal(acc.plan_detail.not_visited_order_qty)
          .plus(row.plan_detail.not_visited_order_qty)
          .toFixed(3),
        photo: acc.plan_detail.photo + row.plan_detail.photo
      },
      outside_detail: {
        visited_order_sum: new Prisma.Decimal(acc.outside_detail.visited_order_sum)
          .plus(row.outside_detail.visited_order_sum)
          .toFixed(2),
        visited_order_qty: new Prisma.Decimal(acc.outside_detail.visited_order_qty)
          .plus(row.outside_detail.visited_order_qty)
          .toFixed(3),
        visited_no_order: acc.outside_detail.visited_no_order + row.outside_detail.visited_no_order,
        not_visited_order_sum: new Prisma.Decimal(acc.outside_detail.not_visited_order_sum)
          .plus(row.outside_detail.not_visited_order_sum)
          .toFixed(2),
        not_visited_order_qty: new Prisma.Decimal(acc.outside_detail.not_visited_order_qty)
          .plus(row.outside_detail.not_visited_order_qty)
          .toFixed(3),
        photo: acc.outside_detail.photo + row.outside_detail.photo
      }
    }),
    {
      agent_code: null,
      planned_visits: 0,
      visited_planned: 0,
      visited_unplanned: 0,
      visited_total: 0,
      not_visited: 0,
      visits_with_orders: 0,
      visits_without_orders: 0,
      gps_visits: 0,
      photo_reports: 0,
      sales_sum: "0",
      sales_qty: "0",
      plan_detail: {
        visited_order_sum: "0",
        visited_order_qty: "0",
        visited_no_order: 0,
        not_visited_order_sum: "0",
        not_visited_order_qty: "0",
        photo: 0
      },
      outside_detail: {
        visited_order_sum: "0",
        visited_order_qty: "0",
        visited_no_order: 0,
        not_visited_order_sum: "0",
        not_visited_order_qty: "0",
        photo: 0
      }
    }
  );
  return { mappedVisitRows, totals };
}
