import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import {
  applyTerritoryFieldPatch,
  buildUserTerritory,
  parseUserTerritoryPartsFromHelpers
} from "./work-slots.config-territory";

export type Tx = Prisma.TransactionClient;

export type SlotWorkplaceConfigRow = {
  territory: string | null;
  warehouse_id: number | null;
  return_warehouse_id: number | null;
  cash_desk_id: number | null;
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
    default:
      return null;
  }
}

const SLOT_CONFIG_SELECT = {
  territory: true,
  warehouse_id: true,
  return_warehouse_id: true,
  cash_desk_id: true,
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
      select: { id: true, role: true }
    })
  ]);
  if (!slot || !user) return;

  const directionName =
    slot.direction_id != null
      ? (
          await tx.tradeDirection.findFirst({
            where: { id: slot.direction_id, tenant_id: tenantId },
            select: { name: true }
          })
        )?.name ?? null
      : null;

  await tx.user.update({
    where: { id: userId },
    data: {
      territory: slot.territory,
      branch: slot.branch_code,
      trade_direction: directionName,
      price_type: slot.price_type,
      agent_price_types: slot.price_types ?? [],
      agent_entitlements: slot.entitlements ?? {},
      consignment: slot.consignment,
      consignment_limit_amount: slot.consignment_limit_amount,
      consignment_ignore_previous_months_debt: slot.consignment_ignore_previous_months_debt,
      consignment_close_day: slot.consignment_close_day,
      consignment_close_hour: slot.consignment_close_hour,
      consignment_close_minute: slot.consignment_close_minute,
      warehouse_staff_entitlements: slot.warehouse_staff_entitlements ?? {},
      expeditor_assignment_rules: slot.expeditor_assignment_rules ?? {},
      warehouse:
        slot.warehouse_id == null ? { disconnect: true } : { connect: { id: slot.warehouse_id } },
      return_warehouse:
        slot.return_warehouse_id == null
          ? { disconnect: true }
          : { connect: { id: slot.return_warehouse_id } },
      trade_direction_row:
        slot.direction_id == null
          ? { disconnect: true }
          : { connect: { id: slot.direction_id } },
      supervisor:
        slot.supervisor_user_id == null
          ? { disconnect: true }
          : { connect: { id: slot.supervisor_user_id } }
    }
  });

  if (user.role === "skladchik") {
    await tx.warehouseUserLink.deleteMany({
      where: { user_id: userId, link_role: "skladchik" }
    });
    if (slot.warehouse_id != null && slot.warehouse_id > 0) {
      await tx.warehouseUserLink.create({
        data: {
          warehouse_id: slot.warehouse_id,
          user_id: userId,
          link_role: "skladchik"
        }
      });
    }
  }

  await tx.cashDeskUserLink.deleteMany({ where: { user_id: userId } });
  if (slot.cash_desk_id != null && slot.cash_desk_id > 0) {
    const linkRole = cashDeskLinkRoleForUser(user.role);
    if (linkRole) {
      await tx.cashDeskUserLink.create({
        data: {
          cash_desk_id: slot.cash_desk_id,
          user_id: userId,
          link_role: linkRole
        }
      });
    }
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
    select: { id: true }
  });
  if (!user) return;

  await tx.user.update({
    where: { id: userId },
    data: {
      territory: null,
      branch: null,
      trade_direction: null,
      price_type: null,
      agent_price_types: [],
      agent_entitlements: {},
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
      trade_direction_row: { disconnect: true },
      supervisor: { disconnect: true }
    }
  });

  await tx.warehouseUserLink.deleteMany({ where: { user_id: userId } });
  await tx.cashDeskUserLink.deleteMany({ where: { user_id: userId } });
}

export type SlotConfigPatch = {
  territory_zone?: string | null;
  territory_oblast?: string | null;
  territory_city?: string | null;
  warehouse_id?: number | null;
  return_warehouse_id?: number | null;
  cash_desk_id?: number | null;
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
    p.warehouse_id !== undefined ||
    p.return_warehouse_id !== undefined ||
    p.cash_desk_id !== undefined ||
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

  if (patch.warehouse_id != null && patch.warehouse_id > 0) {
    const wh = await tx.warehouse.findFirst({
      where: { id: patch.warehouse_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  if (patch.return_warehouse_id != null && patch.return_warehouse_id > 0) {
    const wh = await tx.warehouse.findFirst({
      where: { id: patch.return_warehouse_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  if (patch.cash_desk_id != null && patch.cash_desk_id > 0) {
    const desk = await tx.cashDesk.findFirst({
      where: { id: patch.cash_desk_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
  }

  const nextTerritory = applyTerritoryFieldPatch(existingTerritory, patch);

  const data: Prisma.WorkSlotUncheckedUpdateInput = {
    ...(nextTerritory !== undefined ? { territory: nextTerritory } : {}),
    ...(patch.warehouse_id !== undefined ? { warehouse_id: patch.warehouse_id } : {}),
    ...(patch.return_warehouse_id !== undefined
      ? { return_warehouse_id: patch.return_warehouse_id }
      : {}),
    ...(patch.cash_desk_id !== undefined ? { cash_desk_id: patch.cash_desk_id } : {}),
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

  await tx.workSlot.update({ where: { id: slotId }, data });
}

/** Backfill: user → slot (faqat bo‘sh slot maydonlari). */
export function buildSlotConfigFromUser(user: {
  territory: string | null;
  warehouse_id: number | null;
  return_warehouse_id: number | null;
  price_type: string | null;
  agent_price_types: Prisma.JsonValue;
  agent_entitlements: Prisma.JsonValue;
  consignment: boolean;
  consignment_limit_amount: Prisma.Decimal | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
  supervisor_user_id: number | null;
  warehouse_staff_entitlements: Prisma.JsonValue;
  expeditor_assignment_rules: Prisma.JsonValue;
  cash_desk_id?: number | null;
}): Prisma.WorkSlotUncheckedUpdateInput {
  return {
    territory: user.territory,
    warehouse_id: user.warehouse_id,
    return_warehouse_id: user.return_warehouse_id,
    cash_desk_id: user.cash_desk_id ?? null,
    price_type: user.price_type,
    price_types: user.agent_price_types ?? [],
    entitlements: user.agent_entitlements ?? {},
    consignment: user.consignment,
    consignment_limit_amount: user.consignment_limit_amount,
    consignment_ignore_previous_months_debt: user.consignment_ignore_previous_months_debt,
    consignment_close_day: user.consignment_close_day,
    consignment_close_hour: user.consignment_close_hour,
    consignment_close_minute: user.consignment_close_minute,
    supervisor_user_id: user.supervisor_user_id,
    warehouse_staff_entitlements: user.warehouse_staff_entitlements ?? {},
    expeditor_assignment_rules: user.expeditor_assignment_rules ?? {}
  };
}

export { buildUserTerritory, parseUserTerritoryPartsFromHelpers as parseTerritoryParts };
