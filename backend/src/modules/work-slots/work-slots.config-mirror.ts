import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import { extractMobileConfigFromEntitlementsUnknown } from "../staff/agent-mobile-config.parse";
import {
  applyTerritoryFieldPatch,
  buildUserTerritory,
  parseUserTerritoryPartsFromHelpers
} from "./work-slots.config-territory";
import {
  buildTerritoriesFromPartLists,
  effectiveBranchCodes,
  effectiveCashDeskIds,
  effectiveTerritories,
  effectiveWarehouseIds,
  findCityParentsInTerritoryTree,
  findOblastParentsInTerritoryTree,
  resolveCashDeskIdsPatch,
  resolveTerritoriesPatch,
  resolveWarehouseIdsPatch
} from "./work-slots.multi-bindings";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { territoryNodesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { referencesWithResolvedTerritoryNodes } from "../tenant-settings/tenant-settings.territory";

/**
 * Slot entitlements → user mirror.
 * `mobile_config` endi joy manbasi; slotda yo‘q bo‘lsa vaqtincha user fallback.
 */
export function mergeSlotEntitlementsPreservingMobileConfig(
  slotEntitlements: Prisma.JsonValue | null | undefined,
  userEntitlements: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  const slotObj =
    slotEntitlements && typeof slotEntitlements === "object" && !Array.isArray(slotEntitlements)
      ? { ...(slotEntitlements as Record<string, unknown>) }
      : {};
  const slotMobile = extractMobileConfigFromEntitlementsUnknown(slotEntitlements);
  if (slotMobile) {
    slotObj.mobile_config = slotMobile;
    return slotObj;
  }
  const userMobile = extractMobileConfigFromEntitlementsUnknown(userEntitlements);
  if (userMobile) slotObj.mobile_config = userMobile;
  else delete slotObj.mobile_config;
  return slotObj;
}

/** User → slot backfill: mobile_config ham joyga ko‘chiriladi. */
export function slotEntitlementsFromUserEntitlements(
  userEntitlements: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  const obj =
    userEntitlements && typeof userEntitlements === "object" && !Array.isArray(userEntitlements)
      ? { ...(userEntitlements as Record<string, unknown>) }
      : {};
  return obj;
}

/** Slotdan chiqganda user entitlements dan joy (shu jumladan mobile_config) tozalanadi. */
export function personalEntitlementsAfterClearWorkplace(
  userEntitlements: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  void userEntitlements;
  return {};
}

export type Tx = Prisma.TransactionClient;

export type SlotWorkplaceConfigRow = {
  territory: string | null;
  territories: string[];
  warehouse_id: number | null;
  warehouse_ids: number[];
  return_warehouse_id: number | null;
  cash_desk_id: number | null;
  cash_desk_ids: number[];
  price_type: string | null;
  price_types: Prisma.JsonValue;
  entitlements: Prisma.JsonValue;
  consignment: boolean;
  consignment_limit_amount: Prisma.Decimal | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
  supervisor_user_id: number | null;
  warehouse_staff_entitlements: Prisma.JsonValue;
  expeditor_assignment_rules: Prisma.JsonValue;
  branch_code: string | null;
  branch_codes: string[];
  direction_id: number | null;
};

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
    case "director":
    case "sales_director":
    case "commercial_director":
    case "regional_manager":
    case "manager":
      return userRole;
    default:
      return null;
  }
}

/** Ombor bog‘lamasi — dastavchik/agent/direktor joy omborlari linkage da ko‘rinsin. */
export function warehouseLinkRoleForUser(userRole: string): string | null {
  if (userRole === "skladchik") return "skladchik";
  return cashDeskLinkRoleForUser(userRole);
}

