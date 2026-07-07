import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getApproverConfig } from "./plans.approvers.service";
import type { PlanningCenterQuery } from "./plans.setup.schema";
import { buildPlanningEmployeeNodes, buildActiveBranchLookup, type HierarchyUser } from "./plans.setup.hierarchy";
import {
  collectLevelUserIds,
  filterPlanningHierarchyNodes,
  scopeApproverRowsByFieldAgents
} from "./plans.setup.scope";
import { AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR } from "./plans.setup.roles";
import { userMatchesTradeDirection } from "./plans.setup.direction";
import { ensurePlansAndTargets } from "./plans.setup.create";
import {
  dec,
  getDirection,
  personName,
  USER_SELECT,
  type PlanningDirection,
  type PlanningCenterData,
  type PlanningEmployee,
  type UserRow
} from "./plans.setup.shared";
import { loadTenantBranchesForAccess } from "../tenant-settings/tenant-settings.profile.read";

/** Yo'nalish bo'yicha agentlar (FK yoki matn bo'yicha). */
async function findAgentsInDirection(
  tenantId: number,
  direction: PlanningDirection
): Promise<UserRow[]> {
  const values = [direction.name, direction.code].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  const base: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    role: "agent",
    supervisor_user_id: { not: null }
  };

  const or: Prisma.UserWhereInput[] = [{ trade_direction_id: direction.id }];
  if (values.length > 0) {
    or.push(...values.map((v) => ({ trade_direction: { equals: v, mode: "insensitive" as const } })));
  }

  const rows = await prisma.user.findMany({
    where: { ...base, OR: or },
    select: USER_SELECT,
    orderBy: [{ name: "asc" }, { login: "asc" }]
  });
  return rows;
}

/** Yo'nalish bo'yicha SVR ustidagi rollar (approver config bo'sh bo'lsa avtomatik zanjir). */
async function findAutoManagersInDirection(
  tenantId: number,
  direction: PlanningDirection
): Promise<UserRow[]> {
  const values = [direction.name, direction.code].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  const or: Prisma.UserWhereInput[] = [{ trade_direction_id: direction.id }];
  if (values.length > 0) {
    or.push(...values.map((v) => ({ trade_direction: { equals: v, mode: "insensitive" as const } })));
  }

  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: [...AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR] },
      OR: or
    },
    select: USER_SELECT,
    orderBy: [{ name: "asc" }, { login: "asc" }]
  });
  return rows;
}

/** Supervayzer(lar)ga biriktirilgan agentlar — `supervisor_user_id` bo'yicha. */
async function loadSuperviseesOf(
  tenantId: number,
  supervisorIds: number[]
): Promise<UserRow[]> {
  if (supervisorIds.length === 0) return [];
  return prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      supervisor_user_id: { in: supervisorIds }
    },
    select: USER_SELECT,
    orderBy: [{ name: "asc" }, { login: "asc" }]
  });
}

/** Ierarxiya zanjiridagi foydalanuvchilar (supervayzer faol bo'lmasa ham ko'rsatiladi). */
async function loadHierarchyUsers(
  tenantId: number,
  userIds: Set<number>
): Promise<Map<number, UserRow>> {
  if (userIds.size === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...userIds] }, is_active: true },
    select: USER_SELECT
  });
  return new Map(rows.map((u) => [u.id, u]));
}

/**
 * Reja ierarxiyasi (pastdan yuqoriga):
 * Agent → Supervayzer → PlanApproverLevel (Степень 1..N) → PlanApproverLeader (rahbarlar).
 * «Настройка утверждающих» dagi yo'nalish + supervayzer zanjiridan olinadi.
 */
async function buildPlanningHierarchy(
  tenantId: number,
  directionId: number,
  direction: PlanningDirection
): Promise<PlanningEmployee[]> {
  const approverCfg = await getApproverConfig(tenantId, directionId);
  const configSupervisorIds = approverCfg.rows.map((r) => r.supervisor_user_id);

  const [directionAgents, configSupervisees, autoManagers, tenantBranches] = await Promise.all([
    findAgentsInDirection(tenantId, direction),
    loadSuperviseesOf(tenantId, configSupervisorIds),
    findAutoManagersInDirection(tenantId, direction),
    loadTenantBranchesForAccess(tenantId)
  ]);
  const branchLookup = buildActiveBranchLookup(tenantBranches);

  const agentMap = new Map<number, UserRow>();
  for (const a of [...directionAgents, ...configSupervisees]) {
    if (a.supervisor_user_id == null) continue;
    if (!userMatchesTradeDirection(a, direction)) continue;
    agentMap.set(a.id, a);
  }

  if (agentMap.size > 0) {
    const fresh = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: [...agentMap.keys()] },
        role: "agent",
        is_active: true,
        supervisor_user_id: { not: null }
      },
      select: USER_SELECT
    });
    agentMap.clear();
    for (const a of fresh) {
      if (userMatchesTradeDirection(a, direction)) agentMap.set(a.id, a);
    }
  }

  const agents = [...agentMap.values()];
  const leaderIds = approverCfg.leaders.filter((id) => id > 0);

  const scopedApproverRows = scopeApproverRowsByFieldAgents(approverCfg.rows, agents);
  const scopedApproverCfg = { ...approverCfg, rows: scopedApproverRows };
  const supervisorIdsWithAgents = new Set(
    agents.map((a) => a.supervisor_user_id).filter((id): id is number => id != null && id > 0)
  );

  if (agents.length === 0 && leaderIds.length === 0 && scopedApproverRows.length === 0) {
    return [];
  }

  const configLevelUserIds = collectLevelUserIds(scopedApproverRows);

  const userIds = new Set<number>();
  for (const id of leaderIds) userIds.add(id);
  for (const a of agents) {
    userIds.add(a.id);
    if (a.supervisor_user_id != null) userIds.add(a.supervisor_user_id);
  }
  for (const lvl of configLevelUserIds) userIds.add(lvl);
  for (const m of autoManagers) userIds.add(m.id);

  let userById = await loadHierarchyUsers(tenantId, userIds);
  for (let pass = 0; pass < 4; pass++) {
    const missing = new Set<number>();
    for (const a of agents) {
      if (a.supervisor_user_id != null && !userById.has(a.supervisor_user_id)) {
        missing.add(a.supervisor_user_id);
      }
    }
    for (const id of leaderIds) if (!userById.has(id)) missing.add(id);
    if (missing.size === 0) break;
    const extra = await loadHierarchyUsers(tenantId, missing);
    for (const [k, v] of extra) userById.set(k, v);
  }

  const nodes = buildPlanningEmployeeNodes({
    agents,
    approverCfg: scopedApproverCfg,
    autoManagers,
    userById: userById as Map<number, HierarchyUser>,
    personName,
    branchLookup
  });

  const fieldAgentIds = new Set(agents.map((a) => a.id));

  return filterPlanningHierarchyNodes({
    nodes,
    leaderIds,
    scopedRows: scopedApproverRows,
    fieldAgentIds,
    supervisorIdsWithAgents,
    userMatchesDirection: (userId) => {
      const u = userById.get(userId);
      if (!u) return false;
      return userMatchesTradeDirection(u, direction);
    }
  });
}

