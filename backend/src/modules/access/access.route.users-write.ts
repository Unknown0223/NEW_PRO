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
import { adminOrAccessManager, patchAccessBodySchema } from "./access.route.shared";

export async function registerAccessUsersWriteRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/users/:id/detail", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
    const user = await prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        login: true,
        name: true,
        code: true,
        role: true,
        is_active: true,
        branch: true,
        supervisor_user_id: true
      }
    });
    if (!user) return sendApiError(reply, request, 404, "UserNotFound");
    const [matrix, supervisees, branch_links, warehouse_links, cash_links, pm_links, territoryIds] = await Promise.all([
      getUserAccessMatrix(tenantId, user.id, user.role),
      prisma.user.findMany({
        where: { tenant_id: tenantId, supervisor_user_id: id },
        select: { id: true, login: true, name: true, code: true, role: true, is_active: true },
        orderBy: { name: "asc" },
        take: 500
      }),
      prisma.userBranchLink.findMany({ where: { user_id: id, tenant_id: tenantId }, select: { branch_code: true } }),
      prisma.warehouseUserLink.findMany({ where: { user_id: id }, select: { warehouse_id: true, link_role: true } }),
      prisma.cashDeskUserLink.findMany({ where: { user_id: id }, select: { cash_desk_id: true } }),
      prisma.userPaymentMethodLink.findMany({ where: { user_id: id, tenant_id: tenantId }, select: { payment_method: true } }),
      prisma.territoryUserLink.findMany({
        where: { user_id: id, territory: { tenant_id: tenantId } },
        select: { territory_id: true }
      })
    ]);
    return reply.send({
      data: {
        user: {
          id: user.id,
          login: user.login,
          full_name: user.name,
          code: user.code,
          role: user.role,
          status: user.is_active ? "active" : "inactive",
          branch: user.branch,
          supervisor_user_id: user.supervisor_user_id
        },
        matrix,
        supervisees,
        scope: {
          branches: branch_links.map((b) => b.branch_code),
          warehouses: warehouse_links.map((w) => w.warehouse_id),
          warehouse_delegate_ids: warehouse_links.filter((w) => w.link_role === "manager").map((w) => w.warehouse_id),
          cash_desks: cash_links.map((c) => c.cash_desk_id),
          payment_methods: pm_links.map((p) => p.payment_method),
          territories: territoryIds.map((t) => t.territory_id)
        }
      }
    });
  });

  app.patch("/api/:slug/access/users/:id", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
    const parsed = patchAccessBodySchema.safeParse(request.body ?? {});
    if (!parsed.success)
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    const body = parsed.data;

    const existing = await prisma.user.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true, role: true, is_active: true } });
    if (!existing) return sendApiError(reply, request, 404, "UserNotFound");
    const actorId = actorUserIdOrNull(request);

    const permDefined = body.permissions !== undefined || body.denied_permissions !== undefined;
    const scopeTouched =
      body.branch_codes !== undefined ||
      body.warehouse_ids !== undefined ||
      body.warehouse_delegate !== undefined ||
      body.cash_desk_ids !== undefined ||
      body.payment_methods !== undefined ||
      body.territory_ids !== undefined;
    const superviseeTouched = body.supervisee_user_ids !== undefined;

    try {
      await applyAccessUserPatchBody(tenantId, id, body, existing);
    } catch (e) {
      if (e instanceof AccessManageRequiredError) {
        return sendApiError(
          reply,
          request,
          403,
          e.code,
          "Чтобы выдавать этому пользователю другие операции или право выдавать склад другим, сначала включите «Доступ: управление» (access.manage)."
        );
      }
      if (e instanceof SuperviseePatchError) {
        return sendApiError(reply, request, 400, "SUPERVISEE_PATCH", e.message);
      }
      throw e;
    }

    const actionTypes: string[] = [];
    if (body.role?.trim() || body.is_active != null) actionTypes.push("user.profile.updated");
    if (body.remove_permission_keys?.length || permDefined) actionTypes.push("permissions.updated");
    if (scopeTouched) actionTypes.push("scope.updated");
    if (superviseeTouched) actionTypes.push("supervisees.updated");
    const action_type = actionTypes.length ? actionTypes.join("+") : "access.updated";

    await prisma.accessLog.create({
      data: {
        tenant_id: tenantId,
        actor_user_id: actorId,
        target_user_id: id,
        action_type,
        entity_type: "user",
        entity_id: String(id),
        old_value: { role: existing.role, is_active: existing.is_active },
        new_value: body,
        ip_address: request.ip ?? null,
        device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
      }
    });
    await appendTenantAuditEvent({
      tenantId: tenantId,
      actorUserId: actorId,
      entityType: "user",
      entityId: id,
      action: action_type,
      payload: body
    });
    return reply.send({ ok: true });
  });

  app.post("/api/:slug/access/users/:id/clone", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const targetId = Number((request.params as { id: string }).id);
    const sourceId = Number((request.body as { source_user_id?: number })?.source_user_id);
    if (!Number.isInteger(targetId) || !Number.isInteger(sourceId)) {
      return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
    }
    const [sourceUser, targetUser] = await Promise.all([
      prisma.user.findFirst({ where: { id: sourceId, tenant_id: tenantId } }),
      prisma.user.findFirst({ where: { id: targetId, tenant_id: tenantId } })
    ]);
    if (!sourceUser || !targetUser) return sendApiError(reply, request, 404, "UserNotFound");
    const actorId = actorUserIdOrNull(request);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { role: sourceUser.role, is_active: sourceUser.is_active } });
      await tx.userRole.deleteMany({ where: { user_id: targetId } });
      const sourceRoles = await tx.userRole.findMany({ where: { user_id: sourceId } });
      if (sourceRoles.length > 0) {
        await tx.userRole.createMany({
          data: sourceRoles.map((r) => ({ user_id: targetId, role_id: r.role_id })),
          skipDuplicates: true
        });
      }
      await tx.userPermission.deleteMany({ where: { user_id: targetId } });
      const sourcePerms = await tx.userPermission.findMany({ where: { user_id: sourceId } });
      if (sourcePerms.length > 0) {
        await tx.userPermission.createMany({
          data: sourcePerms.map((p) => ({ user_id: targetId, permission_id: p.permission_id, effect: p.effect })),
          skipDuplicates: true
        });
      }
    });

    await replaceUserScopes(tenantId, targetId, {
      branch_codes: (await prisma.userBranchLink.findMany({ where: { user_id: sourceId, tenant_id: tenantId }, select: { branch_code: true } })).map((x) => x.branch_code),
      warehouse_ids: (await prisma.warehouseUserLink.findMany({ where: { user_id: sourceId }, select: { warehouse_id: true } })).map((x) => x.warehouse_id),
      cash_desk_ids: (await prisma.cashDeskUserLink.findMany({ where: { user_id: sourceId }, select: { cash_desk_id: true } })).map((x) => x.cash_desk_id),
      payment_methods: (await prisma.userPaymentMethodLink.findMany({ where: { user_id: sourceId, tenant_id: tenantId }, select: { payment_method: true } })).map((x) => x.payment_method),
      territory_ids: (
        await prisma.territoryUserLink.findMany({
          where: { user_id: sourceId, territory: { tenant_id: tenantId } },
          select: { territory_id: true }
        })
      ).map((x) => x.territory_id)
    });
    const srcWhLinks = await prisma.warehouseUserLink.findMany({
      where: { user_id: sourceId },
      select: { warehouse_id: true, link_role: true }
    });
    for (const l of srcWhLinks) {
      await prisma.warehouseUserLink.updateMany({
        where: { user_id: targetId, warehouse_id: l.warehouse_id },
        data: { link_role: l.link_role }
      });
    }
    await prisma.accessLog.create({
      data: {
        tenant_id: tenantId,
        actor_user_id: actorId,
        target_user_id: targetId,
        action_type: "access.cloned",
        entity_type: "user",
        entity_id: String(targetId),
        old_value: {},
        new_value: { source_user_id: sourceId }
      }
    });
    return reply.send({ ok: true });
  });

  app.post("/api/:slug/access/users/:id/reset", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId", "Invalid user id");
    const user = await prisma.user.findFirst({ where: { id, tenant_id: tenantId }, select: { role: true } });
    if (!user) return sendApiError(reply, request, 404, "UserNotFound");
    const role = await prisma.role.findUnique({ where: { tenant_id_key: { tenant_id: tenantId, key: user.role } } });
    await prisma.userPermission.deleteMany({ where: { user_id: id } });
    await prisma.userRole.deleteMany({ where: { user_id: id } });
    if (role) await prisma.userRole.create({ data: { user_id: id, role_id: role.id } });
    return reply.send({ ok: true });
  });
}