const SLOT_CONFIG_SELECT = {
  territory: true,
  territories: true,
  warehouse_id: true,
  warehouse_ids: true,
  return_warehouse_id: true,
  cash_desk_id: true,
  cash_desk_ids: true,
  price_type: true,
  price_types: true,
  entitlements: true,
  consignment: true,
  consignment_limit_amount: true,
  consignment_ignore_previous_months_debt: true,
  consignment_close_day: true,
  consignment_close_hour: true,
  consignment_close_minute: true,
  supervisor_user_id: true,
  warehouse_staff_entitlements: true,
  expeditor_assignment_rules: true,
  branch_code: true,
  branch_codes: true,
  direction_id: true
} as const;

/** Slot joy sozlamalarini faol userga nusxa qiladi (dual-write o‘qish uchun). */
export async function mirrorSlotConfigToUser(
  tx: Tx,
  tenantId: number,
  slotId: number,
  userId: number
): Promise<void> {
  const [slot, user] = await Promise.all([
    tx.workSlot.findFirst({
      where: { id: slotId, tenant_id: tenantId },
      select: SLOT_CONFIG_SELECT
    }),
    tx.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, role: true, agent_entitlements: true }
    })
  ]);
  if (!slot || !user) return;

  const warehouseIds = effectiveWarehouseIds(slot);
  const cashDeskIds = effectiveCashDeskIds(slot);
  const territories = effectiveTerritories(slot);
  const primaryWarehouseId = warehouseIds[0] ?? null;
  const primaryTerritory = territories[0] ?? null;

  const directionName =
    slot.direction_id != null
      ? (
          await tx.tradeDirection.findFirst({
            where: { id: slot.direction_id, tenant_id: tenantId },
            select: { name: true }
          })
        )?.name ?? null
      : null;

  const mergedEntitlements = mergeSlotEntitlementsPreservingMobileConfig(
    slot.entitlements,
    user.agent_entitlements
  );

  const data: Prisma.UserUpdateInput = {
    // Bir nechta territories[] bo‘lsa primary ni yozamiz; to‘liq ro‘yxat slotda qoladi.
    territory: primaryTerritory,
    branch: slot.branch_code,
    trade_direction: directionName,
    price_type: slot.price_type,
    agent_price_types: slot.price_types ?? [],
    agent_entitlements: mergedEntitlements as Prisma.InputJsonValue,
    consignment: slot.consignment,
    consignment_limit_amount: slot.consignment_limit_amount,
    consignment_ignore_previous_months_debt: slot.consignment_ignore_previous_months_debt,
    consignment_close_day: slot.consignment_close_day,
    consignment_close_hour: slot.consignment_close_hour,
    consignment_close_minute: slot.consignment_close_minute,
    warehouse_staff_entitlements: slot.warehouse_staff_entitlements ?? {},
    expeditor_assignment_rules: slot.expeditor_assignment_rules ?? {},
    warehouse:
      primaryWarehouseId == null
        ? { disconnect: true }
        : { connect: { id: primaryWarehouseId } },
    return_warehouse:
      slot.return_warehouse_id == null
        ? { disconnect: true }
        : { connect: { id: slot.return_warehouse_id } },
    trade_direction_row:
      slot.direction_id == null
        ? { disconnect: true }
        : { connect: { id: slot.direction_id } }
  };
  if (slot.supervisor_user_id != null) {
    data.supervisor = { connect: { id: slot.supervisor_user_id } };
  }

  await tx.user.update({
    where: { id: userId },
    data
  });

  const warehouseLinkRole = warehouseLinkRoleForUser(user.role);
  if (warehouseLinkRole) {
    await tx.warehouseUserLink.deleteMany({
      where: { user_id: userId }
    });
    if (warehouseIds.length > 0) {
      await tx.warehouseUserLink.createMany({
        data: warehouseIds.map((warehouse_id) => ({
          warehouse_id,
          user_id: userId,
          link_role: warehouseLinkRole
        })),
        skipDuplicates: true
      });
    }
  }

  await tx.cashDeskUserLink.deleteMany({ where: { user_id: userId } });
  if (cashDeskIds.length > 0) {
    const linkRole = cashDeskLinkRoleForUser(user.role);
    if (linkRole) {
      await tx.cashDeskUserLink.createMany({
        data: cashDeskIds.map((cash_desk_id) => ({
          cash_desk_id,
          user_id: userId,
          link_role: linkRole
        })),
        skipDuplicates: true
      });
    }
  }

  const branchCodes = effectiveBranchCodes(slot);
  await tx.userBranchLink.deleteMany({ where: { tenant_id: tenantId, user_id: userId } });
  if (branchCodes.length > 0) {
    await tx.userBranchLink.createMany({
      data: branchCodes.map((branch_code) => ({ tenant_id: tenantId, user_id: userId, branch_code })),
      skipDuplicates: true
    });
  }
}

