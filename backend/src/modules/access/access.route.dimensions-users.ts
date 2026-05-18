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

export async function registerAccessDimensionsUsersRoutes(app: FastifyInstance) {
  app.get("/api/:slug/access/dimensions/users", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const schema = z.object({
      type: z.enum(["operations", "cash_desks", "warehouses", "branches", "payment_methods"]),
      key: z.string().trim().min(1)
    });
    const parsed = schema.safeParse(request.query ?? {});
    if (!parsed.success)
      return sendApiError(reply, request, 400, "ValidationError", "Invalid query", zodValidationExtras(parsed.error));
    const { type, key } = parsed.data;

    if (type === "cash_desks") {
      const cashDeskId = Number(key);
      if (!Number.isInteger(cashDeskId) || cashDeskId < 1)
        return sendApiError(reply, request, 400, "ValidationError", "Invalid cash desk key");
      const rows = await prisma.cashDeskUserLink.findMany({
        where: { cash_desk_id: cashDeskId, user: { tenant_id: tenantId } },
        select: {
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true } }
        },
        orderBy: [{ user: { name: "asc" } }, { user: { login: "asc" } }]
      });
      const data = rows.map((r) => ({
        id: r.user.id,
        login: r.user.login,
        full_name: r.user.name,
        code: r.user.code,
        role: r.user.role,
        position: r.user.position,
        is_active: r.user.is_active,
        source: "scope"
      }));
      const manageSet = await getUsersHaveAccessManage(
        tenantId,
        data.map((r) => ({ id: r.id, role: r.role }))
      );
      return reply.send({
        data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
      });
    }

    if (type === "warehouses") {
      const warehouseId = Number(key);
      if (!Number.isInteger(warehouseId) || warehouseId < 1)
        return sendApiError(reply, request, 400, "ValidationError", "Invalid warehouse key");
      const rows = await prisma.warehouseUserLink.findMany({
        where: { warehouse_id: warehouseId, user: { tenant_id: tenantId } },
        select: {
          link_role: true,
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true } }
        },
        orderBy: [{ user: { name: "asc" } }, { user: { login: "asc" } }]
      });
      const data = rows.map((r) => ({
        id: r.user.id,
        login: r.user.login,
        full_name: r.user.name,
        code: r.user.code,
        role: r.user.role,
        position: r.user.position,
        is_active: r.user.is_active,
        source: "scope",
        /** `manager` — boshqa foydalanuvchilarni shu omborga biriktirish; `operator` — faqat o‘zi ishlatadi. */
        warehouse_link_role: r.link_role
      }));
      const manageSet = await getUsersHaveAccessManage(
        tenantId,
        data.map((r) => ({ id: r.id, role: r.role }))
      );
      return reply.send({
        data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
      });
    }

    if (type === "branches") {
      const rows = await prisma.userBranchLink.findMany({
        where: { tenant_id: tenantId, branch_code: key },
        select: {
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true } }
        },
        orderBy: [{ user: { name: "asc" } }, { user: { login: "asc" } }]
      });
      const data = rows.map((r) => ({
        id: r.user.id,
        login: r.user.login,
        full_name: r.user.name,
        code: r.user.code,
        role: r.user.role,
        position: r.user.position,
        is_active: r.user.is_active,
        source: "scope"
      }));
      const manageSet = await getUsersHaveAccessManage(
        tenantId,
        data.map((r) => ({ id: r.id, role: r.role }))
      );
      return reply.send({
        data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
      });
    }

    if (type === "payment_methods") {
      const rows = await prisma.userPaymentMethodLink.findMany({
        where: { tenant_id: tenantId, payment_method: key },
        select: {
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true } }
        },
        orderBy: [{ user: { name: "asc" } }, { user: { login: "asc" } }]
      });
      const data = rows.map((r) => ({
        id: r.user.id,
        login: r.user.login,
        full_name: r.user.name,
        code: r.user.code,
        role: r.user.role,
        position: r.user.position,
        is_active: r.user.is_active,
        source: "scope"
      }));
      const manageSet = await getUsersHaveAccessManage(
        tenantId,
        data.map((r) => ({ id: r.id, role: r.role }))
      );
      return reply.send({
        data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
      });
    }

    const usersById = new Map<
      number,
      {
        id: number;
        login: string;
        full_name: string;
        code: string | null;
        role: string;
        position: string | null;
        is_active: boolean;
        from_direct_allow: boolean;
        from_direct_deny: boolean;
        from_role: boolean;
      }
    >();

    const permKeyWhere = { tenant_id: tenantId, key } as const;
    const [directRows, roleRows, roleKeys] = await Promise.all([
      prisma.userPermission.findMany({
        where: { permission: permKeyWhere },
        select: {
          effect: true,
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true, tenant_id: true } }
        }
      }),
      prisma.userRole.findMany({
        where: {
          role: {
            tenant_id: tenantId,
            permissions: {
              some: { permission: permKeyWhere }
            }
          }
        },
        select: {
          user: { select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true, tenant_id: true } }
        }
      }),
      prisma.role.findMany({
        where: { tenant_id: tenantId, permissions: { some: { permission: permKeyWhere } } },
        select: { key: true }
      })
    ]);
    for (const row of directRows) {
      if (row.user.tenant_id !== tenantId) continue;
      const ex = usersById.get(row.user.id) ?? {
        id: row.user.id,
        login: row.user.login,
        full_name: row.user.name,
        code: row.user.code,
        role: row.user.role,
        position: row.user.position,
        is_active: row.user.is_active,
        from_direct_allow: false,
        from_direct_deny: false,
        from_role: false
      };
      if (row.effect === "deny") ex.from_direct_deny = true;
      else ex.from_direct_allow = true;
      usersById.set(ex.id, ex);
    }
    for (const row of roleRows) {
      if (row.user.tenant_id !== tenantId) continue;
      const ex = usersById.get(row.user.id) ?? {
        id: row.user.id,
        login: row.user.login,
        full_name: row.user.name,
        code: row.user.code,
        role: row.user.role,
        position: row.user.position,
        is_active: row.user.is_active,
        from_direct_allow: false,
        from_direct_deny: false,
        from_role: false
      };
      ex.from_role = true;
      usersById.set(ex.id, ex);
    }
    const roleKeySet = new Set(roleKeys.map((r) => r.key));
    if (roleKeySet.size > 0) {
      const legacyRows = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: { in: [...roleKeySet] } },
        select: { id: true, login: true, name: true, code: true, role: true, position: true, is_active: true }
      });
      for (const row of legacyRows) {
        const ex = usersById.get(row.id) ?? {
          id: row.id,
          login: row.login,
          full_name: row.name,
          code: row.code,
          role: row.role,
          position: row.position,
          is_active: row.is_active,
          from_direct_allow: false,
          from_direct_deny: false,
          from_role: false
        };
        ex.from_role = true;
        usersById.set(ex.id, ex);
      }
    }

    const data = [...usersById.values()]
      .sort((a, b) => (a.full_name === b.full_name ? a.login.localeCompare(b.login) : a.full_name.localeCompare(b.full_name)))
      .map((x) => ({
        id: x.id,
        login: x.login,
        full_name: x.full_name,
        code: x.code,
        role: x.role,
        position: x.position,
        is_active: x.is_active,
        from_direct_allow: x.from_direct_allow,
        from_direct_deny: x.from_direct_deny,
        from_role: x.from_role
      }));

    const MANAGE_CHUNK = 350;
    const manageRows = data.map((r) => ({ id: r.id, role: r.role }));
    let manageSet = new Set<number>();
    if (manageRows.length <= MANAGE_CHUNK) {
      manageSet = await getUsersHaveAccessManage(tenantId, manageRows);
    } else {
      const roleRowsCached = await prisma.role.findMany({
        where: { tenant_id: tenantId },
        select: {
          key: true,
          permissions: { select: { permission: { select: { key: true } } } }
        }
      });
      const catalog: AccessManageRoleCatalog = new Map(roleRowsCached.map((r) => [r.key, r]));
      for (let i = 0; i < manageRows.length; i += MANAGE_CHUNK) {
        const chunk = manageRows.slice(i, i + MANAGE_CHUNK);
        const part = await getUsersHaveAccessManage(tenantId, chunk, catalog);
        for (const id of part) manageSet.add(id);
      }
    }
    return reply.send({
      data: data.map((r) => ({ ...r, has_access_manage: manageSet.has(r.id) }))
    });
  });
}
