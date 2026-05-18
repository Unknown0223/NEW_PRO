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
import { adminOrAccessManager, listUsersQuerySchema } from "./access.route.shared";

export async function registerAccessUsersListRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/users", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const q = listUsersQuerySchema.safeParse(request.query ?? {});
    if (!q.success)
      return sendApiError(reply, request, 400, "ValidationError", "Invalid query", zodValidationExtras(q.error));

    if (q.data.mode === "supervisor_pick") {
      const rows = await prisma.user.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          name: true,
          code: true,
          role: true,
          is_active: true,
          supervisor_user_id: true,
          branch: true
        },
        orderBy: [{ role: "asc" }, { name: "asc" }]
      });
      return reply.send({
        data: rows.map((u) => ({
          id: u.id,
          full_name: u.name,
          code: u.code,
          role: u.role,
          is_active: u.is_active,
          supervisor_user_id: u.supervisor_user_id,
          branch: u.branch
        }))
      });
    }

    const where: Prisma.UserWhereInput = { tenant_id: tenantId };
    if (q.data.is_active === "true") where.is_active = true;
    else if (q.data.is_active === "false") where.is_active = false;
    if (q.data.role?.trim()) where.role = q.data.role.trim();
    if (q.data.search?.trim()) {
      const s = q.data.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { login: { contains: s, mode: "insensitive" } },
        { branch: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } }
      ];
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        warehouse_links: { select: { warehouse_id: true, link_role: true } },
        cash_desk_links: { select: { cash_desk_id: true } },
        branch_links: { select: { branch_code: true } },
        payment_method_links: { select: { payment_method: true } }
      }
    });
    const userIds = rows.map((u) => u.id);
    const territoryRows =
      userIds.length === 0
        ? []
        : await prisma.territoryUserLink.findMany({
            where: { user_id: { in: userIds }, territory: { tenant_id: tenantId } },
            select: { user_id: true, territory_id: true }
          });
    const territoryIdsByUser = new Map<number, number[]>();
    for (const tr of territoryRows) {
      const arr = territoryIdsByUser.get(tr.user_id) ?? [];
      arr.push(tr.territory_id);
      territoryIdsByUser.set(tr.user_id, arr);
    }

    const includeCounts = q.data.include_counts !== "false";
    let countsByUserId = new Map<number, number>();
    if (includeCounts && rows.length > 0) {
      countsByUserId = await getOperationsCountsForUsers(
        tenantId,
        rows.map((u) => ({ id: u.id, role: u.role }))
      );
    }

    const data = rows.map((u) => ({
      id: u.id,
      login: u.login,
      full_name: u.name,
      role: u.role,
      status: u.is_active ? "active" : "inactive",
      operations_count: includeCounts ? (countsByUserId.get(u.id) ?? 0) : 0,
      branch: u.branch,
      code: u.code,
      scope: {
        branches: u.branch_links.map((x) => x.branch_code),
        warehouses: u.warehouse_links.map((x) => x.warehouse_id),
        warehouse_delegate_ids: u.warehouse_links.filter((x) => x.link_role === "manager").map((x) => x.warehouse_id),
        cash_desks: u.cash_desk_links.map((x) => x.cash_desk_id),
        payment_methods: u.payment_method_links.map((x) => x.payment_method),
        territories: territoryIdsByUser.get(u.id) ?? []
      }
    }));
    if (q.data.include_access_manage === "true" && data.length > 0) {
      const manageSet = await getUsersHaveAccessManage(
        tenantId,
        data.map((r) => ({ id: r.id, role: r.role }))
      );
      return reply.send({
        data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
      });
    }
    return reply.send({ data });
  });

  /**
   * Bir segment (`users-bulk-patch`) — `users/:id/...` bilan bir daraxtda bo‘lmaydi;
   * aks holda find-my-way ba’zi muhitlarda `POST .../users/bulk-patch` ni umuman ro‘yxatdan o‘tkazmaydi (404).
   */
}
