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
import {
  adminOrAccessManager,
  pickBranchDimensionKey,
  pickPaymentDimensionKey,
  sumBranchLinkCounts,
  sumPaymentLinkCounts
} from "./access.route.shared";

export async function registerAccessDimensionsRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/dimensions", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const schema = z.object({
      type: z.enum(["operations", "cash_desks", "warehouses", "branches", "payment_methods"])
    });
    const parsed = schema.safeParse(request.query ?? {});
    if (!parsed.success)
      return sendApiError(reply, request, 400, "ValidationError", "Invalid query", zodValidationExtras(parsed.error));
    const { type } = parsed.data;

    if (type === "cash_desks") {
      const rows = await prisma.cashDesk.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          name: true,
          is_active: true,
          _count: { select: { links: true } }
        },
        orderBy: { name: "asc" }
      });
      return reply.send({
        data: rows.map((r) => ({
          key: String(r.id),
          label: r.name,
          attached_users_count: r._count.links,
          is_active: r.is_active
        }))
      });
    }

    if (type === "warehouses") {
      const rows = await prisma.warehouse.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          name: true,
          is_active: true,
          _count: { select: { links: true } }
        },
        orderBy: { name: "asc" }
      });
      return reply.send({
        data: rows.map((r) => ({
          key: String(r.id),
          label: r.name,
          attached_users_count: r._count.links,
          is_active: r.is_active
        }))
      });
    }

    if (type === "branches") {
      const [refBranches, linkGroups] = await Promise.all([
        loadTenantBranchesForAccess(tenantId),
        prisma.userBranchLink.groupBy({
          by: ["branch_code"],
          where: { tenant_id: tenantId },
          _count: { _all: true },
          orderBy: { branch_code: "asc" }
        })
      ]);
      const countBy = new Map<string, number>();
      for (const r of linkGroups) {
        countBy.set(r.branch_code, r._count._all);
      }
      const seenRowKeys = new Set<string>();
      const data: { key: string; label: string; attached_users_count: number; is_active: boolean }[] = [];
      for (const b of refBranches) {
        const key = pickBranchDimensionKey(b, countBy);
        if (!key || seenRowKeys.has(key)) continue;
        seenRowKeys.add(key);
        data.push({
          key,
          label: b.name.trim() || key,
          attached_users_count: sumBranchLinkCounts(b, countBy),
          is_active: b.active !== false
        });
      }
      for (const r of linkGroups) {
        const k = r.branch_code;
        if (seenRowKeys.has(k)) continue;
        seenRowKeys.add(k);
        data.push({
          key: k,
          label: k,
          attached_users_count: r._count._all,
          is_active: true
        });
      }
      data.sort((a, b) => a.label.localeCompare(b.label, "ru"));
      return reply.send({ data });
    }

    if (type === "payment_methods") {
      const [entries, linkGroups] = await Promise.all([
        loadPaymentMethodEntriesForResolve(tenantId),
        prisma.userPaymentMethodLink.groupBy({
          by: ["payment_method"],
          where: { tenant_id: tenantId },
          _count: { _all: true },
          orderBy: { payment_method: "asc" }
        })
      ]);
      const countBy = new Map<string, number>();
      for (const r of linkGroups) {
        countBy.set(r.payment_method, r._count._all);
      }
      const claimed = new Set<string>();
      for (const e of entries) {
        for (const k of [pickPaymentDimensionKey(e, countBy), paymentMethodStorageKey(e), e.id.trim()].filter(Boolean)) {
          claimed.add(k);
        }
      }
      const seenRowKeys = new Set<string>();
      const data: { key: string; label: string; attached_users_count: number; is_active: boolean }[] = [];
      for (const e of entries) {
        const key = pickPaymentDimensionKey(e, countBy);
        if (!key || seenRowKeys.has(key)) continue;
        seenRowKeys.add(key);
        data.push({
          key,
          label: e.name.trim() || key,
          attached_users_count: sumPaymentLinkCounts(e, countBy),
          is_active: e.active !== false
        });
      }
      for (const r of linkGroups) {
        const k = r.payment_method;
        if (claimed.has(k) || seenRowKeys.has(k)) continue;
        seenRowKeys.add(k);
        data.push({
          key: k,
          label: k,
          attached_users_count: r._count._all,
          is_active: true
        });
      }
      data.sort((a, b) => a.label.localeCompare(b.label, "ru"));
      return reply.send({ data });
    }

    const ops = await prisma.permission.findMany({
      where: { tenant_id: tenantId },
      select: {
        key: true,
        description: true,
        _count: {
          select: {
            users: true,
            roles: true
          }
        }
      },
      orderBy: { key: "asc" }
    });
    return reply.send({
      data: ops.map((r) => ({
        key: r.key,
        label: (r.description && String(r.description).trim()) || r.key,
        attached_users_count: r._count.users + r._count.roles,
        is_active: true
      }))
    });
  });
}
