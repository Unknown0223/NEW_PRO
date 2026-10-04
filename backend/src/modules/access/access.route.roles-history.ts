import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { getAccessUser, jwtAccessVerify, requirePermission } from "../auth/auth.prehandlers";
import {
  buildAccessHistoryXlsxBuffer,
  formatAccessHistoryDateRu,
  listAccessHistory,
  listAccessHistoryActionTypes
} from "./history.service";
import { getUserAccessMatrix } from "./access-matrix.service";
import { ensureAnyPermission } from "./ensure-any-permission";
import { assertActorCanEditRoleDefaults, grantGuardErrorResponse } from "./access-grant-guard";
import { getPermissionCatalogGrouped } from "./permission-catalog.service";
import {
  AccessManageRequiredError,
  bulkMergeUserPermissionKeysForUsers,
  bulkRemoveUserPermissionsByKeysForUsers,
  ensurePermissionIdsForKeys,
  ensureRoleByKey,
  ensureTenantRolesForRoleDefaults,
  getOperationsCountsForUsers,
  getUsersHaveAccessManage,
  type AccessManageRoleCatalog,
  resolveUserPermissionKeys,
  setRolePermissions
} from "./rbac.service";
import {
  collectPermissionKeysFromBulkSlice,
  collectTerritoryIdsFromBulkSlice,
  tryUniformMergeBulk,
  tryUniformRemoveBulk,
  tryUniformWarehouseDelegateBulk,
  type BulkAccessPatchItem
} from "./access-bulk-detect";
import {
  applyAccessUserPatchBody,
  applyAccessUserPatchBodyTx,
  SuperviseePatchError
} from "./access-user-patch.apply";
import {
  buildAccessTerritorySyncPayload,
  buildAccessTerritoryTreeFromPayload,
  computeAccessTerritoryCatalogDigest,
  setTerritoryCatalogResponseCache,
  syncTerritoriesFromPayload,
  tryTerritoryCatalogResponseCache
} from "./access-territories-sync";
import { bulkSetWarehouseDelegateForUsers, replaceUserScopes } from "./scope.service";
import {
  loadPaymentMethodEntriesForResolve,
  loadTenantBranchesForAccess,
  type BranchDto
} from "../tenant-settings/tenant-settings.service";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import { paymentMethodStorageKey } from "../tenant-settings/finance-refs";
import { adminOrAccessManager } from "./access.route.shared";

export async function registerAccessRolesHistoryRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/role-defaults", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    await ensureTenantRolesForRoleDefaults(tenantId);
    const roles = await prisma.role.findMany({
      where: { tenant_id: tenantId },
      orderBy: { key: "asc" },
      include: { permissions: { include: { permission: true } } }
    });
    return reply.send({
      data: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        operations_count: r.permissions.length,
        permissions: r.permissions.map((p) => p.permission.key)
      }))
    });
  });

  app.put("/api/:slug/access/role-defaults/:id", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    await ensureTenantRolesForRoleDefaults(tenantId);
    const roleId = Number((request.params as { id: string }).id);
    const permissions = z.array(z.string().trim().min(1)).safeParse((request.body as { permissions?: string[] })?.permissions ?? []);
    if (!Number.isInteger(roleId) || roleId < 1) {
      return sendApiError(reply, request, 400, "ValidationError", "Некорректный ID роли");
    }
    if (!permissions.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные данные запроса", zodValidationExtras(permissions.error));
    }
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenant_id: tenantId },
      select: { id: true, key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } }
    });
    if (!role) return sendApiError(reply, request, 404, "RoleNotFound");
    const currentKeys = role.permissions.map((p) => p.permission.key);
    const actorId = actorUserIdOrNull(request);
    try {
      await assertActorCanEditRoleDefaults(
        tenantId,
        { userId: actorId, role: getAccessUser(request)?.role },
        role.key,
        currentKeys,
        permissions.data
      );
    } catch (e) {
      const res = grantGuardErrorResponse(e);
      if (res) return sendApiError(reply, request, 403, res.code, res.message, res.keys ? { keys: res.keys } : undefined);
      throw e;
    }
    await setRolePermissions(tenantId, roleId, permissions.data);
    const cur = new Set(currentKeys);
    const next = new Set(permissions.data);
    const added = [...next].filter((k) => !cur.has(k)).sort();
    const removed = [...cur].filter((k) => !next.has(k)).sort();
    if (added.length > 0 || removed.length > 0) {
      await prisma.accessLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorId,
          target_user_id: null,
          action_type: "access.role_defaults",
          entity_type: "role",
          entity_id: role.key,
          old_value: { role_key: role.key, role_name: role.name, removed },
          new_value: { role_key: role.key, role_name: role.name, added },
          ip_address: request.ip ?? null,
          device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
        }
      });
    }
    return reply.send({ ok: true });
  });

  app.get("/api/:slug/access/history/meta", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const action_types = await listAccessHistoryActionTypes(tenantId, 80);
    return reply.send({ action_types });
  });

  app.get("/api/:slug/access/history", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(2000).default(10),
      access_log_id: z.coerce.number().int().positive().optional(),
      action_type: z.string().optional(),
      actor_user_id: z.coerce.number().int().positive().optional(),
      target_user_id: z.coerce.number().int().positive().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      search: z.string().max(160).optional(),
      sort_dir: z.enum(["asc", "desc"]).optional(),
      export: z.enum(["csv", "xlsx"]).optional()
    });
    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success)
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные параметры запроса", zodValidationExtras(parsed.error));
    const exportKind = parsed.data.export;
    if (exportKind === "csv" || exportKind === "xlsx") {
      if (!(await ensureAnyPermission(request, reply, ["access.upravlenie.export"]))) return;
      const { export: _ignored, ...listParams } = parsed.data;
      const exportData = await listAccessHistory(tenantId, { ...listParams, page: 1, limit: 2000 });
      if (exportKind === "csv") {
        const sep = ";";
        const header = ["Дата", "Операции", "Исполнитель", "Пользователь", "Тип действия"].join(sep);
        const lines = exportData.data.map((r) =>
          [formatAccessHistoryDateRu(r.created_at), r.operation_label, r.actor_display, r.target_display, r.action_type_label]
            .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
            .join(sep)
        );
        reply.header("content-type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", 'attachment; filename="istoriya-dostupa.csv"');
        return reply.send(`\uFEFF${header}\n${lines.join("\n")}`);
      }
      const buf = await buildAccessHistoryXlsxBuffer(exportData.data);
      reply.header(
        "content-type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header("Content-Disposition", 'attachment; filename="istoriya-dostupa.xlsx"');
      return reply.send(buf);
    }
    const { export: _e2, ...listParams2 } = parsed.data;
    const data = await listAccessHistory(tenantId, listParams2);
    return reply.send(data);
  });
}
