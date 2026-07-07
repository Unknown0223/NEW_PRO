import { prisma } from "../../config/database";
import { USER_SELECT, type UserRow } from "./plans.setup.shared";

/** KPI guruhiga biriktirilgan agentlar — yo'nalish bo'yicha reja ierarxiyasiga qo'shiladi. */
export async function findKpiGroupAgentsInDirection(
  tenantId: number,
  directionId: number
): Promise<UserRow[]> {
  const rows = await prisma.kpiGroupAgent.findMany({
    where: {
      kpi_group: { tenant_id: tenantId, is_active: true },
      user: {
        tenant_id: tenantId,
        is_active: true,
        role: "agent",
        OR: [{ trade_direction_id: directionId }, { trade_direction_id: null }]
      }
    },
    select: { user: { select: USER_SELECT } }
  });
  const byId = new Map<number, UserRow>();
  for (const row of rows) {
    if (row.user.supervisor_user_id == null) continue;
    byId.set(row.user.id, row.user);
  }
  return [...byId.values()];
}

export async function findKpiGroupAgentUserIds(
  tenantId: number,
  directionId: number,
  kpiGroupIds: number[]
): Promise<number[]> {
  if (kpiGroupIds.length === 0) return [];
  const rows = await prisma.kpiGroupAgent.findMany({
    where: {
      kpi_group_id: { in: kpiGroupIds },
      kpi_group: { tenant_id: tenantId, is_active: true },
      user: {
        tenant_id: tenantId,
        is_active: true,
        role: "agent",
        OR: [{ trade_direction_id: directionId }, { trade_direction_id: null }]
      }
    },
    select: { user_id: true }
  });
  return [...new Set(rows.map((row) => row.user_id))];
}
