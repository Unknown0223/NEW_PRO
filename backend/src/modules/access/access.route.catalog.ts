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
  invalidateAccessTerritorySyncCache,
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
import { loadActorDimensionBounds } from "./access-dimension-actor";
import { buildAccessOperationsTree } from "./access-operations-tree";

export async function registerAccessCatalogRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/permissions/catalog", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const data = await getPermissionCatalogGrouped(request.tenant!.id);
    const bounds = await loadActorDimensionBounds(request, request.tenant!.id);
    if (bounds) {
      const keep = (node: { key: string }) => bounds.grantableKeys.has(node.key);
      data.flat = data.flat.filter(keep);
      data.modules = data.modules
        .map((mod) => ({
          ...mod,
          sections: mod.sections
            .map((section) => ({ ...section, permissions: section.permissions.filter(keep) }))
            .filter((section) => section.permissions.length > 0)
        }))
        .filter((mod) => mod.sections.length > 0);
    }
    return reply.send({ data });
  });

  app.get("/api/:slug/access/operations-tree", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const bounds = await loadActorDimensionBounds(request, request.tenant!.id);
    const tree = buildAccessOperationsTree();
    if (!bounds) return reply.send({ data: tree });
    const data = tree
      .map((mod) => ({
        ...mod,
        sections: mod.sections
          .map((section) => ({
            ...section,
            operations: section.operations.filter((op) => bounds.grantableKeys.has(op.key))
          }))
          .filter((section) => section.operations.length > 0)
      }))
      .filter((mod) => mod.sections.length > 0);
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
    if (cached && (cached.rows.length > 0 || digest === "__empty__")) {
      const territoryBounds = await loadActorDimensionBounds(request, tenantId);
      const cachedRows = territoryBounds
        ? cached.rows.filter((r) => territoryBounds.territoryIds.has(r.id))
        : cached.rows;
      const cachedTree = payload ? buildAccessTerritoryTreeFromPayload(payload.roots, cachedRows) : [];
      return reply.send({
        data: cachedRows.map((r) => ({
          id: r.id,
          key: String(r.id),
          label: r.code ? `${r.name} (${r.code})` : r.name,
          name: r.name,
          code: r.code,
          is_active: r.is_active
        })),
        tree: cachedTree
      });
    }
    if (cached && cached.rows.length === 0 && digest !== "__empty__") {
      invalidateAccessTerritorySyncCache(tenantId);
    }

    await syncTerritoriesFromPayload(tenantId, payload);
    let rows = await prisma.territory.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      select: { id: true, name: true, code: true, is_active: true }
    });
    /** Digest-skip / race: справочник есть, а таблица пуста — ещё раз sync без кэша. */
    if (rows.length === 0 && payload && payload.items.length > 0) {
      invalidateAccessTerritorySyncCache(tenantId);
      await syncTerritoriesFromPayload(tenantId, payload);
      rows = await prisma.territory.findMany({
        where: { tenant_id: tenantId, deleted_at: null },
        select: { id: true, name: true, code: true, is_active: true }
      });
    }
    const tree = payload ? buildAccessTerritoryTreeFromPayload(payload.roots, rows) : [];
    setTerritoryCatalogResponseCache(tenantId, digest, rows, tree);
    const territoryBounds = await loadActorDimensionBounds(request, tenantId);
    const visibleRows = territoryBounds ? rows.filter((r) => territoryBounds.territoryIds.has(r.id)) : rows;
    const visibleTree = payload ? buildAccessTerritoryTreeFromPayload(payload.roots, visibleRows) : [];
    return reply.send({
      data: visibleRows.map((r) => ({
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