/** Slotdan chiqqanda joy maydonlarini userdan tozalaydi (login/FIO/role saqlanadi). */
export async function clearWorkplaceFieldsOnUser(
  tx: Tx,
  tenantId: number,
  userId: number
): Promise<void> {
  const user = await tx.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { id: true, agent_entitlements: true }
  });
  if (!user) return;

  const clearedEntitlements = personalEntitlementsAfterClearWorkplace(user.agent_entitlements);

  // supervisor_user_id va territory_user_links tegilmaydi — ular staff/SVR jamoa va access
  // scope manbalari; joydan chiqish ularni «tasodifan» uzmasligi kerak.
  await tx.user.update({
    where: { id: userId },
    data: {
      territory: null,
      branch: null,
      trade_direction: null,
      price_type: null,
      agent_price_types: [],
      agent_entitlements: clearedEntitlements as Prisma.InputJsonValue,
      consignment: false,
      consignment_limit_amount: null,
      consignment_ignore_previous_months_debt: false,
      consignment_close_day: 25,
      consignment_close_hour: 0,
      consignment_close_minute: 0,
      warehouse_staff_entitlements: {},
      expeditor_assignment_rules: {},
      warehouse: { disconnect: true },
      return_warehouse: { disconnect: true },
      trade_direction_row: { disconnect: true }
    }
  });

  await tx.warehouseUserLink.deleteMany({ where: { user_id: userId } });
  await tx.cashDeskUserLink.deleteMany({ where: { user_id: userId } });
  await tx.userBranchLink.deleteMany({ where: { tenant_id: tenantId, user_id: userId } });
}

export type SlotConfigPatch = {
  territory_zone?: string | null;
  territory_oblast?: string | null;
  territory_city?: string | null;
  territory_zones?: string[];
  territory_oblasts?: string[];
  territory_cities?: string[];
  territories?: string[] | null;
  warehouse_id?: number | null;
  warehouse_ids?: number[] | null;
  return_warehouse_id?: number | null;
  cash_desk_id?: number | null;
  cash_desk_ids?: number[] | null;
  price_type?: string | null;
  price_types?: unknown;
  entitlements?: unknown;
  consignment?: boolean;
  consignment_limit_amount?: number | null;
  consignment_ignore_previous_months_debt?: boolean;
  consignment_close_day?: number;
  consignment_close_hour?: number;
  consignment_close_minute?: number;
  supervisor_user_id?: number | null;
  warehouse_staff_entitlements?: unknown;
  expeditor_assignment_rules?: unknown;
};

