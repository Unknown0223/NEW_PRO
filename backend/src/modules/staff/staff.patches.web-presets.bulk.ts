import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { WEB_PANEL_STAFF_ROLES } from "../../lib/tenant-user-roles";

export async function bulkRevokeWebPanelStaffSessions(
  tenantId: number,
  userIds: number[],
  actorUserId: number | null = null
): Promise<void> {
  const uniq = [...new Set(userIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!uniq.length) throw new Error("EMPTY_IDS");

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: uniq },
      role: { in: [...WEB_PANEL_STAFF_ROLES] }
    },
    select: { id: true }
  });
  if (users.length !== uniq.length) throw new Error("BAD_USER_IDS");

  const now = new Date();
  await prisma.refreshToken.updateMany({
    where: {
      tenant_id: tenantId,
      user_id: { in: uniq },
      revoked_at: null
    },
    data: { revoked_at: now }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: "web_panel_bulk",
    action: "sessions.bulk_revoke",
    payload: { user_ids: uniq }
  });
}

export async function bulkPatchWebPanelStaffMaxSessions(
  tenantId: number,
  updates: { user_id: number; max_sessions: number }[],
  actorUserId: number | null = null
): Promise<void> {
  if (!updates.length) throw new Error("EMPTY_IDS");
  if (updates.length > 200) throw new Error("TOO_MANY_UPDATES");

  const byUser = new Map<number, number>();
  for (const u of updates) {
    if (!Number.isInteger(u.user_id) || u.user_id <= 0) throw new Error("BAD_USER_IDS");
    const n = u.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    byUser.set(u.user_id, n);
  }
  const ids = [...byUser.keys()];

  const found = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: ids },
      role: { in: [...WEB_PANEL_STAFF_ROLES] }
    },
    select: { id: true }
  });
  if (found.length !== ids.length) throw new Error("BAD_USER_IDS");

  await prisma.$transaction(
    ids.map((uid) =>
      prisma.user.update({
        where: { id: uid },
        data: { max_sessions: byUser.get(uid)! }
      })
    )
  );

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: "web_panel_bulk",
    action: "patch.web_panel_max_sessions_bulk",
    payload: { count: updates.length }
  });
}

