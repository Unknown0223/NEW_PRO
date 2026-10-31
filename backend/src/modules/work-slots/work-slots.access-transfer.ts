import type { Prisma } from "@prisma/client";
import { isTenantAdminRole } from "../../lib/tenant-user-roles";

type Tx = Prisma.TransactionClient;

export type WorkplaceAccessSnapshot = {
  role: string;
  permissions: { permission_id: number; effect: string }[];
  extraRoleIds: number[];
  territoryIds: number[];
  paymentMethods: string[];
  tradeDirectionIds: number[];
  staffUserIds: number[];
  warehouses: { warehouse_id: number; link_role: string }[];
  cashDesks: { cash_desk_id: number; link_role: string }[];
  branchCodes: string[];
  supervisorUserId: number | null;
  entitlements: Prisma.JsonValue | null;
  priceType: string | null;
  priceTypes: Prisma.JsonValue;
  territory: string | null;
  branch: string | null;
};

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Slotda yo‘q kalitlar (to‘lov, hudud cheklovi va h.k.) eski xodimdan qo‘shiladi. */
export function mergeMissingEntitlementKeys(
  target: Prisma.JsonValue | null | undefined,
  source: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  const out = { ...asObject(target) };
  for (const [key, value] of Object.entries(asObject(source))) {
    if (out[key] === undefined) out[key] = value;
  }
  return out;
}

function priceTypesEmpty(value: Prisma.JsonValue | null | undefined): boolean {
  return !Array.isArray(value) || value.length === 0;
}

/** Joydan chiqarishdan oldin: Доступ bog‘lanishlari. */
export async function snapshotWorkplaceAccess(
  tx: Tx,
  tenantId: number,
  userId: number
): Promise<WorkplaceAccessSnapshot | null> {
  const user = await tx.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: {
      role: true,
      supervisor_user_id: true,
      agent_entitlements: true,
      price_type: true,
      agent_price_types: true,
      territory: true,
      branch: true
    }
  });
  if (!user) return null;

  const [permissions, roles, territories, payments, directions, staff, warehouses, cashDesks, branches] =
    await Promise.all([
      tx.userPermission.findMany({
        where: { user_id: userId },
        select: { permission_id: true, effect: true }
      }),
      tx.userRole.findMany({
        where: { user_id: userId },
        select: { role_id: true, role: { select: { key: true, tenant_id: true } } }
      }),
      tx.territoryUserLink.findMany({
        where: { user_id: userId, territory: { tenant_id: tenantId, deleted_at: null } },
        select: { territory_id: true }
      }),
      tx.userPaymentMethodLink.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        select: { payment_method: true }
      }),
      tx.userTradeDirectionLink.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        select: { trade_direction_id: true }
      }),
      tx.userStaffLink.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        select: { staff_user_id: true }
      }),
      tx.warehouseUserLink.findMany({
        where: { user_id: userId },
        select: { warehouse_id: true, link_role: true }
      }),
      tx.cashDeskUserLink.findMany({
        where: { user_id: userId },
        select: { cash_desk_id: true, link_role: true }
      }),
      tx.userBranchLink.findMany({
        where: { tenant_id: tenantId, user_id: userId },
        select: { branch_code: true }
      })
    ]);

  const primaryRole = user.role.trim();
  return {
    role: primaryRole,
    permissions: permissions.map((row) => ({
      permission_id: row.permission_id,
      effect: row.effect === "deny" ? "deny" : "allow"
    })),
    extraRoleIds: roles
      .filter(
        (row) =>
          row.role.tenant_id === tenantId &&
          row.role.key !== primaryRole &&
          !isTenantAdminRole(row.role.key)
      )
      .map((row) => row.role_id),
    territoryIds: territories.map((row) => row.territory_id),
    paymentMethods: payments.map((row) => row.payment_method),
    tradeDirectionIds: directions.map((row) => row.trade_direction_id),
    staffUserIds: staff.map((row) => row.staff_user_id),
    warehouses,
    cashDesks,
    branchCodes: branches.map((row) => row.branch_code),
    supervisorUserId: user.supervisor_user_id,
    entitlements: user.agent_entitlements,
    priceType: user.price_type,
    priceTypes: user.agent_price_types,
    territory: user.territory,
    branch: user.branch
  };
}

/**
 * Joydagi yangi xodimga eski xodimning Доступ bog‘lanishlarini qo‘shadi.
 * Slot mirror dan keyin chaqiriladi. Zakazlar bu yerda tegilmaydi.
 * Ko‘chirilgan bog‘lanishlar eski xodimdan olib tashlanadi.
 */
