import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  isGrantDelegationKey,
  normalizeGrantDelegationOperationKey,
  toGrantDelegationKey
} from "./access-grant-delegation";
import {
  AccessManageRequiredError,
  derivePermissionModule,
  ensureRoleByKey,
  getUsersHaveAccessManage,
  mergeUserPermissionKeys,
  removeUserPermissionsByKeys
} from "./rbac.service";
import { patchUserScopesTx, type PatchUserScopesTxOpts } from "./scope.service";

/** Тело PATCH `/access/users/:id` без `user_id` — права и scope (роль/is_active допустимы для одиночного PATCH). */
export type AccessPatchBodyInput = {
  role?: string;
  is_active?: boolean;
  permissions?: string[];
  denied_permissions?: string[];
  remove_permission_keys?: string[];
  merge_permissions?: boolean;
  branch_codes?: string[];
  warehouse_ids?: number[];
  /** Ombor: `delegate` — boshqalarga biriktirish huquqi (`manager` / `operator`). */
  warehouse_delegate?: { warehouse_id: number; delegate: boolean };
  cash_desk_ids?: number[];
  payment_methods?: string[];
  territory_ids?: number[];
  trade_direction_ids?: number[];
  supervisee_user_ids?: number[];
  /** Operatsiya kaliti — boshqalarga berish huquqi (shaxsiy `access.grant.<key>`). */
  grant_delegation_allow?: string[];
  grant_delegation_revoke?: string[];
};

/** Некорректный список подчинённых (не тот тенант, сам себе и т.п.). */
export class SuperviseePatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperviseePatchError";
  }
}

export type ApplyAccessUserPatchTxOpts = {
  permissionIdByKey?: ReadonlyMap<string, number>;
  scopeTx?: PatchUserScopesTxOpts;
};

/**
 * Bir `tx` ichida — bulk marshrutda bitta commit uchun (ichki `$transaction` yo‘q).
 */
export async function applyAccessUserPatchBodyTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  body: AccessPatchBodyInput,
  _existing: { role: string; is_active: boolean },
  txOpts?: ApplyAccessUserPatchTxOpts
): Promise<void> {
  const permDefined = body.permissions !== undefined || body.denied_permissions !== undefined;
  const scopeTouched =
    body.branch_codes !== undefined ||
    body.warehouse_ids !== undefined ||
    body.warehouse_delegate !== undefined ||
    body.cash_desk_ids !== undefined ||
    body.payment_methods !== undefined ||
    body.territory_ids !== undefined ||
    body.trade_direction_ids !== undefined;

  const superviseeTouched = body.supervisee_user_ids !== undefined;
  const grantDelegationAllow = [
    ...new Set(
      (body.grant_delegation_allow ?? [])
        .map((k) => normalizeGrantDelegationOperationKey(k))
        .filter((k) => k.length > 0 && !isGrantDelegationKey(k))
    )
  ];
  const grantDelegationRevoke = [
    ...new Set(
      (body.grant_delegation_revoke ?? [])
        .map((k) => normalizeGrantDelegationOperationKey(k))
        .filter((k) => k.length > 0 && !isGrantDelegationKey(k))
    )
  ];
  const grantDelegationTouched = grantDelegationAllow.length > 0 || grantDelegationRevoke.length > 0;

  const hasPermTxWork =
    Boolean(body.role?.trim()) ||
    body.is_active != null ||
    Boolean(body.remove_permission_keys?.length) ||
    permDefined ||
    grantDelegationTouched;

  if (!hasPermTxWork && !scopeTouched && !superviseeTouched) return;

  let rbacRole = _existing.role;
  if (body.role?.trim()) {
    const nextRole = body.role.trim();
    rbacRole = nextRole;
    await tx.user.update({ where: { id: userId }, data: { role: nextRole } });
    const role = await ensureRoleByKey(tenantId, nextRole, nextRole);
    await tx.userRole.deleteMany({ where: { user_id: userId } });
    await tx.userRole.create({ data: { user_id: userId, role_id: role.id } });
  } else if (body.is_active != null) {
    await tx.user.update({ where: { id: userId }, data: { is_active: body.is_active } });
  }

  if (body.remove_permission_keys?.length) {
    await removeUserPermissionsByKeys(tx, tenantId, userId, body.remove_permission_keys);
  }

  if (grantDelegationRevoke.length > 0) {
    await removeUserPermissionsByKeys(
      tx,
      tenantId,
      userId,
      grantDelegationRevoke.map((k) => toGrantDelegationKey(k))
    );
  }
  if (grantDelegationAllow.length > 0) {
    await mergeUserPermissionKeys(
      tx,
      tenantId,
      userId,
      grantDelegationAllow.map((k) => toGrantDelegationKey(k)),
      [],
      txOpts?.permissionIdByKey,
      rbacRole
    );
  }

  if (permDefined) {
    const allow = [...new Set((body.permissions ?? []).map((x) => x.trim()).filter(Boolean))];
    const deny = [...new Set((body.denied_permissions ?? []).map((x) => x.trim()).filter(Boolean))];
    if (body.merge_permissions) {
      await mergeUserPermissionKeys(tx, tenantId, userId, allow, deny, txOpts?.permissionIdByKey, rbacRole);
    } else {
      await tx.userPermission.deleteMany({ where: { user_id: userId } });
      const keys = [...new Set([...allow, ...deny])];
      if (keys.length > 0) {
        const pref = txOpts?.permissionIdByKey;
        const permissionByKey = new Map<string, number>();
        const missing: string[] = [];
        for (const key of keys) {
          const id = pref?.get(key);
          if (id != null) permissionByKey.set(key, id);
          else missing.push(key);
        }
        if (missing.length > 0) {
          const created = await Promise.all(
            missing.map((key) =>
              tx.permission.upsert({
                where: { tenant_id_key: { tenant_id: tenantId, key } },
                create: { tenant_id: tenantId, key, module: derivePermissionModule(key) },
                update: {}
              })
            )
          );
          for (const p of created) permissionByKey.set(p.key, p.id);
        }
        await tx.userPermission.createMany({
          data: [
            ...allow.map((key) => ({ user_id: userId, permission_id: permissionByKey.get(key)!, effect: "allow" as const })),
            ...deny.map((key) => ({ user_id: userId, permission_id: permissionByKey.get(key)!, effect: "deny" as const }))
          ],
          skipDuplicates: true
        });
      }
    }
  }

  if (scopeTouched) {
    if (body.warehouse_delegate?.delegate) {
      const withManage = await getUsersHaveAccessManage(tenantId, [{ id: userId, role: rbacRole }]);
      if (!withManage.has(userId)) throw new AccessManageRequiredError();
    }
    await patchUserScopesTx(
      tx,
      tenantId,
      userId,
      {
        branch_codes: body.branch_codes,
        warehouse_ids: body.warehouse_ids,
        warehouse_delegate: body.warehouse_delegate,
        cash_desk_ids: body.cash_desk_ids,
        payment_methods: body.payment_methods,
        territory_ids: body.territory_ids,
        trade_direction_ids: body.trade_direction_ids
      },
      txOpts?.scopeTx
    );
  }

  if (superviseeTouched) {
    const raw = body.supervisee_user_ids ?? [];
    const desired = [...new Set(raw)];
    if (desired.includes(userId)) {
      throw new SuperviseePatchError("Нельзя назначить самого себя подчинённым.");
    }
    if (desired.length > 0) {
      const found = await tx.user.findMany({
        where: { tenant_id: tenantId, id: { in: desired } },
        select: { id: true }
      });
      if (found.length !== desired.length) {
        throw new SuperviseePatchError("Один или несколько пользователей не найдены в организации.");
      }
    }
    await tx.user.updateMany({
      where: {
        tenant_id: tenantId,
        supervisor_user_id: userId,
        ...(desired.length > 0 ? { id: { notIn: desired } } : {})
      },
      data: { supervisor_user_id: null }
    });
    if (desired.length > 0) {
      await tx.user.updateMany({
        where: { tenant_id: tenantId, id: { in: desired } },
        data: { supervisor_user_id: userId }
      });
    }
  }
}

/**
 * Применяет изменения доступа к одному пользователю (как в PATCH `/access/users/:id`),
 * без записи в access_log / tenant_audit — вызывающий пишет аудит.
 */
export async function applyAccessUserPatchBody(
  tenantId: number,
  userId: number,
  body: AccessPatchBodyInput,
  existing: { role: string; is_active: boolean }
): Promise<void> {
  const permDefined = body.permissions !== undefined || body.denied_permissions !== undefined;
  const scopeTouched =
    body.branch_codes !== undefined ||
    body.warehouse_ids !== undefined ||
    body.warehouse_delegate !== undefined ||
    body.cash_desk_ids !== undefined ||
    body.payment_methods !== undefined ||
    body.territory_ids !== undefined ||
    body.trade_direction_ids !== undefined;

  const superviseeTouched = body.supervisee_user_ids !== undefined;
  const grantDelegationTouched =
    Boolean(body.grant_delegation_allow?.length) || Boolean(body.grant_delegation_revoke?.length);

  const hasPermTxWork =
    Boolean(body.role?.trim()) ||
    body.is_active != null ||
    Boolean(body.remove_permission_keys?.length) ||
    permDefined ||
    grantDelegationTouched;

  if (!hasPermTxWork && !scopeTouched && !superviseeTouched) return;

  await prisma.$transaction(async (tx) => {
    await applyAccessUserPatchBodyTx(tx, tenantId, userId, body, existing);
  });
}
