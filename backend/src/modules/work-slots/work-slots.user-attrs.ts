import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { parseUserTerritoryParts } from "./work-slots.query";

export type ActiveUserAttrsPatch = {
  territory_zone?: string | null;
  territory_oblast?: string | null;
  territory_city?: string | null;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
};

export function buildUserTerritory(parts: {
  zone?: string | null;
  oblast?: string | null;
  city?: string | null;
}): string | null {
  const arr = [parts.zone, parts.oblast, parts.city]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return arr.length > 0 ? arr.join(" / ") : null;
}

export function applyTerritoryFieldPatch(
  existing: string | null | undefined,
  patch: Pick<ActiveUserAttrsPatch, "territory_zone" | "territory_oblast" | "territory_city">
): string | null | undefined {
  const touched =
    patch.territory_zone !== undefined ||
    patch.territory_oblast !== undefined ||
    patch.territory_city !== undefined;
  if (!touched) return undefined;
  const cur = parseUserTerritoryParts(existing);
  return buildUserTerritory({
    zone: patch.territory_zone !== undefined ? patch.territory_zone : cur.zone,
    oblast: patch.territory_oblast !== undefined ? patch.territory_oblast : cur.oblast,
    city: patch.territory_city !== undefined ? patch.territory_city : cur.city
  });
}

function cashDeskLinkRoleForUser(userRole: string): string | null {
  switch (userRole) {
    case "agent":
      return "agent";
    case "collector":
      return "collector";
    case "expeditor":
      return "expeditor";
    case "supervisor":
      return "supervisor";
    case "operator":
      return "operator";
    default:
      return null;
  }
}

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

export async function patchActiveUserOnSlot(
  tenantId: number,
  slotId: number,
  patch: ActiveUserAttrsPatch
): Promise<number> {
  if (!hasActiveUserAttrsPatch(patch)) return 0;

  const link = await prisma.slotUserLink.findFirst({
    where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
    select: {
      user: {
        select: { id: true, role: true, territory: true, warehouse_id: true }
      }
    }
  });
  const user = link?.user;
  if (!user) throw new Error("NO_ACTIVE_USER");

  if (patch.warehouse_id != null && patch.warehouse_id > 0) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: patch.warehouse_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }

  if (patch.cash_desk_id != null && patch.cash_desk_id > 0) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: patch.cash_desk_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    const linkRole = cashDeskLinkRoleForUser(user.role);
    if (!linkRole) throw new Error("CASH_DESK_ROLE_UNSUPPORTED");
  }

  const data: Prisma.UserUpdateInput = {};
  const nextTerritory = applyTerritoryFieldPatch(user.territory, patch);
  if (nextTerritory !== undefined) data.territory = nextTerritory;

  if (patch.warehouse_id !== undefined) {
    data.warehouse =
      patch.warehouse_id == null ? { disconnect: true } : { connect: { id: patch.warehouse_id } };
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: user.id }, data });
    }

    if (patch.warehouse_id !== undefined) {
      if (user.role === "skladchik") {
        const whIds =
          patch.warehouse_id != null && patch.warehouse_id > 0 ? [patch.warehouse_id] : [];
        await tx.warehouseUserLink.deleteMany({
          where: { user_id: user.id, link_role: "skladchik" }
        });
        if (whIds.length > 0) {
          await tx.warehouseUserLink.createMany({
            data: whIds.map((warehouse_id) => ({
              warehouse_id,
              user_id: user.id,
              link_role: "skladchik"
            }))
          });
        }
      }
    }

    if (patch.cash_desk_id !== undefined) {
      await tx.cashDeskUserLink.deleteMany({ where: { user_id: user.id } });
      if (patch.cash_desk_id != null && patch.cash_desk_id > 0) {
        const linkRole = cashDeskLinkRoleForUser(user.role);
        if (!linkRole) throw new Error("CASH_DESK_ROLE_UNSUPPORTED");
        await tx.cashDeskUserLink.create({
          data: {
            cash_desk_id: patch.cash_desk_id,
            user_id: user.id,
            link_role: linkRole
          }
        });
      }
    }
  });

  return user.id;
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
      await patchActiveUserOnSlot(tenantId, slotId, perSlot);
      users_updated += 1;
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