export async function applyWorkplaceAccessSnapshot(
  tx: Tx,
  tenantId: number,
  fromUserId: number,
  toUserId: number,
  snap: WorkplaceAccessSnapshot
): Promise<void> {
  if (fromUserId === toUserId) return;

  if (snap.permissions.length > 0) {
    await tx.userPermission.createMany({
      data: snap.permissions.map((row) => ({
        user_id: toUserId,
        permission_id: row.permission_id,
        effect: row.effect
      })),
      skipDuplicates: true
    });
  }

  if (snap.extraRoleIds.length > 0) {
    await tx.userRole.createMany({
      data: snap.extraRoleIds.map((role_id) => ({ user_id: toUserId, role_id })),
      skipDuplicates: true
    });
  }

  const staffIds = snap.staffUserIds.filter((id) => id !== toUserId && id !== fromUserId);
  if (staffIds.length > 0) {
    await tx.userStaffLink.createMany({
      data: staffIds.map((staff_user_id) => ({
        tenant_id: tenantId,
        user_id: toUserId,
        staff_user_id
      })),
      skipDuplicates: true
    });
    await tx.userStaffLink.deleteMany({
      where: { tenant_id: tenantId, user_id: fromUserId, staff_user_id: { in: staffIds } }
    });
  }

  if (snap.territoryIds.length > 0) {
    await tx.territoryUserLink.createMany({
      data: snap.territoryIds.map((territory_id) => ({ territory_id, user_id: toUserId })),
      skipDuplicates: true
    });
    await tx.territoryUserLink.deleteMany({
      where: { user_id: fromUserId, territory_id: { in: snap.territoryIds } }
    });
  }

  if (snap.paymentMethods.length > 0) {
    await tx.userPaymentMethodLink.createMany({
      data: snap.paymentMethods.map((payment_method) => ({
        tenant_id: tenantId,
        user_id: toUserId,
        payment_method
      })),
      skipDuplicates: true
    });
    await tx.userPaymentMethodLink.deleteMany({
      where: {
        tenant_id: tenantId,
        user_id: fromUserId,
        payment_method: { in: snap.paymentMethods }
      }
    });
  }

  if (snap.tradeDirectionIds.length > 0) {
    await tx.userTradeDirectionLink.createMany({
      data: snap.tradeDirectionIds.map((trade_direction_id) => ({
        tenant_id: tenantId,
        user_id: toUserId,
        trade_direction_id
      })),
      skipDuplicates: true
    });
    await tx.userTradeDirectionLink.deleteMany({
      where: {
        tenant_id: tenantId,
        user_id: fromUserId,
        trade_direction_id: { in: snap.tradeDirectionIds }
      }
    });
  }

  if (snap.branchCodes.length > 0) {
    await tx.userBranchLink.createMany({
      data: snap.branchCodes.map((branch_code) => ({
        tenant_id: tenantId,
        user_id: toUserId,
        branch_code
      })),
      skipDuplicates: true
    });
  }

  if (snap.warehouses.length > 0) {
    const existing = await tx.warehouseUserLink.findMany({
      where: { user_id: toUserId },
      select: { warehouse_id: true, link_role: true }
    });
    const byId = new Map(existing.map((row) => [row.warehouse_id, row.link_role]));
    const missing = snap.warehouses.filter((row) => !byId.has(row.warehouse_id));
    if (missing.length > 0) {
      await tx.warehouseUserLink.createMany({
        data: missing.map((row) => ({
          user_id: toUserId,
          warehouse_id: row.warehouse_id,
          link_role: row.link_role
        })),
        skipDuplicates: true
      });
    }
    for (const row of snap.warehouses) {
      const currentRole = byId.get(row.warehouse_id);
      if (row.link_role !== "manager" || !currentRole || currentRole === "skladchik" || currentRole === "manager") {
        continue;
      }
      await tx.warehouseUserLink.updateMany({
        where: { user_id: toUserId, warehouse_id: row.warehouse_id, link_role: { not: "skladchik" } },
        data: { link_role: "manager" }
      });
    }
  }

  if (snap.cashDesks.length > 0) {
    const existing = await tx.cashDeskUserLink.findMany({
      where: { user_id: toUserId },
      select: { cash_desk_id: true }
    });
    const have = new Set(existing.map((row) => row.cash_desk_id));
    const missing = snap.cashDesks.filter((row) => !have.has(row.cash_desk_id));
    if (missing.length > 0) {
      await tx.cashDeskUserLink.createMany({
        data: missing.map((row) => ({
          user_id: toUserId,
          cash_desk_id: row.cash_desk_id,
          link_role: row.link_role
        })),
        skipDuplicates: true
      });
    }
  }

  const successor = await tx.user.findFirst({
    where: { id: toUserId, tenant_id: tenantId },
    select: {
      supervisor_user_id: true,
      agent_entitlements: true,
      price_type: true,
      agent_price_types: true,
      territory: true,
      branch: true
    }
  });
  if (!successor) return;

  const mergedEntitlements = mergeMissingEntitlementKeys(successor.agent_entitlements, snap.entitlements);
  const entitlementsChanged =
    JSON.stringify(mergedEntitlements) !== JSON.stringify(asObject(successor.agent_entitlements));

  const data: Prisma.UserUpdateInput = {};
  if (successor.supervisor_user_id == null && snap.supervisorUserId != null && snap.supervisorUserId !== toUserId) {
    data.supervisor = { connect: { id: snap.supervisorUserId } };
  }
  if (!successor.territory && snap.territory) data.territory = snap.territory;
  if (!successor.branch && snap.branch) data.branch = snap.branch;
  if (!successor.price_type && snap.priceType) data.price_type = snap.priceType;
  if (priceTypesEmpty(successor.agent_price_types) && !priceTypesEmpty(snap.priceTypes)) {
    data.agent_price_types = snap.priceTypes as Prisma.InputJsonValue;
  }
  if (entitlementsChanged) {
    data.agent_entitlements = mergedEntitlements as Prisma.InputJsonValue;
  }
  if (Object.keys(data).length > 0) {
    await tx.user.update({ where: { id: toUserId }, data });
  }
}

/** Supervayzer almashtirilganda bevosita bo‘ysunuvchilar yangi xodimga o‘tadi. */
export async function retargetDirectReports(
  tx: Tx,
  tenantId: number,
  fromUserId: number,
  toUserId: number
): Promise<void> {
  if (fromUserId === toUserId) return;
  await tx.user.updateMany({
    where: {
      tenant_id: tenantId,
      supervisor_user_id: fromUserId,
      id: { not: toUserId }
    },
    data: { supervisor_user_id: toUserId }
  });
}
