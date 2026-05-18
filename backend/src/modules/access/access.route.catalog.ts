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
import { adminOrAccessManager } from "./access.route.shared";

export async function registerAccessCatalogRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/permissions/catalog", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const data = await getPermissionCatalogGrouped(request.tenant!.id);
    return reply.send({ data });
  });

  app.get("/api/:slug/access/territories", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });
    const payload = buildAccessTerritorySyncPayload(tenantRow?.settings ?? null);
    const digest = computeAccessTerritoryCatalogDigest(payload);

    const cached = tryTerritoryCatalogResponseCache(tenantId, digest);
    if (cached) {
      return reply.send({
        data: cached.rows.map((r) => ({
          id: r.id,
          key: String(r.id),
          label: r.code ? `${r.name} (${r.code})` : r.name,
          name: r.name,
          code: r.code,
          is_active: r.is_active
        })),
        tree: cached.tree
      });
    }

    await syncTerritoriesFromPayload(tenantId, payload);
    const rows = await prisma.territory.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      select: { id: true, name: true, code: true, is_active: true }
    });
    const tree = payload ? buildAccessTerritoryTreeFromPayload(payload.roots, rows) : [];
    setTerritoryCatalogResponseCache(tenantId, digest, rows, tree);
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        key: String(r.id),
        label: r.code ? `${r.name} (${r.code})` : r.name,
        name: r.name,
        code: r.code,
        is_active: r.is_active
      })),
      tree
    });
  });
}
