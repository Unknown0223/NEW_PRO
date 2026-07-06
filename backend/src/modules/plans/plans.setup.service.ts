import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getApproverConfig } from "./plans.approvers.service";
import type { BulkSaveTargetsBody, PatchPlanTargetBody, PlanningCenterQuery } from "./plans.setup.schema";
import { buildPlanningEmployeeNodes, type HierarchyUser } from "./plans.setup.hierarchy";
import {
  collectLevelUserIds,
  filterPlanningHierarchyNodes,
  scopeApproverRowsByFieldAgents
} from "./plans.setup.scope";
import { AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR, canRoleSetPlan } from "./plans.setup.roles";
import { userMatchesTradeDirection } from "./plans.setup.direction";

function canUserSetPlanTarget(role: string): boolean {
  return canRoleSetPlan(role);
}

export type PlanningDirection = { id: number; name: string; code: string | null };
export type PlanningKpiGroup = {
  id: number;
  name: string;
  trade_direction_id: number;
  status: string | null;
};
export type PlanningEmployee = {
  id: number;
  name: string;
  code: string | null;
  role: string;
  parent_id: number | null;
  supervisor_config_index: number | null;
  chain_level: number | null;
};
export type PlanningPlan = {
  id: number;
  month: number;
  year: number;
  trade_direction_id: number;
  kpi_group_id: number;
  status: string;
};
export type PlanningTarget = {
  id: number;
  plan_id: number;
  user_id: number;
  cost: string;
  count: string;
  volume: string;
  acb: string;
  order_count: number;
  comment: string | null;
  status: string;
  updated_at: string;
};

export type PlanningCenterData = {
  trade_directions: PlanningDirection[];
  kpi_groups: PlanningKpiGroup[];
  employees: PlanningEmployee[];
  plans: PlanningPlan[];
  kpi_targets: PlanningTarget[];
};

type UserRow = {
  id: number;
  name: string;
  login: string;
  role: string;
  code: string | null;
  supervisor_user_id: number | null;
  trade_direction_id: number | null;
  trade_direction: string | null;
};

function personName(u: { name: string; login: string }): string {
  const n = (u.name ?? "").trim();
  return n.length > 0 ? n : u.login;
}

function dec(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

function parseDecimalInput(v: string | number | undefined): Prisma.Decimal | undefined {
  if (v === undefined) return undefined;
  const normalized = String(v).replace(/\s/g, "").replace(/,/g, ".");
  if (normalized.trim() === "") return new Prisma.Decimal(0);
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) throw new Error("BAD_DECIMAL");
  return new Prisma.Decimal(n);
}

async function getDirection(tenantId: number, directionId: number): Promise<PlanningDirection | null> {
  const row = await prisma.tradeDirection.findFirst({
    where: { id: directionId, tenant_id: tenantId, is_active: true },
    select: { id: true, name: true, code: true }
  });
  return row ? { id: row.id, name: row.name, code: row.code ?? null } : null;
}

const USER_SELECT = {
  id: true,
  name: true,
  login: true,
  role: true,
  code: true,
  supervisor_user_id: true,
  trade_direction_id: true,
  trade_direction: true
} as const;

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

  const [directionAgents, configSupervisees, autoManagers] = await Promise.all([
    findAgentsInDirection(tenantId, direction),
    loadSuperviseesOf(tenantId, configSupervisorIds),
    findAutoManagersInDirection(tenantId, direction)
  ]);

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
    personName
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

