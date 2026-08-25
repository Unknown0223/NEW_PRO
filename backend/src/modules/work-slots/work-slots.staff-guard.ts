import { getActiveSlotForUser, loadActiveWorkSlotsByUserIds } from "./work-slots.query.read";

/**
 * Joyga tegishli maydonlar — faol WorkSlot bor bo‘lsa staff PATCH orqali yozilmasin.
 * Manba: `/work-slots/:id` konfiguratsiya.
 */
export const WORKPLACE_STAFF_PATCH_KEYS = [
  "territory",
  "branch",
  "warehouse_id",
  "return_warehouse_id",
  "cash_desk_id",
  "trade_direction",
  "trade_direction_id",
  "price_type",
  "agent_price_types",
  "agent_entitlements",
  "consignment",
  "consignment_limit_amount",
  "consignment_ignore_previous_months_debt",
  "consignment_close_day",
  "consignment_close_hour",
  "consignment_close_minute",
  "warehouse_staff_entitlements",
  "expeditor_assignment_rules",
  "supervisor_user_id"
] as const;

export type WorkplaceStaffPatchKey = (typeof WORKPLACE_STAFF_PATCH_KEYS)[number];

export function inputHasWorkplaceStaffFields(input: Record<string, unknown>): boolean {
  return WORKPLACE_STAFF_PATCH_KEYS.some((k) => input[k] !== undefined);
}

/** Faol slotdagi xodimga joy maydonlarini yozish — `WORKPLACE_ON_SLOT`. */
export async function assertWorkplaceStaffPatchAllowed(
  userId: number,
  input: Record<string, unknown>
): Promise<void> {
  if (!inputHasWorkplaceStaffFields(input)) return;
  const slot = await getActiveSlotForUser(userId);
  if (slot != null) {
    throw new Error("WORKPLACE_ON_SLOT");
  }
}

/** Bulk: ro‘yxatda faol slot bor bo‘lsa joy maydonlarini userga yozish taqiqlanadi. */
export async function assertNoActiveSlotForWorkplaceBulk(userIds: number[]): Promise<void> {
  if (!userIds.length) return;
  const map = await loadActiveWorkSlotsByUserIds(userIds);
  if (map.size > 0) {
    throw new Error("WORKPLACE_ON_SLOT");
  }
}
