import { getActiveSlotForUser, loadActiveWorkSlotsByUserIds } from "./work-slots.query.read";

/**
 * Joyga tegishli maydonlar — faol WorkSlot bor bo‘lsa staff PATCH orqali yozilmasin.
 * Manba: `/work-slots/:id` konfiguratsiya.
 */
export const WORKPLACE_STAFF_PATCH_KEYS = [
  "territory",
  "territories",
  "branch",
  "warehouse_id",
  "warehouse_ids",
  "return_warehouse_id",
  "cash_desk_id",
  "cash_desk_ids",
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
  "supervisor_user_id",
  "supervisee_agent_ids"
] as const;

export type WorkplaceStaffPatchKey = (typeof WORKPLACE_STAFF_PATCH_KEYS)[number];

export function inputHasWorkplaceStaffFields(input: Record<string, unknown>): boolean {
  return WORKPLACE_STAFF_PATCH_KEYS.some((k) => input[k] !== undefined);
}

/** Faol slotdagi xodim PATCH dan joy maydonlarini olib tashlaydi (shaxsiy maydonlar saqlanadi). */
export function stripWorkplaceStaffFields(input: Record<string, unknown>): void {
  for (const k of WORKPLACE_STAFF_PATCH_KEYS) {
    if (k in input) delete input[k];
  }
}

/**
 * Faol slot bo‘lsa joy maydonlarini yozmaydi: kartochkadan ism/login saqlash ishlashi uchun
 * workplace kalitlarini olib tashlaydi. Faqat joy sozlamalarini o‘zgartirish — «Рабочее место».
 */
export async function assertWorkplaceStaffPatchAllowed(
  userId: number,
  input: Record<string, unknown>
): Promise<void> {
  if (!inputHasWorkplaceStaffFields(input)) return;
  const slot = await getActiveSlotForUser(userId);
  if (slot != null) {
    stripWorkplaceStaffFields(input);
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