async function ensurePlansAndTargets(
  tenantId: number,
  query: PlanningCenterQuery,
  kpiGroupIds: number[],
  userIds: number[],
  actorUserId: number | null
): Promise<void> {
  if (kpiGroupIds.length === 0 || userIds.length === 0) return;

  for (const kpiGroupId of kpiGroupIds) {
    const plan = await prisma.salesKpiPlan.upsert({
      where: {
        tenant_id_month_year_trade_direction_id_kpi_group_id: {
          tenant_id: tenantId,
          month: query.month,
          year: query.year,
          trade_direction_id: query.direction_id,
          kpi_group_id: kpiGroupId
        }
      },
      create: {
        tenant_id: tenantId,
        month: query.month,
        year: query.year,
        trade_direction_id: query.direction_id,
        kpi_group_id: kpiGroupId,
        created_by: actorUserId ?? undefined
      },
      update: {}
    });

    const existing = await prisma.salesKpiPlanTarget.findMany({
      where: { plan_id: plan.id },
      select: { user_id: true }
    });
    const have = new Set(existing.map((e) => e.user_id));
    const missing = userIds.filter((id) => !have.has(id));
    if (missing.length === 0) continue;

    await prisma.salesKpiPlanTarget.createMany({
      data: missing.map((userId) => ({
        tenant_id: tenantId,
        plan_id: plan.id,
        user_id: userId
      })),
      skipDuplicates: true
    });
  }
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

  const staffIds = employees.map((e) => e.id);
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

function buildTargetPatch(input: PatchPlanTargetBody): Prisma.SalesKpiPlanTargetUncheckedUpdateInput {
  const data: Prisma.SalesKpiPlanTargetUncheckedUpdateInput = {};
  if (input.cost !== undefined) data.cost = parseDecimalInput(input.cost);
  if (input.count !== undefined) data.count = parseDecimalInput(input.count);
  if (input.volume !== undefined) data.volume = parseDecimalInput(input.volume);
  if (input.acb !== undefined) data.acb = parseDecimalInput(input.acb);
  if (input.order_count !== undefined) data.order_count = input.order_count;
  if (input.comment !== undefined) data.comment = input.comment;
  if (input.status !== undefined) data.status = input.status;
  return data;
}

export async function patchPlanTarget(
  tenantId: number,
  targetId: number,
  input: PatchPlanTargetBody,
  actorUserId: number | null
): Promise<PlanningTarget> {
  const existing = await prisma.salesKpiPlanTarget.findFirst({
    where: { id: targetId, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");

  const targetUser = await prisma.user.findFirst({
    where: { tenant_id: tenantId, id: existing.user_id },
    select: { role: true }
  });
  if (!targetUser || !canUserSetPlanTarget(targetUser.role)) {
    throw new Error("PLAN_TARGET_READONLY");
  }

  let patch: Prisma.SalesKpiPlanTargetUncheckedUpdateInput;
  try {
    patch = buildTargetPatch(input);
  } catch {
    throw new Error("BAD_DECIMAL");
  }

  const row = await prisma.salesKpiPlanTarget.update({
    where: { id: targetId },
    data: {
      ...patch,
      updated_by: actorUserId ?? undefined
    }
  });

  return {
    id: row.id,
    plan_id: row.plan_id,
    user_id: row.user_id,
    cost: dec(row.cost),
    count: dec(row.count),
    volume: dec(row.volume),
    acb: dec(row.acb),
    order_count: row.order_count,
    comment: row.comment,
    status: row.status,
    updated_at: row.updated_at.toISOString()
  };
}

export async function bulkSavePlanTargets(
  tenantId: number,
  input: BulkSaveTargetsBody,
  actorUserId: number | null
): Promise<{ updated: number }> {
  let updated = 0;
  for (const item of input.targets) {
    const existing = await prisma.salesKpiPlanTarget.findFirst({
      where: { id: item.id, tenant_id: tenantId }
    });
    if (!existing) continue;

    const targetUser = await prisma.user.findFirst({
      where: { tenant_id: tenantId, id: existing.user_id },
      select: { role: true }
    });
    if (!targetUser || !canUserSetPlanTarget(targetUser.role)) continue;

    let patch: Prisma.SalesKpiPlanTargetUncheckedUpdateInput;
    try {
      patch = buildTargetPatch(item);
    } catch {
      throw new Error("BAD_DECIMAL");
    }

    await prisma.salesKpiPlanTarget.update({
      where: { id: item.id },
      data: { ...patch, updated_by: actorUserId ?? undefined }
    });
    updated += 1;
  }
  return { updated };
}

export async function confirmPlans(
  tenantId: number,
  month: number,
  year: number,
  directionId: number,
  planIds: number[] | undefined,
  actorUserId: number | null
): Promise<{ plans_updated: number; targets_updated: number }> {
  const where: Prisma.SalesKpiPlanWhereInput = {
    tenant_id: tenantId,
    month,
    year,
    trade_direction_id: directionId,
    ...(planIds && planIds.length > 0 ? { id: { in: planIds } } : {})
  };

  const plans = await prisma.salesKpiPlan.findMany({ where, select: { id: true } });
  if (plans.length === 0) return { plans_updated: 0, targets_updated: 0 };

  const ids = plans.map((p) => p.id);

  await prisma.salesKpiPlan.updateMany({
    where: { id: { in: ids } },
    data: { status: "pending_approval" }
  });

  const targetsResult = await prisma.salesKpiPlanTarget.updateMany({
    where: { plan_id: { in: ids }, tenant_id: tenantId },
    data: { status: "pending_approval", updated_by: actorUserId ?? undefined }
  });

  return { plans_updated: ids.length, targets_updated: targetsResult.count };
}

export async function approvePlans(
  tenantId: number,
  month: number,
  year: number,
  directionId: number,
  planIds: number[] | undefined,
  actorUserId: number | null
): Promise<{ plans_updated: number; targets_updated: number }> {
  const where: Prisma.SalesKpiPlanWhereInput = {
    tenant_id: tenantId,
    month,
    year,
    trade_direction_id: directionId,
    status: "pending_approval",
    ...(planIds && planIds.length > 0 ? { id: { in: planIds } } : {})
  };

  const plans = await prisma.salesKpiPlan.findMany({ where, select: { id: true } });
  if (plans.length === 0) return { plans_updated: 0, targets_updated: 0 };

  const ids = plans.map((p) => p.id);
  const now = new Date();

  await prisma.salesKpiPlan.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "approved",
      approved_by: actorUserId ?? undefined,
      approved_at: now
    }
  });

  const targetsResult = await prisma.salesKpiPlanTarget.updateMany({
    where: { plan_id: { in: ids }, tenant_id: tenantId, status: "pending_approval" },
    data: { status: "approved", updated_by: actorUserId ?? undefined }
  });

  return { plans_updated: ids.length, targets_updated: targetsResult.count };
}

export async function returnPlansToDraft(
  tenantId: number,
  month: number,
  year: number,
  directionId: number,
  planIds: number[] | undefined,
  actorUserId: number | null
): Promise<{ plans_updated: number; targets_updated: number }> {
  const where: Prisma.SalesKpiPlanWhereInput = {
    tenant_id: tenantId,
    month,
    year,
    trade_direction_id: directionId,
    status: { in: ["pending_approval", "approved"] },
    ...(planIds && planIds.length > 0 ? { id: { in: planIds } } : {})
  };

  const plans = await prisma.salesKpiPlan.findMany({ where, select: { id: true } });
  if (plans.length === 0) return { plans_updated: 0, targets_updated: 0 };

  const ids = plans.map((p) => p.id);

  await prisma.salesKpiPlan.updateMany({
    where: { id: { in: ids } },
    data: { status: "draft", approved_by: null, approved_at: null }
  });

  const targetsResult = await prisma.salesKpiPlanTarget.updateMany({
    where: { plan_id: { in: ids }, tenant_id: tenantId },
    data: { status: "draft", updated_by: actorUserId ?? undefined }
  });

  return { plans_updated: ids.length, targets_updated: targetsResult.count };
}
