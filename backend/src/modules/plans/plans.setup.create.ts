import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { BulkSaveTargetsBody, PatchPlanTargetBody, PlanningCenterQuery } from "./plans.setup.schema";
import { canRoleSetPlan } from "./plans.setup.roles";
import { dec, parseDecimalInput, type PlanningTarget } from "./plans.setup.shared";

function canUserSetPlanTarget(role: string): boolean {
  return canRoleSetPlan(role);
}

export async function ensurePlansAndTargets(
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
