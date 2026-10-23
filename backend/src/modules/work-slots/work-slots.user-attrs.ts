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
import { buildTerritoriesFromPartLists } from "./work-slots.multi-bindings";

export type ActiveUserAttrsPatch = {
  territory_zone?: string | null;
  territory_oblast?: string | null;
  territory_city?: string | null;
  territories?: string[] | null;
  warehouse_id?: number | null;
  warehouse_ids?: number[] | null;
  cash_desk_id?: number | null;
  cash_desk_ids?: number[] | null;
  /** Faqat faol User ga yoziladi (slot ustunlari yo‘q). */
  position?: string | null;
  app_access?: boolean;
  max_sessions?: number;
};

export { buildUserTerritory, applyTerritoryFieldPatch };

export function hasWorkplaceGeoAttrsPatch(patch: ActiveUserAttrsPatch): boolean {
  return (
    patch.territory_zone !== undefined ||
    patch.territory_oblast !== undefined ||
    patch.territory_city !== undefined ||
    patch.territories !== undefined ||
    patch.warehouse_id !== undefined ||
    patch.warehouse_ids !== undefined ||
    patch.cash_desk_id !== undefined ||
    patch.cash_desk_ids !== undefined
  );
}

/** Occupant User maydonlari — KOMANDA UI dan ko‘chirilgan (должность / app / сессии). */
export function hasOccupantUserAttrsPatch(patch: ActiveUserAttrsPatch): boolean {
  return (
    patch.position !== undefined ||
    patch.app_access !== undefined ||
    patch.max_sessions !== undefined
  );
}

export function hasActiveUserAttrsPatch(patch: ActiveUserAttrsPatch): boolean {
  return hasWorkplaceGeoAttrsPatch(patch) || hasOccupantUserAttrsPatch(patch);
}

export function occupantUserUpdateData(patch: ActiveUserAttrsPatch): {
  position?: string | null;
  app_access?: boolean;
  max_sessions?: number;
} {
  return {
    ...(patch.position !== undefined ? { position: patch.position?.trim() || null } : {}),
    ...(patch.app_access !== undefined ? { app_access: patch.app_access } : {}),
    ...(patch.max_sessions !== undefined ? { max_sessions: patch.max_sessions } : {})
  };
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

/** Multi territory: bir xil ro‘yxat har bir slotga (round-robin o‘rniga). */
export function resolvePerSlotUserAttrsPatch(
  _index: number,
  base: ActiveUserAttrsPatch,
  lists: ActiveUserTerritoryRoundRobin
): ActiveUserAttrsPatch {
  const patch: ActiveUserAttrsPatch = { ...base };
  if (hasTerritoryRoundRobin(lists)) {
    const built = buildTerritoriesFromPartLists({
      zones: lists.territory_zones,
      oblasts: lists.territory_oblasts,
      cities: lists.territory_cities
    });
    patch.territories = built;
    // singular parts — primary (birinchi)
    delete patch.territory_zone;
    delete patch.territory_oblast;
    delete patch.territory_city;
  }
  return patch;
}

/**
 * P0: joy maydonlari avval WorkSlot ga yoziladi, keyin faol userga mirror.
 * Occupant position/app_access/max_sessions — to‘g‘ridan-to‘g‘ri User ga.
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
    territories: patch.territories,
    warehouse_id: patch.warehouse_id,
    warehouse_ids: patch.warehouse_ids,
    cash_desk_id: patch.cash_desk_id,
    cash_desk_ids: patch.cash_desk_ids
  };

  return prisma.$transaction(async (tx) => {
    if (hasWorkplaceGeoAttrsPatch(patch)) {
      await applySlotConfigPatch(tx, tenantId, slotId, configPatch, slot.territory);
    }
    const link = await tx.slotUserLink.findFirst({
      where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
      select: { user_id: true }
    });
    if (link) {
      if (hasWorkplaceGeoAttrsPatch(patch)) {
        await mirrorSlotConfigToUser(tx, tenantId, slotId, link.user_id);
      }
      if (hasOccupantUserAttrsPatch(patch)) {
        await tx.user.update({
          where: { id: link.user_id },
          data: occupantUserUpdateData(patch)
        });
      }
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