async function listKpiGroupsForDirection(
  tenantId: number,
  directionId: number
): Promise<{ id: number; name: string }[]> {
  const usedInPlans = await prisma.salesKpiPlan.findMany({
    where: { tenant_id: tenantId, trade_direction_id: directionId },
    select: { kpi_group_id: true },
    distinct: ["kpi_group_id"]
  });
  const fromAgents = await prisma.kpiGroupAgent.findMany({
    where: {
      kpi_group: { tenant_id: tenantId, is_active: true },
      user: {
        tenant_id: tenantId,
        is_active: true,
        OR: [{ trade_direction_id: directionId }, { trade_direction_id: null }]
      }
    },
    select: { kpi_group_id: true },
    distinct: ["kpi_group_id"]
  });
  const ids = new Set([
    ...usedInPlans.map((r) => r.kpi_group_id),
    ...fromAgents.map((r) => r.kpi_group_id)
  ]);
  if (ids.size === 0) {
    const all = await prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    });
    return all.map((g) => ({ id: g.id, name: g.name }));
  }
  const groups = await prisma.kpiGroup.findMany({
    where: { tenant_id: tenantId, is_active: true, id: { in: [...ids] } },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true }
  });
  return groups.map((g) => ({ id: g.id, name: g.name }));
}

export async function getPlanningCenter(
  tenantId: number,
  query: PlanningCenterQuery,
  actorUserId: number | null = null
): Promise<PlanningCenterData> {
  const direction = await getDirection(tenantId, query.direction_id);
  if (!direction) throw new Error("BAD_DIRECTION");

  const [directions, employees] = await Promise.all([
    prisma.tradeDirection.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true }
    }),
    buildPlanningHierarchy(tenantId, query.direction_id, direction)
  ]);

  const staffIds = employees.filter((e) => e.id > 0).map((e) => e.id);
  const kpiGroupsRaw = await listKpiGroupsForDirection(tenantId, query.direction_id);
  const kpiGroupIds = kpiGroupsRaw.map((g) => g.id);

  await ensurePlansAndTargets(tenantId, query, kpiGroupIds, staffIds, actorUserId);

  const plans = await prisma.salesKpiPlan.findMany({
    where: {
      tenant_id: tenantId,
      month: query.month,
      year: query.year,
      trade_direction_id: query.direction_id,
      kpi_group_id: { in: kpiGroupIds.length > 0 ? kpiGroupIds : [-1] }
    },
    select: {
      id: true,
      month: true,
      year: true,
      trade_direction_id: true,
      kpi_group_id: true,
      status: true
    }
  });

  const planIds = plans.map((p) => p.id);
  const targets =
    planIds.length === 0
      ? []
      : await prisma.salesKpiPlanTarget.findMany({
          where: { plan_id: { in: planIds } },
          select: {
            id: true,
            plan_id: true,
            user_id: true,
            cost: true,
            count: true,
            volume: true,
            acb: true,
            order_count: true,
            comment: true,
            status: true,
            updated_at: true
          }
        });

  return {
    trade_directions: directions.map((d) => ({ id: d.id, name: d.name, code: d.code ?? null })),
    kpi_groups: kpiGroupsRaw.map((g) => ({
      id: g.id,
      name: g.name,
      trade_direction_id: query.direction_id,
      status: "in_progress"
    })),
    employees,
    plans: plans.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      trade_direction_id: p.trade_direction_id,
      kpi_group_id: p.kpi_group_id,
      status: p.status
    })),
    kpi_targets: targets.map((t) => ({
      id: t.id,
      plan_id: t.plan_id,
      user_id: t.user_id,
      cost: dec(t.cost),
      count: dec(t.count),
      volume: dec(t.volume),
      acb: dec(t.acb),
      order_count: t.order_count,
      comment: t.comment,
      status: t.status,
      updated_at: t.updated_at.toISOString()
    }))
  };
}
