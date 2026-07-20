import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import {
  assertIsVoided,
  assertNotVoided,
  restoreVoidedCode,
  softRestoreData,
  softVoidData,
  voidCodeSuffix
} from "../../lib/soft-void";
import { getWorkSlotDetail } from "./work-slots.query";
import {
  bulkPatchActiveUsersOnSlots,
  hasActiveUserAttrsPatch,
  type ActiveUserAttrsPatch
} from "./work-slots.user-attrs";
import {
  applySlotConfigPatch,
  clearWorkplaceFieldsOnUser,
  hasSlotConfigPatch,
  mirrorSlotConfigToUser,
  type SlotConfigPatch
} from "./work-slots.config-mirror";
import { unassignUserFromSlot } from "./work-slots.assign";

export { suggestNextSlotCode } from "./work-slots.codes";

export {
  listWorkSlots,
  getWorkSlotDetail,
  getSlotHistory,
  listSlotDebtCollectors
} from "./work-slots.query";
export {
  assignUserToSlot,
  unassignUserFromSlot,
  getAssignChecklist
} from "./work-slots.assign";
export {
  patchAssignmentLock,
  listPendingAssignments,
  resolvePendingAssignment,
  countPendingReviews,
  markAssignmentPendingReview,
  assertOrderAgentAllowedForClient
} from "./work-slots.lock";
export { getWorkSlotActivityReport } from "./work-slots.kpi";

export async function createWorkSlot(
  tenantId: number,
  body: {
    slot_code: string;
    label?: string | null;
    branch_code?: string | null;
    direction_id?: number | null;
    slot_type?: string;
    is_active?: boolean;
    sort_order?: number;
  },
  actorUserId?: number | null
) {
  const code = body.slot_code.trim().toUpperCase();
  if (!code) throw new Error("VALIDATION");

  if (body.direction_id != null) {
    const dir = await prisma.tradeDirection.findFirst({
      where: { id: body.direction_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!dir) throw new Error("BAD_DIRECTION");
  }

  try {
    const row = await prisma.workSlot.create({
      data: {
        tenant_id: tenantId,
        slot_code: code,
        label: body.label?.trim() || null,
        branch_code: body.branch_code?.trim() || null,
        direction_id: body.direction_id ?? null,
        slot_type: body.slot_type ?? "agent",
        is_active: body.is_active !== false,
        sort_order: body.sort_order ?? 0
      }
    });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      entityType: "work_slot",
      entityId: row.id,
      action: "work_slot.create",
      payload: { slot_code: row.slot_code, slot_type: row.slot_type }
    });
    return getWorkSlotDetail(tenantId, row.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("CODE_TAKEN");
    }
    throw e;
  }
}

export async function patchWorkSlot(
  tenantId: number,
  slotId: number,
  body: {
    slot_code?: string;
    label?: string | null;
    branch_code?: string | null;
    direction_id?: number | null;
    slot_type?: string;
    is_active?: boolean;
    sort_order?: number;
  } & ActiveUserAttrsPatch &
    SlotConfigPatch,
  actorUserId?: number | null
) {
  const existing = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true, territory: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (body.slot_code !== undefined) {
    const code = body.slot_code.trim().toUpperCase();
    if (!code || !/^[A-Z0-9-]{1,32}$/.test(code)) throw new Error("BAD_CODE");
  }

  if (body.direction_id !== undefined && body.direction_id != null) {
    const dir = await prisma.tradeDirection.findFirst({
      where: { id: body.direction_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!dir) throw new Error("BAD_DIRECTION");
  }

  const slotData: Prisma.WorkSlotUpdateInput = {
    ...(body.slot_code !== undefined ? { slot_code: body.slot_code.trim().toUpperCase() } : {}),
    ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
    ...(body.branch_code !== undefined ? { branch_code: body.branch_code?.trim() || null } : {}),
    ...(body.direction_id !== undefined ? { direction_id: body.direction_id } : {}),
    ...(body.slot_type !== undefined ? { slot_type: body.slot_type } : {}),
    ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {})
  };

  const configPatch: SlotConfigPatch = {
    territory_zone: body.territory_zone,
    territory_oblast: body.territory_oblast,
    territory_city: body.territory_city,
    warehouse_id: body.warehouse_id,
    return_warehouse_id: body.return_warehouse_id,
    cash_desk_id: body.cash_desk_id,
    price_type: body.price_type,
    price_types: body.price_types,
    entitlements: body.entitlements,
    consignment: body.consignment,
    consignment_limit_amount: body.consignment_limit_amount,
    consignment_ignore_previous_months_debt: body.consignment_ignore_previous_months_debt,
    consignment_close_day: body.consignment_close_day,
    consignment_close_hour: body.consignment_close_hour,
    consignment_close_minute: body.consignment_close_minute,
    supervisor_user_id: body.supervisor_user_id,
    warehouse_staff_entitlements: body.warehouse_staff_entitlements,
    expeditor_assignment_rules: body.expeditor_assignment_rules
  };

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(slotData).length > 0) {
        await tx.workSlot.update({ where: { id: slotId }, data: slotData });
      }
      if (hasSlotConfigPatch(configPatch) || hasActiveUserAttrsPatch(body)) {
        await applySlotConfigPatch(tx, tenantId, slotId, configPatch, existing.territory);
        const active = await tx.slotUserLink.findFirst({
          where: { slot_id: slotId, ended_at: null },
          select: { user_id: true }
        });
        if (active) {
          await mirrorSlotConfigToUser(tx, tenantId, slotId, active.user_id);
        }
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("CODE_TAKEN");
    }
    throw e;
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    entityType: "work_slot",
    entityId: slotId,
    action: "work_slot.update",
    payload: body as unknown as Record<string, unknown>
  });

  return getWorkSlotDetail(tenantId, slotId);
}

