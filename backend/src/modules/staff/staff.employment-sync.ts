import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { unassignUserFromSlot } from "../work-slots/work-slots.assign";

const DEACTIVATION_NOTE = "Сотрудник деактивирован";

/**
 * `is_active` o'zgargandan keyin chaqiriladi (idempotent):
 * - nofaol + `dismissed_at` yo'q → ochiq ishchi o'rni linklari yopiladi, `dismissed_at = now`;
 * - faol + `dismissed_at` bor → `dismissed_at` tozalanadi (tarix saqlanadi).
 */
export async function syncEmploymentAfterActiveChange(
  tenantId: number,
  userIds: number[],
  actorUserId: number | null
): Promise<{ dismissed: number[]; rehired: number[] }> {
  const ids = [...new Set(userIds.filter((x) => Number.isInteger(x) && x > 0))];
  if (!ids.length) return { dismissed: [], rehired: [] };

  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, is_active: true, dismissed_at: true, hired_at: true }
  });

  const dismissed: number[] = [];
  const rehired: number[] = [];
  const now = new Date();

  for (const u of users) {
    if (!u.is_active) {
      const openLinks = await prisma.slotUserLink.findMany({
        where: { tenant_id: tenantId, user_id: u.id, ended_at: null },
        select: { slot_id: true }
      });
      for (const link of openLinks) {
        try {
          await unassignUserFromSlot(tenantId, link.slot_id, actorUserId, DEACTIVATION_NOTE);
        } catch (e) {
          if (!(e instanceof Error) || e.message !== "NO_ACTIVE_USER") throw e;
        }
      }
      if (!u.dismissed_at) {
        await prisma.user.update({ where: { id: u.id }, data: { dismissed_at: now } });
        dismissed.push(u.id);
      }
    } else if (u.dismissed_at) {
      await prisma.user.update({
        where: { id: u.id },
        data: { dismissed_at: null, ...(u.hired_at ? {} : { hired_at: now }) }
      });
      rehired.push(u.id);
    }
  }

  if (dismissed.length || rehired.length) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: dismissed.length + rehired.length === 1 ? String(dismissed[0] ?? rehired[0]) : "employment_bulk",
      action: "employment.sync",
      payload: { dismissed, rehired }
    });
  }
  return { dismissed, rehired };
}
