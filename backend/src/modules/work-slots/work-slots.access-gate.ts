import { prisma } from "../../config/database";
import { isWorkSlotType } from "./work-slots.constants";
import { getActiveSlotForUser } from "./work-slots.query.read";

/**
 * Admin va WorkSlot tipiga kirmaydigan rollar — ishchi o‘rni talab qilinmaydi.
 * Agent / collector / expeditor / skladchik / supervisor / auditor — talab qilinadi
 * (agar tenantda shu tipdagi faol slotlar bo‘lsa).
 */
export function roleRequiresWorkSlot(role: string): boolean {
  return isWorkSlotType(role);
}

/** Tenant shu rol uchun WorkSlot tizimini ishlatayaptimi. */
export async function tenantUsesWorkSlotsForRole(
  tenantId: number,
  role: string
): Promise<boolean> {
  if (!isWorkSlotType(role)) return false;
  const n = await prisma.workSlot.count({
    where: {
      tenant_id: tenantId,
      slot_type: role,
      is_active: true,
      deleted_at: null
    }
  });
  return n > 0;
}

/**
 * Rol uchun faol SlotUserLink bo‘lishi shart (tenant slot ishlatsa).
 * @throws USER_NOT_ON_SLOT
 */
export async function assertUserOnWorkSlot(
  tenantId: number,
  userId: number,
  role: string
): Promise<void> {
  if (!roleRequiresWorkSlot(role)) return;
  if (!Number.isFinite(userId) || userId < 1) return;
  if (!(await tenantUsesWorkSlotsForRole(tenantId, role))) return;
  const active = await getActiveSlotForUser(userId);
  if (active == null) {
    throw new Error("USER_NOT_ON_SLOT");
  }
}

export async function isUserMissingRequiredWorkSlot(
  tenantId: number,
  userId: number,
  role: string
): Promise<boolean> {
  try {
    await assertUserOnWorkSlot(tenantId, userId, role);
    return false;
  } catch (e) {
    return e instanceof Error && e.message === "USER_NOT_ON_SLOT";
  }
}
