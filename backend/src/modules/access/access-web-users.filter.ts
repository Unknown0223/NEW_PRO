import type { Prisma } from "@prisma/client";
import { isExcludedFromAccessWebUsersList, MOBILE_ONLY_KOMANDA_ROLES } from "../../lib/tenant-user-roles";

/** Veb «Доступ» UI — mobil-only KOMANDA (agent, expeditor, …) ni chiqaradi. */
export function filterAccessWebPanelUsers<T extends { role: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isExcludedFromAccessWebUsersList(r.role));
}

/** Ruxsat biriktirish — faqat faol foydalanuvchilar (neaktivga dostup berilmaydi). */
export function filterAccessWebAssignableUsers<T extends { role: string; is_active?: boolean }>(
  rows: T[]
): T[] {
  return rows.filter((r) => !isExcludedFromAccessWebUsersList(r.role) && r.is_active !== false);
}

/** Prisma: «Доступ» scope ro‘yxatlari va sonlari uchun (agentlar kirmaydi). */
export function accessWebAssignableUserWhere(tenantId: number): Prisma.UserWhereInput {
  return {
    tenant_id: tenantId,
    is_active: true,
    role: { notIn: [...MOBILE_ONLY_KOMANDA_ROLES] }
  };
}
