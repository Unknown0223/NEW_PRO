import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { adminOrAccessManager } from "./access.route.shared";
import {
  applyAccessResetToRoleDefault,
  findLatestAccessResetLog,
  isAccessResetSnapshot,
  restoreAccessFromResetSnapshot,
  snapshotUserAccessGrants
} from "./access.reset.service";

export async function registerAccessUsersResetRoutes(app: FastifyInstance) {
  app.post("/api/:slug/access/users/:id/reset", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
    const user = await prisma.user.findFirst({ where: { id, tenant_id: tenantId }, select: { role: true } });
    if (!user) return sendApiError(reply, request, 404, "UserNotFound");
    const actorId = actorUserIdOrNull(request);
    const snapshot = await snapshotUserAccessGrants(tenantId, id, user.role);
    await applyAccessResetToRoleDefault(tenantId, id, user.role);
    await prisma.accessLog.create({
      data: {
        tenant_id: tenantId,
        actor_user_id: actorId,
        target_user_id: id,
        action_type: "access.reset",
        entity_type: "user",
        entity_id: String(id),
        old_value: snapshot,
        new_value: {
          reset: true,
          role: user.role,
          cleared_permissions: snapshot.permissions.length,
          cleared_roles: snapshot.roles.length
        },
        ip_address: request.ip ?? null,
        device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
      }
    });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actorId,
      entityType: "user",
      entityId: id,
      action: "access.reset",
      payload: {
        role_key: snapshot.role_key,
        permissions_count: snapshot.permissions.length,
        roles_count: snapshot.roles.length
      }
    });
    return reply.send({
      ok: true,
      snapshot_permissions: snapshot.permissions.length,
      snapshot_roles: snapshot.roles.length
    });
  });

  app.post(
    "/api/:slug/access/users/:id/restore-reset",
    { preHandler: [...adminOrAccessManager] },
    async (request, reply) => {
      const ok = ensureTenantContext(request, reply);
      if (!ok) return;
      const tenantId = request.tenant!.id;
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
      const user = await prisma.user.findFirst({
        where: { id, tenant_id: tenantId },
        select: { id: true, role: true }
      });
      if (!user) return sendApiError(reply, request, 404, "UserNotFound");

      const resetLog = await findLatestAccessResetLog(tenantId, id);
      if (!resetLog) {
        return sendApiError(reply, request, 404, "NoResetSnapshot", "No access.reset log found for this user");
      }
      if (!isAccessResetSnapshot(resetLog.old_value)) {
        return sendApiError(
          reply,
          request,
          409,
          "SnapshotIncomplete",
          "Latest access.reset log has no full grants snapshot (pre-Phase 2 reset)"
        );
      }

      const actorId = actorUserIdOrNull(request);
      const before = await snapshotUserAccessGrants(tenantId, id, user.role);
      const restored = await restoreAccessFromResetSnapshot(tenantId, id, resetLog.old_value);

      await prisma.accessLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorId,
          target_user_id: id,
          action_type: "access.reset_restore",
          entity_type: "user",
          entity_id: String(id),
          old_value: before,
          new_value: {
            restored_from_access_log_id: resetLog.id,
            restored_at_reset: resetLog.created_at.toISOString(),
            ...restored,
            snapshot: resetLog.old_value
          },
          ip_address: request.ip ?? null,
          device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
        }
      });
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: actorId,
        entityType: "user",
        entityId: id,
        action: "access.reset_restore",
        payload: {
          restored_from_access_log_id: resetLog.id,
          ...restored
        }
      });
      return reply.send({
        ok: true,
        restored_from_access_log_id: resetLog.id,
        ...restored
      });
    }
  );
}
