import { assertUserOnWorkSlot, tenantUsesWorkSlotsForRole } from "./work-slots.access-gate";
import { loadActiveWorkSlotsByUserIds } from "./work-slots.query.read";

export async function tenantUsesExpeditorWorkSlots(tenantId: number): Promise<boolean> {
  return tenantUsesWorkSlotsForRole(tenantId, "expeditor");
}

/**
 * Tenant expeditor slot ishlatsa — faqat faol slotdagi foydalanuvchilar.
 * Slot ishlatilmasa (legacy) — ro‘yxat o‘zgarmaydi.
 */
export async function filterUsersOnActiveWorkSlot<T extends { id: number }>(
  usesSlots: boolean,
  rows: T[]
): Promise<T[]> {
  if (!usesSlots || rows.length === 0) return rows;
  const onSlot = await loadActiveWorkSlotsByUserIds(rows.map((r) => r.id));
  return rows.filter((r) => onSlot.has(r.id));
}

/** Staff / expeditor ro‘yxatlari uchun — `filterUsersOnActiveWorkSlot` aliasi. */
export async function filterStaffOnActiveWorkSlot<T extends { id: number }>(
  usesSlots: boolean,
  rows: T[]
): Promise<T[]> {
  return filterUsersOnActiveWorkSlot(usesSlots, rows);
}

/** Yangi zakazga dastavchik biriktirish uchun — tenant slot ishlatsa faol joy shart. */
export async function assertExpeditorCanTakeNewWork(
  tenantId: number,
  expeditorUserId: number | null | undefined
): Promise<void> {
  if (expeditorUserId == null || !Number.isFinite(expeditorUserId) || expeditorUserId < 1) return;
  try {
    await assertUserOnWorkSlot(tenantId, expeditorUserId, "expeditor");
  } catch (e) {
    if (e instanceof Error && e.message === "USER_NOT_ON_SLOT") {
      throw new Error("EXPEDITOR_NOT_ON_SLOT");
    }
    throw e;
  }
}
