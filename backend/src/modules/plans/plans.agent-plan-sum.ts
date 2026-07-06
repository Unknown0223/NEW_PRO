import { prisma } from "../../config/database";
import { userMatchesTradeDirection } from "./plans.setup.direction";

import { WORKING_KPI_PLAN_STATUSES } from "./plans.monitoring-aggregates";

/** Agentning joriy oy/yil/yo'nalish bo'yicha KPI reja summasi (cost). */
export async function getAgentMonthlyPlanCostSum(
  tenantId: number,
  agentUserId: number,
  month: number,
  year: number,
  statuses: readonly string[] = WORKING_KPI_PLAN_STATUSES
): Promise<number> {
  const agent = await prisma.user.findFirst({
    where: { id: agentUserId, tenant_id: tenantId, role: "agent", is_active: true },
    select: { trade_direction_id: true, trade_direction: true }
  });
  if (!agent) return 0;

  let directionId = agent.trade_direction_id;
  if (directionId == null) {
    const raw = (agent.trade_direction ?? "").trim();
    if (!raw) return 0;
    const dir = await prisma.tradeDirection.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { code: { equals: raw, mode: "insensitive" } },
          { name: { equals: raw, mode: "insensitive" } }
        ]
      },
      select: { id: true, name: true, code: true }
    });
    if (!dir || !userMatchesTradeDirection(agent, dir)) return 0;
    directionId = dir.id;
  }

  const agg = await prisma.salesKpiPlanTarget.aggregate({
    where: {
      tenant_id: tenantId,
      user_id: agentUserId,
      plan: {
        tenant_id: tenantId,
        month,
        year,
        trade_direction_id: directionId,
        status: { in: [...statuses] }
      }
    },
    _sum: { cost: true }
  });

  return Number(agg._sum.cost ?? 0);
}
