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
  AccessModuleViewRequiredError,
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
import { adminOrAccessManager, bulkAccessPatchBodySchema } from "./access.route.shared";

export async function registerAccessUsersBulkRoutes(app: FastifyInstance) {
  app.post("/api/:slug/access/users-bulk-patch", { preHandler: [...adminOrAccessManager] }, async (request, reply) => {
    const ok = ensureTenantContext(request, reply);
    if (!ok) return;
    const tenantId = request.tenant!.id;
    const parsed = bulkAccessPatchBodySchema.safeParse(request.body ?? {});
    if (!parsed.success)
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    const actorId = actorUserIdOrNull(request);
    const rawItems = parsed.data.items;
    /** Bir xil `user_id` uchun bir nechta qator — oxirgisi (kam commit, deadlock kam). */
    const lastByUser = new Map<number, (typeof rawItems)[number]>();
    for (const it of rawItems) {
      lastByUser.set(it.user_id, it);
    }
    const items = [...lastByUser.values()];
    const userIds = [...new Set(items.map((i) => i.user_id))];
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: userIds } },
      select: { id: true, role: true, is_active: true }
    });
    if (users.length !== userIds.length) {
      return sendApiError(reply, request, 400, "SomeUsersNotFound", "One or more users are missing in this tenant");
    }
    const byId = new Map(users.map((u) => [u.id, u]));
    const allTyped = items as BulkAccessPatchItem[];
    /** Butun body bir xil merge/remove bo‘lsa — bitta commit (chunk’lar orasidagi WAL/fsync tejalishi yo‘q). */
    const fullUniformMerge = tryUniformMergeBulk(allTyped);
    const fullUniformRemove = fullUniformMerge ? null : tryUniformRemoveBulk(allTyped);
    const fullUniformDelegate =
      fullUniformMerge || fullUniformRemove ? null : tryUniformWarehouseDelegateBulk(allTyped);

    const TX_CHUNK = 200;
    const txOpts = { timeout: 90_000, maxWait: 20_000 } as const;

    const runChunkInTx = async (slice: BulkAccessPatchItem[]) => {
      await prisma.$transaction(async (tx) => {
        const uniformMerge = tryUniformMergeBulk(slice);
        const uniformRemove = uniformMerge ? null : tryUniformRemoveBulk(slice);
        const uniformDelegate = uniformMerge || uniformRemove ? null : tryUniformWarehouseDelegateBulk(slice);

        const permKeys = collectPermissionKeysFromBulkSlice(slice);
        const terrIds = collectTerritoryIdsFromBulkSlice(slice);
        let scopeTx: { validTerritoryIds: ReadonlySet<number> } | undefined;
        if (terrIds.length > 0) {
          const rows = await tx.territory.findMany({
            where: { tenant_id: tenantId, id: { in: terrIds }, deleted_at: null },
            select: { id: true }
          });
          scopeTx = { validTerritoryIds: new Set(rows.map((r) => r.id)) };
        }

        if (uniformMerge) {
          const keys = [...new Set([...uniformMerge.allow, ...uniformMerge.deny])];
          const pidMap = await ensurePermissionIdsForKeys(tx, tenantId, keys);
          await bulkMergeUserPermissionKeysForUsers(
            tx,
            tenantId,
            uniformMerge.userIds,
            uniformMerge.allow,
            uniformMerge.deny,
            pidMap
          );
        } else if (uniformRemove) {
          await bulkRemoveUserPermissionsByKeysForUsers(tx, tenantId, uniformRemove.userIds, uniformRemove.keys);
        } else if (uniformDelegate) {
          if (uniformDelegate.delegate) {
            const urows = await prisma.user.findMany({
              where: { tenant_id: tenantId, id: { in: uniformDelegate.userIds } },
              select: { id: true, role: true }
            });
            const withManage = await getUsersHaveAccessManage(
              tenantId,
              urows.map((u) => ({ id: u.id, role: u.role }))
            );
            for (const uid of uniformDelegate.userIds) {
              if (!withManage.has(uid)) throw new AccessManageRequiredError();
            }
          }
          await bulkSetWarehouseDelegateForUsers(
            tx,
            uniformDelegate.warehouse_id,
            uniformDelegate.userIds,
            uniformDelegate.delegate
          );
        } else {
          const pidMap =
            permKeys.length > 0 ? await ensurePermissionIdsForKeys(tx, tenantId, permKeys) : new Map<string, number>();
          const applyTxOpts =
            permKeys.length > 0 || scopeTx
              ? {
                  ...(permKeys.length > 0 ? { permissionIdByKey: pidMap } : {}),
                  ...(scopeTx ? { scopeTx } : {})
                }
              : undefined;
          for (const item of slice) {
            const ex = byId.get(item.user_id)!;
            const { user_id, ...body } = item;
            await applyAccessUserPatchBodyTx(tx, tenantId, user_id, body, ex, applyTxOpts);
          }
        }
      }, txOpts);
    };

    try {
      if (fullUniformMerge) {
        await prisma.$transaction(async (tx) => {
          const keys = [...new Set([...fullUniformMerge.allow, ...fullUniformMerge.deny])];
          const pidMap = await ensurePermissionIdsForKeys(tx, tenantId, keys);
          await bulkMergeUserPermissionKeysForUsers(
            tx,
            tenantId,
            fullUniformMerge.userIds,
            fullUniformMerge.allow,
            fullUniformMerge.deny,
            pidMap
          );
        }, txOpts);
      } else if (fullUniformRemove) {
        await prisma.$transaction(async (tx) => {
          await bulkRemoveUserPermissionsByKeysForUsers(tx, tenantId, fullUniformRemove.userIds, fullUniformRemove.keys);
        }, txOpts);
      } else if (fullUniformDelegate) {
        if (fullUniformDelegate.delegate) {
          const urows = await prisma.user.findMany({
            where: { tenant_id: tenantId, id: { in: fullUniformDelegate.userIds } },
            select: { id: true, role: true }
          });
          const withManage = await getUsersHaveAccessManage(
            tenantId,
            urows.map((u) => ({ id: u.id, role: u.role }))
          );
          for (const uid of fullUniformDelegate.userIds) {
            if (!withManage.has(uid)) {
              return sendApiError(
                reply,
                request,
                403,
                "ACCESS_MANAGE_REQUIRED",
                "Право «выдавать склад другим» доступно только при включённой операции «Доступ: управление» (access.manage)."
              );
            }
          }
        }
        await prisma.$transaction(async (tx) => {
          await bulkSetWarehouseDelegateForUsers(
            tx,
            fullUniformDelegate.warehouse_id,
            fullUniformDelegate.userIds,
            fullUniformDelegate.delegate
          );
        }, txOpts);
      } else {
        for (let i = 0; i < items.length; i += TX_CHUNK) {
          await runChunkInTx(items.slice(i, i + TX_CHUNK) as BulkAccessPatchItem[]);
        }
      }
    } catch (e) {
      if (e instanceof AccessManageRequiredError) {
        return sendApiError(
          reply,
          request,
          403,
          e.code,
          "Чтобы выдавать операции или право «склад другим», у пользователя должна быть включена операция «Доступ: управление» (access.manage)."
        );
      }
      if (e instanceof AccessModuleViewRequiredError) {
        return sendApiError(
          reply,
          request,
          403,
          e.code,
          "Чтобы разрешить выдавать доступ другим, сначала включите доступ к разделу «Доступ» (access.upravlenie.view) для этого пользователя."
        );
      }
      if (e instanceof SuperviseePatchError) {
        return sendApiError(reply, request, 400, "SUPERVISEE_PATCH", e.message);
      }
      throw e;
    }
    void prisma.accessLog
      .create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorId,
          target_user_id: null,
          action_type: "permissions.bulk_updated",
          entity_type: "access_bulk",
          entity_id: `n=${items.length}`,
          old_value: {},
          new_value: {
            affected: rawItems.length,
            distinct_users: userIds.length,
            deduped_applies: items.length,
            user_ids_preview: userIds.slice(0, 80)
          },
          ip_address: request.ip ?? null,
          device: String(request.headers["user-agent"] ?? "").slice(0, 255) || null
        }
      })
      .catch((err) => {
        request.log.error({ err }, "accessLog bulk create failed");
      });
    void appendTenantAuditEvent({
      tenantId: tenantId,
      actorUserId: actorId,
      entityType: "access_bulk",
      entityId: "users",
      action: "permissions.bulk_updated",
      payload: { affected: rawItems.length, distinct_users: userIds.length, applies: items.length }
    }).catch((err) => {
      request.log.error({ err }, "appendTenantAuditEvent bulk failed");
    });
    return reply.send({ ok: true, processed: items.length });
  });
}