export function hasSlotConfigPatch(p: SlotConfigPatch): boolean {
  return (
    p.territory_zone !== undefined ||
    p.territory_oblast !== undefined ||
    p.territory_city !== undefined ||
    p.territory_zones !== undefined ||
    p.territory_oblasts !== undefined ||
    p.territory_cities !== undefined ||
    p.territories !== undefined ||
    p.warehouse_id !== undefined ||
    p.warehouse_ids !== undefined ||
    p.return_warehouse_id !== undefined ||
    p.cash_desk_id !== undefined ||
    p.cash_desk_ids !== undefined ||
    p.price_type !== undefined ||
    p.price_types !== undefined ||
    p.entitlements !== undefined ||
    p.consignment !== undefined ||
    p.consignment_limit_amount !== undefined ||
    p.consignment_ignore_previous_months_debt !== undefined ||
    p.consignment_close_day !== undefined ||
    p.consignment_close_hour !== undefined ||
    p.consignment_close_minute !== undefined ||
    p.supervisor_user_id !== undefined ||
    p.warehouse_staff_entitlements !== undefined ||
    p.expeditor_assignment_rules !== undefined
  );
}

/** Joy maydonlarini WorkSlot ga yozadi (manba). */
export async function applySlotConfigPatch(
  tx: Tx,
  tenantId: number,
  slotId: number,
  patch: SlotConfigPatch,
  existingTerritory: string | null
): Promise<void> {
  if (!hasSlotConfigPatch(patch)) return;

  const existing = await tx.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: {
      territory: true,
      territories: true,
      warehouse_id: true,
      warehouse_ids: true,
      cash_desk_id: true,
      cash_desk_ids: true
    }
  });
  if (!existing) return;

  const existingTerritoryValue = existing.territory ?? existingTerritory;

  const warehouseResolved = resolveWarehouseIdsPatch({
    existingIds: existing.warehouse_ids ?? [],
    existingPrimary: existing.warehouse_id,
    warehouse_ids: patch.warehouse_ids,
    warehouse_id: patch.warehouse_id
  });
  const cashResolved = resolveCashDeskIdsPatch({
    existingIds: existing.cash_desk_ids ?? [],
    existingPrimary: existing.cash_desk_id,
    cash_desk_ids: patch.cash_desk_ids,
    cash_desk_id: patch.cash_desk_id
  });

  const hasTerritoryPartLists =
    (patch.territory_zones?.length ?? 0) > 0 ||
    (patch.territory_oblasts?.length ?? 0) > 0 ||
    (patch.territory_cities?.length ?? 0) > 0;

  let territoriesResolved:
    | { territories: string[]; territory: string | null }
    | undefined;

  if (patch.territories !== undefined) {
    territoriesResolved = resolveTerritoriesPatch({
      existingList: existing.territories ?? [],
      existingPrimary: existingTerritoryValue,
      territories: patch.territories,
      territory: undefined
    });
  } else if (hasTerritoryPartLists) {
    const tenantRow = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });
    const settings = asRecord(tenantRow?.settings);
    const refInner = asRecord(settings.references);
    const refT = referencesWithResolvedTerritoryNodes(refInner);
    const territoryNodes = territoryNodesFromUnknown(refT.territory_nodes);
    const built = buildTerritoriesFromPartLists({
      zones: patch.territory_zones,
      oblasts: patch.territory_oblasts,
      cities: patch.territory_cities,
      resolveCityParents: (city) => findCityParentsInTerritoryTree(territoryNodes, city),
      resolveOblastParents: (oblast) => findOblastParentsInTerritoryTree(territoryNodes, oblast)
    });
    territoriesResolved = {
      territories: built,
      territory: built[0] ?? null
    };
  } else {
    const nextTerritory = applyTerritoryFieldPatch(existingTerritoryValue, patch);
    if (nextTerritory !== undefined) {
      territoriesResolved = resolveTerritoriesPatch({
        existingList: existing.territories ?? [],
        existingPrimary: existingTerritoryValue,
        territories: undefined,
        territory: nextTerritory,
        replacePrimary: true
      });
    }
  }

  const warehouseIdsToCheck = warehouseResolved?.warehouse_ids ?? [];
  if (warehouseIdsToCheck.length > 0) {
    const found = await tx.warehouse.count({
      where: { tenant_id: tenantId, id: { in: warehouseIdsToCheck } }
    });
    if (found !== warehouseIdsToCheck.length) throw new Error("BAD_WAREHOUSE");
  }
  if (patch.return_warehouse_id != null && patch.return_warehouse_id > 0) {
    const wh = await tx.warehouse.findFirst({
      where: { id: patch.return_warehouse_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  const cashIdsToCheck = cashResolved?.cash_desk_ids ?? [];
  if (cashIdsToCheck.length > 0) {
    const found = await tx.cashDesk.count({
      where: { tenant_id: tenantId, id: { in: cashIdsToCheck } }
    });
    if (found !== cashIdsToCheck.length) throw new Error("BAD_CASH_DESK");
  }

  const data: Prisma.WorkSlotUncheckedUpdateInput = {
    ...(territoriesResolved
      ? { territory: territoriesResolved.territory, territories: territoriesResolved.territories }
      : {}),
    ...(warehouseResolved
      ? {
          warehouse_id: warehouseResolved.warehouse_id,
          warehouse_ids: warehouseResolved.warehouse_ids
        }
      : {}),
    ...(patch.return_warehouse_id !== undefined
      ? { return_warehouse_id: patch.return_warehouse_id }
      : {}),
    ...(cashResolved
      ? {
          cash_desk_id: cashResolved.cash_desk_id,
          cash_desk_ids: cashResolved.cash_desk_ids
        }
      : {}),
    ...(patch.price_type !== undefined ? { price_type: patch.price_type?.trim() || null } : {}),
    ...(patch.price_types !== undefined
      ? { price_types: patch.price_types as Prisma.InputJsonValue }
      : {}),
    ...(patch.entitlements !== undefined
      ? { entitlements: patch.entitlements as Prisma.InputJsonValue }
      : {}),
    ...(patch.consignment !== undefined ? { consignment: patch.consignment } : {}),
    ...(patch.consignment_limit_amount !== undefined
      ? {
          consignment_limit_amount:
            patch.consignment_limit_amount == null
              ? null
              : new PrismaNS.Decimal(patch.consignment_limit_amount)
        }
      : {}),
    ...(patch.consignment_ignore_previous_months_debt !== undefined
      ? { consignment_ignore_previous_months_debt: patch.consignment_ignore_previous_months_debt }
      : {}),
    ...(patch.consignment_close_day !== undefined
      ? { consignment_close_day: patch.consignment_close_day }
      : {}),
    ...(patch.consignment_close_hour !== undefined
      ? { consignment_close_hour: patch.consignment_close_hour }
      : {}),
    ...(patch.consignment_close_minute !== undefined
      ? { consignment_close_minute: patch.consignment_close_minute }
      : {}),
    ...(patch.supervisor_user_id !== undefined
      ? { supervisor_user_id: patch.supervisor_user_id }
      : {}),
    ...(patch.warehouse_staff_entitlements !== undefined
      ? {
          warehouse_staff_entitlements: patch.warehouse_staff_entitlements as Prisma.InputJsonValue
        }
      : {}),
    ...(patch.expeditor_assignment_rules !== undefined
      ? {
          expeditor_assignment_rules: patch.expeditor_assignment_rules as Prisma.InputJsonValue
        }
      : {})
  };

  // Ограничения → denormalized price_types (agent_price_types mirror bilan mos).
  if (
    patch.entitlements !== undefined &&
    patch.price_types === undefined &&
    patch.entitlements != null &&
    typeof patch.entitlements === "object" &&
    !Array.isArray(patch.entitlements) &&
    Array.isArray((patch.entitlements as Record<string, unknown>).price_types)
  ) {
    const pts = (patch.entitlements as Record<string, unknown>).price_types as unknown[];
    data.price_types = pts.filter((x): x is string => typeof x === "string") as Prisma.InputJsonValue;
  }

  await tx.workSlot.update({ where: { id: slotId }, data });
}

export { buildUserTerritory, parseUserTerritoryPartsFromHelpers as parseTerritoryParts };
