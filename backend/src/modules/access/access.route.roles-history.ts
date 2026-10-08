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
import { toGrantDelegationKey } from "./access-grant-delegation";
import { isExcludedFromAccessWebUsersList, isWebPanelDeniedRole } from "../../lib/tenant-user-roles";
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
    const webRoles = roles.filter((r) => !isExcludedFromAccessWebUsersList(r.key) && !isWebPanelDeniedRole(r.key));
    return reply.send({
      data: webRoles.map((r) => ({
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
    const parsedBody = z
      .object({
        permissions: z.array(z.string().trim().min(1)),
        grant_operation_keys: z.array(z.string().trim().min(1)).max(2000).optional()
      })
      .safeParse(request.body ?? {});
    const permissions = parsedBody.success
      ? { success: true as const, data: parsedBody.data.permissions }
      : { success: false as const, error: parsedBody.error };
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
    const grantWanted = parsedBody.success ? parsedBody.data.grant_operation_keys : undefined;
    if (grantWanted) {
      const wanted = new Set(grantWanted);
      const grantOn = permissions.data.filter((k) => wanted.has(k)).map((k) => toGrantDelegationKey(k));
      const grantOff = permissions.data.filter((k) => !wanted.has(k)).map((k) => toGrantDelegationKey(k));
      const links = await prisma.userRole.findMany({ where: { role_id: roleId }, select: { user_id: true } });
      const userIds = [...new Set(links.map((l) => l.user_id))];
      if (userIds.length > 0 && (grantOn.length > 0 || grantOff.length > 0)) {
        await prisma.$transaction(async (tx) => {
          const idByKey = await ensurePermissionIdsForKeys(tx, tenantId, grantOn);
          if (grantOn.length > 0) await bulkMergeUserPermissionKeysForUsers(tx, tenantId, userIds, grantOn, [], idByKey);
          if (grantOff.length > 0) await bulkRemoveUserPermissionsByKeysForUsers(tx, tenantId, userIds, grantOff);
        });
      }
    }
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

  app.post("/api/:slug/access/role-defaults/bind", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    await ensureTenantRolesForRoleDefaults(tenantId);
    const parsed = z
      .object({
        action: z.enum(["attach", "detach"]),
        operation_keys: z.array(z.string().trim().min(1)).min(1).max(2000),
        role_ids: z.array(z.number().int().positive()).min(1).max(200),
        grant_role_ids: z.array(z.number().int().positive()).max(200).optional(),
        role_grants: z
          .array(
            z.object({
              role_id: z.number().int().positive(),
              operation_keys: z.array(z.string().trim().min(1)).max(2000)
            })
          )
          .max(200)
          .optional()
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные данные запроса", zodValidationExtras(parsed.error));
    }
    const { action, operation_keys, role_ids, grant_role_ids, role_grants } = parsed.data;
    const opSet = new Set(operation_keys);
    const roles = await prisma.role.findMany({
      where: { tenant_id: tenantId, id: { in: role_ids } },
      select: { id: true, key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } }
    });
    if (roles.length !== new Set(role_ids).size) return sendApiError(reply, request, 404, "RoleNotFound");
    const actorId = actorUserIdOrNull(request);
    const actor = { userId: actorId, role: getAccessUser(request)?.role };
    const updates: Array<{ role: (typeof roles)[number]; next: string[] }> = [];
    for (const role of roles) {
      const currentKeys = role.permissions.map((p) => p.permission.key);
      const cur = new Set(currentKeys);
      if (action === "attach") for (const k of opSet) cur.add(k);
      else for (const k of opSet) cur.delete(k);
      const next = [...cur].sort();
      try {
        await assertActorCanEditRoleDefaults(tenantId, actor, role.key, currentKeys, next);
      } catch (e) {
        const res = grantGuardErrorResponse(e);
        if (res) return sendApiError(reply, request, 403, res.code, res.message, res.keys ? { keys: res.keys } : undefined);
        throw e;
      }
      updates.push({ role, next });
    }
    for (const u of updates) {
      const currentKeys = u.role.permissions.map((p) => p.permission.key);
      await setRolePermissions(tenantId, u.role.id, u.next);
      const cur = new Set(currentKeys);
      const next = new Set(u.next);
      const added = [...next].filter((k) => !cur.has(k)).sort();
      const removed = [...cur].filter((k) => !next.has(k)).sort();
      if (added.length === 0 && removed.length === 0) continue;
      await prisma.accessLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorId,
          target_user_id: null,
          action_type: "access.role_defaults",
          entity_type: "role",
          entity_id: u.role.key,
          old_value: { role_key: u.role.key, role_name: u.role.name, removed },
          new_value: { role_key: u.role.key, role_name: u.role.name, added },
          ip_address: request.ip ?? null,
          device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
        }
      });
    }
    const opAllow = new Set(operation_keys);
    const grantByRole = new Map<number, string[]>();
    for (const row of role_grants ?? []) {
      if (!role_ids.includes(row.role_id)) continue;
      grantByRole.set(row.role_id, row.operation_keys.filter((k) => opAllow.has(k)));
    }
    for (const id of grant_role_ids ?? []) {
      if (role_ids.includes(id) && !grantByRole.has(id)) grantByRole.set(id, [...opAllow]);
    }
    if (action === "attach" && grantByRole.size > 0) {
      await prisma.$transaction(async (tx) => {
        for (const [roleId, keys] of grantByRole) {
          if (keys.length === 0) continue;
          const grantKeys = [...new Set(keys.map((k) => toGrantDelegationKey(k)))];
          const links = await tx.userRole.findMany({ where: { role_id: roleId }, select: { user_id: true } });
          const userIds = [...new Set(links.map((l) => l.user_id))];
          if (userIds.length === 0) continue;
          const idByKey = await ensurePermissionIdsForKeys(tx, tenantId, grantKeys);
          await bulkMergeUserPermissionKeysForUsers(tx, tenantId, userIds, grantKeys, [], idByKey);
        }
      });
    }
    return reply.send({ ok: true, updated: updates.length });
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
