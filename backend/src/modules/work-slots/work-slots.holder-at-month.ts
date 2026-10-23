import { prisma } from "../../config/database";
import { loadTenantTimezone } from "../tenant-settings/tenant-timezone";
import { tenantMonthRangeUtc } from "../../lib/workday-calendar";

/**
 * O'rinda shu oy ichida bo'lgan birinchi ega (oy boshidagi ega yoki oy o'rtasida kelgan birinchisi).
 * Oyda hech kim bo'lmasa — hozirgi ochiq link egasi (kelajak oylar uchun).
 */
export async function resolveSlotHolderForMonth(
  tenantId: number,
  slotId: number,
  range: { from: Date; to: Date },
  roles?: string[]
): Promise<number | null> {
  const userFilter = roles?.length ? { user: { role: { in: roles } } } : {};
  const inMonth = await prisma.slotUserLink.findFirst({
    where: {
      tenant_id: tenantId,
      slot_id: slotId,
      started_at: { lt: range.to },
      OR: [{ ended_at: null }, { ended_at: { gt: range.from } }],
      ...userFilter
    },
    select: { user_id: true },
    orderBy: { started_at: "asc" }
  });
  if (inMonth) return inMonth.user_id;
  const open = await prisma.slotUserLink.findFirst({
    where: { tenant_id: tenantId, slot_id: slotId, ended_at: null, ...userFilter },
    select: { user_id: true },
    orderBy: { started_at: "desc" }
  });
  return open?.user_id ?? null;
}

export type SmartCodeResolution = { userId: number; slotId: number | null };

/**
 * Xodim kodi (`users.code`) yoki ishchi o'rni kodi (`slot_code`) bo'yicha xodimni topish.
 * Slot kodi bo'lsa — shu oyda o'rinda bo'lgan odam (bo'shatilgan bo'lsa ham).
 */
export async function resolveUserBySmartCodeForMonth(
  tenantId: number,
  rawCode: string,
  opts: { year: number; month: number; roles?: string[]; slotTypes?: string[] }
): Promise<SmartCodeResolution | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const byUserCode = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      ...(opts.roles?.length ? { role: { in: opts.roles } } : {}),
      code: { equals: code, mode: "insensitive" }
    },
    select: { id: true },
    orderBy: [{ is_active: "desc" }, { id: "desc" }]
  });
  if (byUserCode) return { userId: byUserCode.id, slotId: null };

  const slot = await prisma.workSlot.findFirst({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      ...(opts.slotTypes?.length ? { slot_type: { in: opts.slotTypes } } : {}),
      slot_code: { equals: code, mode: "insensitive" }
    },
    select: { id: true }
  });
  if (!slot) return null;

  const tz = await loadTenantTimezone(tenantId);
  const range = tenantMonthRangeUtc(opts.year, opts.month, tz);
  const userId = await resolveSlotHolderForMonth(tenantId, slot.id, range, opts.roles);
  return userId != null ? { userId, slotId: slot.id } : null;
}
