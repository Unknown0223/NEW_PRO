import { prisma } from "../../config/database";
import {
  applySlotConfigPatch,
  mirrorSlotConfigToUser,
  type SlotConfigPatch
} from "./work-slots.config-mirror";
import {
  applyTerritoryFieldPatch,
  buildUserTerritory
} from "./work-slots.config-territory";

export type ActiveUserAttrsPatch = {
  territory_zone?: string | null;
  territory_oblast?: string | null;
  territory_city?: string | null;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
};

export { buildUserTerritory, applyTerritoryFieldPatch };

export function hasActiveUserAttrsPatch(patch: ActiveUserAttrsPatch): boolean {
  return (
    patch.territory_zone !== undefined ||
    patch.territory_oblast !== undefined ||
    patch.territory_city !== undefined ||
    patch.warehouse_id !== undefined ||
    patch.cash_desk_id !== undefined
  );
}

export type ActiveUserTerritoryRoundRobin = {
  territory_zones?: string[];
  territory_oblasts?: string[];
  territory_cities?: string[];
};

export function hasTerritoryRoundRobin(lists: ActiveUserTerritoryRoundRobin): boolean {
  return (
    (lists.territory_zones?.length ?? 0) > 0 ||
    (lists.territory_oblasts?.length ?? 0) > 0 ||
    (lists.territory_cities?.length ?? 0) > 0
  );
}

export function resolvePerSlotUserAttrsPatch(
  index: number,
  base: ActiveUserAttrsPatch,
  lists: ActiveUserTerritoryRoundRobin
): ActiveUserAttrsPatch {
  const patch: ActiveUserAttrsPatch = { ...base };
  if (lists.territory_zones?.length) {
    patch.territory_zone = lists.territory_zones[index % lists.territory_zones.length] ?? null;
  }
  if (lists.territory_oblasts?.length) {
    patch.territory_oblast = lists.territory_oblasts[index % lists.territory_oblasts.length] ?? null;
  }
  if (lists.territory_cities?.length) {
    patch.territory_city = lists.territory_cities[index % lists.territory_cities.length] ?? null;
  }
  return patch;
}

/**
 * P0: joy maydonlari avval WorkSlot ga yoziladi, keyin faol userga mirror.
 * Faol user yo‘q bo‘lsa — faqat slot yangilanadi (NO_ACTIVE_USER emas).
 */
export async function patchActiveUserOnSlot(
  tenantId: number,
  slotId: number,
  patch: ActiveUserAttrsPatch
): Promise<number> {
  if (!hasActiveUserAttrsPatch(patch)) return 0;

  const slot = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true, territory: true }
  });
  if (!slot) throw new Error("NOT_FOUND");

  const configPatch: SlotConfigPatch = {
    territory_zone: patch.territory_zone,
    territory_oblast: patch.territory_oblast,
    territory_city: patch.territory_city,
    warehouse_id: patch.warehouse_id,
    cash_desk_id: patch.cash_desk_id
  };

  return prisma.$transaction(async (tx) => {
    await applySlotConfigPatch(tx, tenantId, slotId, configPatch, slot.territory);
    const link = await tx.slotUserLink.findFirst({
      where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
      select: { user_id: true }
    });
    if (link) {
      await mirrorSlotConfigToUser(tx, tenantId, slotId, link.user_id);
      return link.user_id;
    }
    return 0;
  });
}

export async function bulkPatchActiveUsersOnSlots(
  tenantId: number,
  slotIds: number[],
  patch: ActiveUserAttrsPatch,
  territoryRoundRobin?: ActiveUserTerritoryRoundRobin
): Promise<{ users_updated: number; skipped_no_user: number }> {
  const roundRobin = territoryRoundRobin ?? {};
  if (!hasActiveUserAttrsPatch(patch) && !hasTerritoryRoundRobin(roundRobin)) {
    return { users_updated: 0, skipped_no_user: 0 };
  }

  let users_updated = 0;
  let skipped_no_user = 0;

  for (let i = 0; i < slotIds.length; i++) {
    const slotId = slotIds[i]!;
    const perSlot = resolvePerSlotUserAttrsPatch(i, patch, roundRobin);
    if (!hasActiveUserAttrsPatch(perSlot)) continue;
    try {
      const uid = await patchActiveUserOnSlot(tenantId, slotId, perSlot);
      if (uid > 0) users_updated += 1;
      else skipped_no_user += 1;
    } catch (e) {
      if (e instanceof Error && e.message === "NO_ACTIVE_USER") {
        skipped_no_user += 1;
        continue;
      }
      throw e;
    }
  }

  return { users_updated, skipped_no_user };
}

