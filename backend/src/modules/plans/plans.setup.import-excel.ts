/**
 * KPI reja markazi — Excel import (smart kod bo‘yicha upsert).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getDirection, parseDecimalInput } from "./plans.setup.shared";
import { ensurePlansAndTargets } from "./plans.setup.create";
import { canRoleSetPlan } from "./plans.setup.roles";
import type { PlansSetupImportBody } from "./plans.setup.schema";
import { getActiveSlotForUser } from "../work-slots/work-slots.query.read";
import {
  resolveUserBySmartCodeForMonth,
  type SmartCodeResolution
} from "../work-slots/work-slots.holder-at-month";

export type PlansImportApplyResult = {
  updated: number;
  created_targets: number;
  skipped: number;
  missing_codes: string[];
  unknown_kpi_groups: string[];
};

/** Slot kodi bo'lsa — reja oyida o'rinda bo'lgan agent (hozirgi ega emas). */
async function resolveAgentBySmartCode(
  tenantId: number,
  rawCode: string,
  year: number,
  month: number
): Promise<SmartCodeResolution | null> {
  return resolveUserBySmartCodeForMonth(tenantId, rawCode, {
    year,
    month,
    roles: ["agent"],
    slotTypes: ["agent"]
  });
}

function buildMetricPatch(input: {
  cost?: string | number | null;
  count?: string | number | null;
  volume?: string | number | null;
  acb?: string | number | null;
  order_count?: number | null;
}): Prisma.SalesKpiPlanTargetUncheckedUpdateInput {
  const data: Prisma.SalesKpiPlanTargetUncheckedUpdateInput = {};
  if (input.cost !== undefined && input.cost !== null && String(input.cost).trim() !== "") {
    data.cost = parseDecimalInput(input.cost);
  }
  if (input.count !== undefined && input.count !== null && String(input.count).trim() !== "") {
    data.count = parseDecimalInput(input.count);
  }
  if (input.volume !== undefined && input.volume !== null && String(input.volume).trim() !== "") {
    data.volume = parseDecimalInput(input.volume);
  }
  if (input.acb !== undefined && input.acb !== null && String(input.acb).trim() !== "") {
    data.acb = parseDecimalInput(input.acb);
  }
  if (input.order_count !== undefined && input.order_count !== null) {
    data.order_count = Math.max(0, Math.floor(Number(input.order_count)) || 0);
  }
  return data;
}

export async function applyPlansSetupImport(
  tenantId: number,
  input: PlansSetupImportBody,
  actorUserId: number | null
): Promise<PlansImportApplyResult> {
  const direction = await getDirection(tenantId, input.direction_id);
  if (!direction) throw new Error("BAD_DIRECTION");

  const kpiGroups = await prisma.kpiGroup.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, name: true }
  });
  const kpiById = new Map(kpiGroups.map((g) => [g.id, g]));
  const kpiByName = new Map(
    kpiGroups.map((g) => [g.name.trim().toLocaleLowerCase("ru"), g.id])
  );

  const missing_codes: string[] = [];
  const unknown_kpi_groups: string[] = [];
  const resolvedRows: Array<{
    userId: number;
    slotId: number | null;
    values: Array<{
      kpiGroupId: number;
      cost?: string | number | null;
      count?: string | number | null;
      volume?: string | number | null;
      acb?: string | number | null;
      order_count?: number | null;
    }>;
  }> = [];

  for (const row of input.rows) {
    const resolved = await resolveAgentBySmartCode(tenantId, row.smart_code, input.year, input.month);
    if (resolved == null) {
      missing_codes.push(row.smart_code.trim());
      continue;
    }
    const userId = resolved.userId;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { role: true }
    });
    if (!user || !canRoleSetPlan(user.role)) {
      missing_codes.push(row.smart_code.trim());
      continue;
    }

    const values: (typeof resolvedRows)[number]["values"] = [];
    for (const v of row.values) {
      let kpiGroupId = v.kpi_group_id ?? null;
      if (kpiGroupId == null && v.kpi_group_name?.trim()) {
        kpiGroupId = kpiByName.get(v.kpi_group_name.trim().toLocaleLowerCase("ru")) ?? null;
        if (kpiGroupId == null) {
          unknown_kpi_groups.push(v.kpi_group_name.trim());
          continue;
        }
      }
      if (kpiGroupId == null || !kpiById.has(kpiGroupId)) {
        if (v.kpi_group_name?.trim()) unknown_kpi_groups.push(v.kpi_group_name.trim());
        continue;
      }
      values.push({
        kpiGroupId,
        cost: v.cost,
        count: v.count,
        volume: v.volume,
        acb: v.acb,
        order_count: v.order_count
      });
    }
    if (values.length > 0) resolvedRows.push({ userId, slotId: resolved.slotId, values });
  }

  const userIds = [...new Set(resolvedRows.map((r) => r.userId))];
  const kpiGroupIds = [...new Set(resolvedRows.flatMap((r) => r.values.map((v) => v.kpiGroupId)))];

  if (userIds.length > 0 && kpiGroupIds.length > 0) {
    await ensurePlansAndTargets(
      tenantId,
      { month: input.month, year: input.year, direction_id: input.direction_id },
      kpiGroupIds,
      userIds,
      actorUserId
    );
  }

  const plans = await prisma.salesKpiPlan.findMany({
    where: {
      tenant_id: tenantId,
      month: input.month,
      year: input.year,
      trade_direction_id: input.direction_id,
      kpi_group_id: { in: kpiGroupIds.length > 0 ? kpiGroupIds : [-1] }
    },
    select: { id: true, kpi_group_id: true }
  });
  const planIdByKpi = new Map(plans.map((p) => [p.kpi_group_id, p.id]));

  let updated = 0;
  let created_targets = 0;
  let skipped = 0;

  for (const row of resolvedRows) {
    for (const v of row.values) {
      const planId = planIdByKpi.get(v.kpiGroupId);
      if (planId == null) {
        skipped += 1;
        continue;
      }

      let patch: Prisma.SalesKpiPlanTargetUncheckedUpdateInput;
      try {
        patch = buildMetricPatch(v);
      } catch {
        throw new Error("BAD_DECIMAL");
      }
      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }

      const existing = await prisma.salesKpiPlanTarget.findFirst({
        where: { plan_id: planId, user_id: row.userId, tenant_id: tenantId },
        select: { id: true }
      });

      if (existing) {
        await prisma.salesKpiPlanTarget.update({
          where: { id: existing.id },
          data: { ...patch, updated_by: actorUserId ?? undefined }
        });
        updated += 1;
      } else {
        const slotId = row.slotId ?? (await getActiveSlotForUser(row.userId))?.slot_id ?? null;
        await prisma.salesKpiPlanTarget.create({
          data: {
            tenant_id: tenantId,
            plan_id: planId,
            user_id: row.userId,
            work_slot_id: slotId,
            cost: (patch.cost as Prisma.Decimal | undefined) ?? undefined,
            count: (patch.count as Prisma.Decimal | undefined) ?? undefined,
            volume: (patch.volume as Prisma.Decimal | undefined) ?? undefined,
            acb: (patch.acb as Prisma.Decimal | undefined) ?? undefined,
            order_count: (patch.order_count as number | undefined) ?? undefined,
            updated_by: actorUserId ?? undefined
          }
        });
        created_targets += 1;
        updated += 1;
      }
    }
  }

  return {
    updated,
    created_targets,
    skipped,
    missing_codes: [...new Set(missing_codes)],
    unknown_kpi_groups: [...new Set(unknown_kpi_groups)]
  };
}
