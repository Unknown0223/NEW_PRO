import { prisma } from "../../config/database";
import { assertValidMaxSessions } from "../../lib/max-sessions";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { WEB_PANEL_STAFF_ROLES } from "../../lib/tenant-user-roles";
import { onBulkAppAccessChanged } from "../auth/app-access.service";
import { syncEmploymentAfterActiveChange } from "./staff.employment-sync";

const KOMANDA_BULK_MAX = 500;

export type KomandaBulkRole = "supervisor" | "expeditor" | "collector" | "auditor" | "skladchik";

export type BulkKomandaStaffInput =
  | { action: "set_app_access"; user_ids: number[]; app_access: boolean }
  | { action: "set_is_active"; user_ids: number[]; is_active: boolean }
  | { action: "revoke_sessions"; user_ids: number[] };

async function assertTenantKomandaIds(
  tenantId: number,
  role: KomandaBulkRole,
  ids: number[]
): Promise<number[]> {
  const uniq = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))];
  if (!uniq.length) throw new Error("EMPTY_IDS");
  if (uniq.length > KOMANDA_BULK_MAX) throw new Error("TOO_MANY_USERS");
  const count = await prisma.user.count({
    where: { tenant_id: tenantId, role, id: { in: uniq } }
  });
  if (count !== uniq.length) throw new Error("BAD_USER_IDS");
  return uniq;
}

export async function bulkPatchKomandaStaff(
  tenantId: number,
  role: KomandaBulkRole,
  input: BulkKomandaStaffInput,
  actorUserId: number | null = null
): Promise<{ updated: number }> {
  const ids = await assertTenantKomandaIds(tenantId, role, input.user_ids);
  const audit = (extra?: Record<string, unknown>) =>
    appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: `${role}_bulk`,
      action: `${role}.bulk`,
      payload: { op: input.action, count: ids.length, ...extra }
    });

  switch (input.action) {
    case "set_app_access": {
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role, id: { in: ids } },
        data: { app_access: input.app_access }
      });
      await onBulkAppAccessChanged(tenantId, ids, input.app_access);
      await audit({ app_access: input.app_access });
      return { updated: ids.length };
    }
    case "set_is_active": {
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role, id: { in: ids } },
        data: { is_active: input.is_active }
      });
      await syncEmploymentAfterActiveChange(tenantId, ids, actorUserId);
      await audit({ is_active: input.is_active });
      return { updated: ids.length };
    }
    case "revoke_sessions": {
      const now = new Date();
      await prisma.refreshToken.updateMany({
        where: { tenant_id: tenantId, user_id: { in: ids }, revoked_at: null },
        data: { revoked_at: now }
      });
      await audit();
      return { updated: ids.length };
    }
    default:
      throw new Error("BAD_BULK_ACTION");
  }
}

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
    assertValidMaxSessions(n);
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

