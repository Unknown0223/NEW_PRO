import type { Prisma } from "@prisma/client";
import { slotEntitlementsFromUserEntitlements } from "./work-slots.config-mirror";

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
    price_types: (user.agent_price_types ?? []) as Prisma.InputJsonValue,
    entitlements: slotEntitlementsFromUserEntitlements(
      user.agent_entitlements
    ) as Prisma.InputJsonValue,
    consignment: user.consignment,
    consignment_limit_amount: user.consignment_limit_amount,
    consignment_ignore_previous_months_debt: user.consignment_ignore_previous_months_debt,
    consignment_close_day: user.consignment_close_day,
    consignment_close_hour: user.consignment_close_hour,
    consignment_close_minute: user.consignment_close_minute,
    supervisor_user_id: user.supervisor_user_id,
    warehouse_staff_entitlements: (user.warehouse_staff_entitlements ?? {}) as Prisma.InputJsonValue,
    expeditor_assignment_rules: (user.expeditor_assignment_rules ?? {}) as Prisma.InputJsonValue
  };
}
