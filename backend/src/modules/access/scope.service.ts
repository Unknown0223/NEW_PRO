import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type AccessScopePayload = {
  branch_codes?: string[];
  warehouse_ids?: number[];
  /** `true` — shu ombor bo‘yicha boshqa foydalanuvchilarni biriktirish; `false` — faqat o‘zi ishlatadi (`operator`). */
  warehouse_delegate?: { warehouse_id: number; delegate: boolean };
  cash_desk_ids?: number[];
  payment_methods?: string[];
  territory_ids?: number[];
  trade_direction_ids?: number[];
};

export type PatchUserScopesTxOpts = {
  /** Bulk slice uchun bitta `findMany` — har user uchun qayta-qayta emas. */
  validTerritoryIds?: ReadonlySet<number>;
};

/** Bir `tx` ichida — `applyAccessUserPatchBody` bilan bitta commit (2× tranzaksiya emas). */
export async function patchUserScopesTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  payload: Partial<AccessScopePayload>,
  opts?: PatchUserScopesTxOpts
): Promise<void> {
  if (payload.branch_codes !== undefined) {
    const branchCodes = [...new Set(payload.branch_codes.map((x) => String(x).trim()).filter(Boolean))];
    await tx.userBranchLink.deleteMany({ where: { tenant_id: tenantId, user_id: userId } });
    if (branchCodes.length > 0) {
      await tx.userBranchLink.createMany({
        data: branchCodes.map((branch_code) => ({ tenant_id: tenantId, user_id: userId, branch_code })),
        skipDuplicates: true
      });
    }
  }

  if (payload.payment_methods !== undefined) {
    const paymentMethods = [...new Set(payload.payment_methods.map((x) => String(x).trim()).filter(Boolean))];
    await tx.userPaymentMethodLink.deleteMany({ where: { tenant_id: tenantId, user_id: userId } });
    if (paymentMethods.length > 0) {
      await tx.userPaymentMethodLink.createMany({
        data: paymentMethods.map((payment_method) => ({ tenant_id: tenantId, user_id: userId, payment_method })),
        skipDuplicates: true
      });
    }
  }

  if (payload.warehouse_ids !== undefined) {
    const warehouseIds = [...new Set(payload.warehouse_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    await tx.warehouseUserLink.deleteMany({ where: { user_id: userId } });
    if (warehouseIds.length > 0) {
      await tx.warehouseUserLink.createMany({
        data: warehouseIds.map((warehouse_id) => ({ user_id: userId, warehouse_id, link_role: "operator" })),
        skipDuplicates: true
      });
    }
  }

  if (payload.cash_desk_ids !== undefined) {
    const cashDeskIds = [...new Set(payload.cash_desk_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    await tx.cashDeskUserLink.deleteMany({ where: { user_id: userId } });
    if (cashDeskIds.length > 0) {
      await tx.cashDeskUserLink.createMany({
        data: cashDeskIds.map((cash_desk_id) => ({ user_id: userId, cash_desk_id, link_role: "operator" })),
        skipDuplicates: true
      });
    }
  }

  if (payload.territory_ids !== undefined) {
    const territoryIds = [...new Set(payload.territory_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    await tx.territoryUserLink.deleteMany({
      where: { user_id: userId, territory: { tenant_id: tenantId } }
    });
    if (territoryIds.length > 0) {
      let validIds: number[];
      if (opts?.validTerritoryIds) {
        validIds = territoryIds.filter((id) => opts.validTerritoryIds!.has(id));
      } else {
        const valid = await tx.territory.findMany({
          where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
          select: { id: true }
        });
        validIds = valid.map((t) => t.id);
      }
      if (validIds.length > 0) {
        await tx.territoryUserLink.createMany({
          data: validIds.map((territory_id) => ({ territory_id, user_id: userId })),
          skipDuplicates: true
        });
      }
    }
  }

  if (payload.trade_direction_ids !== undefined) {
    const directionIds = [...new Set(payload.trade_direction_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    await tx.userTradeDirectionLink.deleteMany({ where: { tenant_id: tenantId, user_id: userId } });
    if (directionIds.length > 0) {
      const valid = await tx.tradeDirection.findMany({
        where: { tenant_id: tenantId, id: { in: directionIds } },
        select: { id: true }
      });
      const validIds = valid.map((d) => d.id);
      if (validIds.length > 0) {
        await tx.userTradeDirectionLink.createMany({
          data: validIds.map((trade_direction_id) => ({ tenant_id: tenantId, user_id: userId, trade_direction_id })),
          skipDuplicates: true
        });
      }
    }
  }

  if (payload.warehouse_delegate !== undefined) {
    const warehouse_id = Number(payload.warehouse_delegate.warehouse_id);
    if (!Number.isInteger(warehouse_id) || warehouse_id < 1) return;
    const delegate = Boolean(payload.warehouse_delegate.delegate);
    const link_role = delegate ? "manager" : "operator";
    const cur = await tx.warehouseUserLink.findFirst({
      where: { user_id: userId, warehouse_id },
      select: { link_role: true }
    });
    if (cur?.link_role === "skladchik") return;
    const upd = await tx.warehouseUserLink.updateMany({
      where: { user_id: userId, warehouse_id, link_role: { not: "skladchik" } },
      data: { link_role }
    });
    if (upd.count === 0 && delegate) {
      await tx.warehouseUserLink.create({
        data: { user_id: userId, warehouse_id, link_role: "manager" }
      });
    }
  }
}

/** Bulk: bitta ombor — barcha foydalanuvchilar uchun `link_role` (masalan 1000+ qator — bitta `updateMany`). */
export async function bulkSetWarehouseDelegateForUsers(
  tx: Prisma.TransactionClient,
  warehouseId: number,
  userIds: number[],
  delegate: boolean
): Promise<void> {
  if (userIds.length === 0) return;
  const link_role = delegate ? "manager" : "operator";
  await tx.warehouseUserLink.updateMany({
    where: { warehouse_id: warehouseId, user_id: { in: userIds }, link_role: { not: "skladchik" } },
    data: { link_role }
  });
}

/** Har bir maydon alohida: faqat berilgan maydonlar yangilanadi (undefined = tegmaymiz). */
export async function patchUserScopes(tenantId: number, userId: number, payload: Partial<AccessScopePayload>) {
  await prisma.$transaction(async (tx) => {
    await patchUserScopesTx(tx, tenantId, userId, payload);
  });
}

/** Barcha scope maydonlarini bir vaqtda almashtirish (clone va eski to‘liq replace). */
export async function replaceUserScopes(tenantId: number, userId: number, payload: AccessScopePayload) {
  await patchUserScopes(tenantId, userId, {
    branch_codes: payload.branch_codes ?? [],
    warehouse_ids: payload.warehouse_ids ?? [],
    cash_desk_ids: payload.cash_desk_ids ?? [],
    payment_methods: payload.payment_methods ?? [],
    territory_ids: payload.territory_ids ?? [],
    trade_direction_ids: payload.trade_direction_ids ?? []
  });
}
