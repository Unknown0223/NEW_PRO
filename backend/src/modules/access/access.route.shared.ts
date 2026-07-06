import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { getAccessUser, jwtAccessVerify, requireAnyPermission } from "../auth/auth.prehandlers";
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

export const adminOrAccessManager = [jwtAccessVerify, requireAccessWorkspaceView()] as const;

function requireAccessWorkspaceView() {
  return requireAnyPermission(["access.upravlenie.view", "access.manage"], { allowAdminRole: true });
}

function branchStorageKey(b: Pick<BranchDto, "id" | "code">): string {
  const c = b.code?.trim();
  if (c) return c;
  return b.id.trim();
}

function branchLinkMatchesRef(b: BranchDto, linkCode: string): boolean {
  const k = linkCode.trim();
  if (!k) return false;
  if (b.id.trim() === k) return true;
  const code = b.code?.trim();
  if (code && code === k) return true;
  return branchStorageKey(b) === k;
}

export function pickBranchDimensionKey(b: BranchDto, countBy: Map<string, number>): string {
  const sk = branchStorageKey(b);
  const id = b.id.trim();
  const codeOnly = b.code?.trim();
  const n = (x: string) => countBy.get(x) ?? 0;
  if (n(sk) > 0) return sk;
  if (id && n(id) > 0) return id;
  if (codeOnly && n(codeOnly) > 0) return codeOnly;
  return sk;
}

export function sumBranchLinkCounts(b: BranchDto, countBy: Map<string, number>): number {
  let sum = 0;
  const seenCodes = new Set<string>();
  for (const [code, c] of countBy) {
    if (!branchLinkMatchesRef(b, code)) continue;
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    sum += c;
  }
  return sum;
}

export function pickPaymentDimensionKey(e: PaymentMethodEntryDto, countBy: Map<string, number>): string {
  const sk = paymentMethodStorageKey(e);
  const id = e.id.trim();
  const n = (x: string) => countBy.get(x) ?? 0;
  if (n(sk) > 0) return sk;
  if (id && id !== sk && n(id) > 0) return id;
  return sk || id;
}

export function sumPaymentLinkCounts(e: PaymentMethodEntryDto, countBy: Map<string, number>): number {
  const sk = paymentMethodStorageKey(e);
  const id = e.id.trim();
  let sum = 0;
  const seen = new Set<string>();
  for (const k of [sk, id].filter(Boolean)) {
    if (seen.has(k)) continue;
    seen.add(k);
    sum += countBy.get(k) ?? 0;
  }
  return sum;
}

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  role: z.string().optional(),
  /** `false` — не считать `operations_count` (модалки массового выбора; ускоряет ответ). */
  include_counts: z.enum(["true", "false"]).optional(),
  /** `true` — добавить `has_access_manage` (модалка «Пользователи» / гейт «Предоставление доступа»). */
  include_access_manage: z.enum(["true", "false"]).optional(),
  /** Лёгкий список для модалки «Прикрепить сотрудников» (роль, без scope-счётчиков). */
  mode: z.enum(["supervisor_pick"]).optional()
});

const accessPermissionKeyZ = z.string().trim().min(1).max(180);

export const patchAccessBodySchema = z.object({
  role: z.string().trim().min(1).optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(accessPermissionKeyZ).optional(),
  denied_permissions: z.array(accessPermissionKeyZ).optional(),
  remove_permission_keys: z.array(accessPermissionKeyZ).optional(),
  merge_permissions: z.boolean().optional(),
  branch_codes: z.array(z.string().trim().min(1)).optional(),
  warehouse_ids: z.array(z.number().int().positive()).optional(),
  warehouse_delegate: z
    .object({
      warehouse_id: z.number().int().positive(),
      delegate: z.boolean()
    })
    .optional(),
  cash_desk_ids: z.array(z.number().int().positive()).optional(),
  payment_methods: z.array(z.string().trim().min(1)).optional(),
  territory_ids: z.array(z.number().int().positive()).optional(),
  trade_direction_ids: z.array(z.number().int().positive()).optional(),
  /** Подчинённые супервайзера: `user.supervisor_user_id` = `:id`. Пустой массив — снять всех. */
  supervisee_user_ids: z.array(z.number().int().positive()).max(5000).optional(),
  /** Operatsiya kaliti — foydalanuvchi boshqalarga berishi (`access.grant.<key>`, faqat shaxsiy). */
  grant_delegation_allow: z.array(accessPermissionKeyZ).optional(),
  grant_delegation_revoke: z.array(accessPermissionKeyZ).optional()
});

const bulkAccessPatchItemSchema = z
  .object({
    user_id: z.number().int().positive()
  })
  .merge(patchAccessBodySchema)
  .refine((d) => d.role === undefined && d.is_active === undefined, {
    message: "BulkPatchNoProfileFields"
  })
  .refine((d) => d.supervisee_user_ids === undefined, {
    message: "BulkPatchNoSupervisees"
  });

export const bulkAccessPatchBodySchema = z.object({
  items: z.array(bulkAccessPatchItemSchema).min(1).max(3000)
});
