import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { suggestNextSlotCode } from "./work-slots.codes";
import { getWorkSlotDetail } from "./work-slots.query";
import {
  bulkPatchActiveUsersOnSlots,
  hasActiveUserAttrsPatch,
  patchActiveUserOnSlot,
  type ActiveUserAttrsPatch
} from "./work-slots.user-attrs";

export { suggestNextSlotCode } from "./work-slots.codes";

export {
  listWorkSlots,
  getWorkSlotDetail,
  getSlotHistory
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
  }
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
    label?: string | null;
    branch_code?: string | null;
    direction_id?: number | null;
    slot_type?: string;
    is_active?: boolean;
    sort_order?: number;
  } & ActiveUserAttrsPatch
) {
  const existing = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (body.direction_id !== undefined && body.direction_id != null) {
    const dir = await prisma.tradeDirection.findFirst({
      where: { id: body.direction_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!dir) throw new Error("BAD_DIRECTION");
  }

  const slotData: Prisma.WorkSlotUpdateInput = {
    ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
    ...(body.branch_code !== undefined ? { branch_code: body.branch_code?.trim() || null } : {}),
    ...(body.direction_id !== undefined ? { direction_id: body.direction_id } : {}),
    ...(body.slot_type !== undefined ? { slot_type: body.slot_type } : {}),
    ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {})
  };

  try {
    if (Object.keys(slotData).length > 0) {
      await prisma.workSlot.update({
        where: { id: slotId },
        data: slotData
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("CODE_TAKEN");
    }
    throw e;
  }

  if (hasActiveUserAttrsPatch(body)) {
    await patchActiveUserOnSlot(tenantId, slotId, body);
  }

  return getWorkSlotDetail(tenantId, slotId);
}

export async function bulkPatchWorkSlots(
  tenantId: number,
  body: {
    slot_ids: number[];
    delete?: true;
    is_active?: boolean;
    branch_code?: string | null;
    branch_codes?: string[];
    slot_type?: string;
    territory_zones?: string[];
    territory_oblasts?: string[];
    territory_cities?: string[];
  } & ActiveUserAttrsPatch
) {
  const ids = [...new Set(body.slot_ids)];
  if (!ids.length) throw new Error("EMPTY_IDS");
  if (ids.length > 500) throw new Error("TOO_MANY");

  const found = await prisma.workSlot.count({
    where: { tenant_id: tenantId, id: { in: ids } }
  });
  if (found !== ids.length) throw new Error("BAD_SLOT_IDS");

  if (body.delete === true) {
    const result = await prisma.workSlot.deleteMany({
      where: { tenant_id: tenantId, id: { in: ids } }
    });
    return { deleted: result.count };
  }

  const data: {
    is_active?: boolean;
    branch_code?: string | null;
    slot_type?: string;
  } = {};
  if (body.is_active !== undefined) data.is_active = body.is_active;
  if (body.slot_type !== undefined) data.slot_type = body.slot_type;

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

  return { updated, users_updated, skipped_no_user };
}