export async function bulkPatchWorkSlots(
  tenantId: number,
  body: {
    slot_ids: number[];
    delete?: true;
    unassign?: true;
    is_active?: boolean;
    label?: string | null;
    branch_code?: string | null;
    branch_codes?: string[];
    direction_id?: number | null;
    slot_type?: string;
    return_warehouse_id?: number | null;
    territory_zones?: string[];
    territory_oblasts?: string[];
    territory_cities?: string[];
  } & ActiveUserAttrsPatch,
  actorUserId?: number | null
) {
  const ids = [...new Set(body.slot_ids)];
  if (!ids.length) throw new Error("EMPTY_IDS");
  if (ids.length > 500) throw new Error("TOO_MANY");

  const found = await prisma.workSlot.count({
    where: { tenant_id: tenantId, id: { in: ids } }
  });
  if (found !== ids.length) throw new Error("BAD_SLOT_IDS");

  if (body.delete === true) {
    const slots = await prisma.workSlot.findMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      select: { id: true, slot_code: true, deleted_at: true }
    });
    for (const s of slots) {
      assertNotVoided(s);
    }
    await prisma.$transaction(
      slots.map((s) =>
        prisma.workSlot.update({
          where: { id: s.id },
          data: {
            ...softVoidData(actorUserId ?? null, null, { includeReason: false }),
            is_active: false,
            slot_code: voidCodeSuffix(s.slot_code, s.id, 32)
          }
        })
      )
    );
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      entityType: "work_slot",
      entityId: ids[0]!,
      action: "work_slot.void",
      payload: { slot_ids: ids, deleted: slots.length, soft: true }
    });
    return { deleted: slots.length };
  }

  if (body.unassign === true) {
    let unassigned = 0;
    let skipped_no_user = 0;
    for (const slotId of ids) {
      try {
        await unassignUserFromSlot(tenantId, slotId, actorUserId ?? null);
        unassigned++;
      } catch (e) {
        if (e instanceof Error && e.message === "NO_ACTIVE_USER") {
          skipped_no_user++;
          continue;
        }
        throw e;
      }
    }
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      entityType: "work_slot",
      entityId: ids[0]!,
      action: "work_slot.unassign",
      payload: { slot_ids: ids, unassigned, skipped_no_user }
    });
    return { unassigned, skipped_no_user };
  }

  if (body.direction_id !== undefined && body.direction_id != null) {
    const dir = await prisma.tradeDirection.findFirst({
      where: { id: body.direction_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!dir) throw new Error("BAD_DIRECTION");
  }

  if (body.return_warehouse_id != null && body.return_warehouse_id > 0) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: body.return_warehouse_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }

  const data: {
    is_active?: boolean;
    label?: string | null;
    branch_code?: string | null;
    direction_id?: number | null;
    slot_type?: string;
    return_warehouse_id?: number | null;
  } = {};
  if (body.is_active !== undefined) data.is_active = body.is_active;
  if (body.label !== undefined) data.label = body.label?.trim() || null;
  if (body.slot_type !== undefined) data.slot_type = body.slot_type;
  if (body.direction_id !== undefined) data.direction_id = body.direction_id;
  if (body.return_warehouse_id !== undefined) data.return_warehouse_id = body.return_warehouse_id;

  const branchCodes =
    body.branch_codes?.map((c) => c.trim()).filter((c): c is string => Boolean(c)) ?? [];
  const branchCodeSingle =
    body.branch_code !== undefined ? body.branch_code?.trim() || null : undefined;

  const userAttrs: ActiveUserAttrsPatch = {
    ...(body.territory_zone !== undefined ? { territory_zone: body.territory_zone } : {}),
    ...(body.territory_oblast !== undefined ? { territory_oblast: body.territory_oblast } : {}),
    ...(body.territory_city !== undefined ? { territory_city: body.territory_city } : {}),
    ...(body.warehouse_id !== undefined ? { warehouse_id: body.warehouse_id } : {}),
    ...(body.cash_desk_id !== undefined ? { cash_desk_id: body.cash_desk_id } : {})
  };

  const territoryRoundRobin = {
    ...(body.territory_zones?.length ? { territory_zones: body.territory_zones } : {}),
    ...(body.territory_oblasts?.length ? { territory_oblasts: body.territory_oblasts } : {}),
    ...(body.territory_cities?.length ? { territory_cities: body.territory_cities } : {})
  };

  const hasBranchPatch = branchCodeSingle !== undefined || branchCodes.length > 0;
  const hasSlotDataPatch = Object.keys(data).length > 0 || hasBranchPatch;
  const hasUserPatch =
    hasActiveUserAttrsPatch(userAttrs) ||
    Object.keys(territoryRoundRobin).length > 0;

  if (!hasSlotDataPatch && !hasUserPatch) {
    throw new Error("EMPTY_PATCH");
  }

  let updated = 0;
  if (Object.keys(data).length > 0) {
    const result = await prisma.workSlot.updateMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      data
    });
    updated = result.count;
  }

  if (branchCodes.length > 1) {
    for (let i = 0; i < ids.length; i++) {
      const code = branchCodes[i % branchCodes.length]!;
      await prisma.workSlot.update({
        where: { id: ids[i]!, tenant_id: tenantId },
        data: { branch_code: code }
      });
    }
    updated = ids.length;
  } else if (branchCodes.length === 1) {
    const result = await prisma.workSlot.updateMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      data: { branch_code: branchCodes[0]! }
    });
    updated = Math.max(updated, result.count);
  } else if (branchCodeSingle !== undefined) {
    const result = await prisma.workSlot.updateMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      data: { branch_code: branchCodeSingle }
    });
    updated = Math.max(updated, result.count);
  }

  let users_updated = 0;
  let skipped_no_user = 0;
  if (hasUserPatch) {
    const r = await bulkPatchActiveUsersOnSlots(
      tenantId,
      ids,
      userAttrs,
      Object.keys(territoryRoundRobin).length > 0 ? territoryRoundRobin : undefined
    );
    users_updated = r.users_updated;
    skipped_no_user = r.skipped_no_user;
  }

  if (body.return_warehouse_id !== undefined && !hasUserPatch) {
    for (const slotId of ids) {
      await prisma.$transaction(async (tx) => {
        const link = await tx.slotUserLink.findFirst({
          where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
          select: { user_id: true }
        });
        if (link) {
          await mirrorSlotConfigToUser(tx, tenantId, slotId, link.user_id);
          users_updated += 1;
        } else {
          skipped_no_user += 1;
        }
      });
    }
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    entityType: "work_slot",
    entityId: ids[0]!,
    action: "work_slot.update",
    payload: { slot_ids: ids, updated, users_updated, skipped_no_user }
  });

  return { updated, users_updated, skipped_no_user };
}

export async function restoreWorkSlots(
  tenantId: number,
  slotIds: number[],
  actorUserId?: number | null
) {
  const ids = [...new Set(slotIds)];
  if (!ids.length) throw new Error("EMPTY_IDS");
  if (ids.length > 500) throw new Error("TOO_MANY");

  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, slot_code: true, deleted_at: true }
  });
  if (slots.length !== ids.length) throw new Error("BAD_SLOT_IDS");
  for (const s of slots) assertIsVoided(s);

  await prisma.$transaction(
    slots.map((s) =>
      prisma.workSlot.update({
        where: { id: s.id },
        data: {
          ...softRestoreData({ includeReason: false }),
          is_active: true,
          slot_code: restoreVoidedCode(s.slot_code).slice(0, 32)
        }
      })
    )
  );
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    entityType: "work_slot",
    entityId: ids[0]!,
    action: "work_slot.restore",
    payload: { slot_ids: ids, restored: slots.length }
  });
  return { restored: slots.length };
}
