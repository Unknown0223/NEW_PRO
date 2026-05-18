import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { VISIT_TOTALS_ORDER_STATUS_OPTIONS } from "./visit-totals.types";
import { agentLabel } from "./visit-totals.helpers";

export async function getVisitTotalsFilterOptions(tenantId: number, actor?: ReportActor) {
  const whereAgent: Prisma.UserWhereInput =
    actor?.role === "agent" && actor.userId
      ? { tenant_id: tenantId, id: actor.userId, role: "agent" }
      : actor?.role === "supervisor" && actor.userId
        ? { tenant_id: tenantId, role: "agent", supervisor_user_id: actor.userId }
        : { tenant_id: tenantId, role: "agent" };

  const agents = await prisma.user.findMany({
    where: whereAgent,
    select: { id: true, name: true, code: true, is_active: true },
    orderBy: { name: "asc" }
  });

  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      code: a.code ?? "",
      is_active: a.is_active,
      label: agentLabel(a.name, a.code)
    })),
    order_statuses: [...VISIT_TOTALS_ORDER_STATUS_OPTIONS]
  };
}

