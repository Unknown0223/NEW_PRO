import type { Prisma } from "@prisma/client";
import type { SupervisorDashboardFilters } from "./dashboard.supervisor.scope";
import type { SupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits.types";
import { fetchSupervisorVisitAndSalesRaw } from "./dashboard.supervisor.snapshot-visits.query";
import { mapSupervisorVisitRows } from "./dashboard.supervisor.snapshot-visits.map";

export type { SupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits.types";

export async function loadSupervisorVisitAndSalesBlocks(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  filters: SupervisorDashboardFilters,
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitAndSalesBlocks> {
  const { salesAgg, cashAgg, paymentBreakdownRows, visitRows } = await fetchSupervisorVisitAndSalesRaw(
    tenantId,
    dayStart,
    dayEnd,
    filters,
    orderScope,
    visitScope,
    planScope
  );
  const { mappedVisitRows, totals } = mapSupervisorVisitRows(visitRows);
  return { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals };
}
