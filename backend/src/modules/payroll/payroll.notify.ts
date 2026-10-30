import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { createNotification } from "../notifications/notifications.service";

type NotifyMsg = { title: string; body?: string | null; href?: string | null };

/** Ruxsat egalari (admin + rol/shaxsiy allow). Hech qachon xato tashlamaydi. */
export async function findPermissionHolderIds(tenantId: number, keys: string[]): Promise<number[]> {
  const roleKeys = (
    await prisma.role.findMany({
      where: { tenant_id: tenantId, permissions: { some: { permission: { key: { in: keys } } } } },
      select: { key: true }
    })
  ).map((r) => r.key);
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      OR: [
        { role: "admin" },
        { role: { in: roleKeys } },
        { user_roles: { some: { role: { key: { in: roleKeys } } } } },
        { user_permissions: { some: { effect: "allow", permission: { key: { in: keys } } } } }
      ]
    },
    select: { id: true },
    take: 200
  });
  return users.map((u) => u.id);
}

export async function notifyUsers(tenantId: number, userIds: number[], msg: NotifyMsg): Promise<void> {
  const uniq = [...new Set(userIds.filter((x) => Number.isInteger(x) && x > 0))];
  for (const uid of uniq) {
    try {
      await createNotification({ tenant_id: tenantId, user_id: uid, title: msg.title, body: msg.body, link_href: msg.href });
    } catch (e) {
      logger.warn({ err: e, tenantId, uid }, "payroll notify failed");
    }
  }
}

export function notifyPermissionHolders(tenantId: number, keys: string[], msg: NotifyMsg, exceptUserId?: number | null): void {
  void (async () => {
    try {
      const ids = (await findPermissionHolderIds(tenantId, keys)).filter((id) => id !== exceptUserId);
      await notifyUsers(tenantId, ids, msg);
    } catch (e) {
      logger.warn({ err: e, tenantId }, "payroll notifyPermissionHolders failed");
    }
  })();
}
