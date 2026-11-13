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

/**
 * Agent ↔ KPI bog‘lanishlari.
 * Guruhda hech kim yo‘q bo‘lsa — cheklov yo‘q (mobil bilan bir xil).
 */
export async function loadKpiGroupAgentLinks(
  tenantId: number,
  kpiGroupIds: number[]
): Promise<{
  /** user_id → kpi_group_id[] */
  agent_kpi_ids: Record<string, number[]>;
  /** Kamida bitta agent biriktirilgan KPI guruhlari */
  kpi_group_ids_with_agents: number[];
}> {
  if (kpiGroupIds.length === 0) {
    return { agent_kpi_ids: {}, kpi_group_ids_with_agents: [] };
  }
  const rows = await prisma.kpiGroupAgent.findMany({
    where: {
      kpi_group_id: { in: kpiGroupIds },
      kpi_group: { tenant_id: tenantId, is_active: true }
    },
    select: { user_id: true, kpi_group_id: true }
  });
  const byUser = new Map<number, number[]>();
  const groupsWithAgents = new Set<number>();
  for (const row of rows) {
    groupsWithAgents.add(row.kpi_group_id);
    const arr = byUser.get(row.user_id) ?? [];
    arr.push(row.kpi_group_id);
    byUser.set(row.user_id, arr);
  }
  const agent_kpi_ids: Record<string, number[]> = {};
  for (const [userId, ids] of byUser) {
    agent_kpi_ids[String(userId)] = ids;
  }
  return {
    agent_kpi_ids,
    kpi_group_ids_with_agents: [...groupsWithAgents]
  };
}
