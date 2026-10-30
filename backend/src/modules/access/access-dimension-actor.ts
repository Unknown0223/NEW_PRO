import type { Prisma } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { actorHasUnrestrictedDataScope } from "./access-staff-scope";
import { accessStaffDirectoryWhere } from "../staff/staff.route.shared";
import { loadActorGrantableKeys } from "./access-grant-guard";
import { accessWebAssignableUserWhere } from "./access-web-users.filter";

/** `null` — admin, cheklov yo‘q. */
export type ActorDimensionBounds = {
  staff: Prisma.UserWhereInput;
  cashDeskIds: Set<number>;
  warehouseIds: Set<number>;
  branchCodes: Set<string>;
  paymentMethods: Set<string>;
  tradeDirectionIds: Set<number>;
  territoryIds: Set<number>;
  grantableKeys: Set<string>;
};

function norm(s: string): string {
  return s.trim().toLocaleUpperCase("en-US");
}

export async function loadActorDimensionBounds(
  request: FastifyRequest,
  tenantId: number
): Promise<ActorDimensionBounds | null> {
  const role = getAccessUser(request)?.role ?? "";
  const userId = actorUserIdOrNull(request);
  if (!userId || actorHasUnrestrictedDataScope(role)) return null;
  const staff = (await accessStaffDirectoryWhere(request, tenantId)) ?? { id: userId };
  const [cash, warehouses, branches, payments, directions, territories, grantable] = await Promise.all([
    prisma.cashDeskUserLink.findMany({
      where: { user_id: userId, cash_desk: { tenant_id: tenantId } },
      select: { cash_desk_id: true }
    }),
    prisma.warehouseUserLink.findMany({
      where: { user_id: userId, warehouse: { tenant_id: tenantId } },
      select: { warehouse_id: true }
    }),
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { branch: true, branch_links: { select: { branch_code: true } } }
    }),
    prisma.userPaymentMethodLink.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      select: { payment_method: true }
    }),
    prisma.userTradeDirectionLink.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      select: { trade_direction_id: true }
    }),
    prisma.territoryUserLink.findMany({
      where: { user_id: userId, territory: { tenant_id: tenantId } },
      select: { territory_id: true }
    }),
    loadActorGrantableKeys(tenantId, { userId, role })
  ]);
  const branchCodes = new Set<string>();
  if (branches?.branch?.trim()) branchCodes.add(norm(branches.branch));
  for (const b of branches?.branch_links ?? []) {
    if (b.branch_code?.trim()) branchCodes.add(norm(b.branch_code));
  }
  return {
    staff,
    cashDeskIds: new Set(cash.map((r) => r.cash_desk_id)),
    warehouseIds: new Set(warehouses.map((r) => r.warehouse_id)),
    branchCodes,
    paymentMethods: new Set(payments.map((r) => r.payment_method.trim()).filter(Boolean)),
    tradeDirectionIds: new Set(directions.map((r) => r.trade_direction_id)),
    territoryIds: new Set(territories.map((r) => r.territory_id)),
    grantableKeys: grantable
  };
}

export function scopedAssignableUsers(
  tenantId: number,
  bounds: ActorDimensionBounds | null
): Prisma.UserWhereInput {
  const base = accessWebAssignableUserWhere(tenantId);
  if (!bounds) return base;
  return { AND: [base, bounds.staff] };
}

export async function keepUsersInsideBounds<T extends { id: number }>(
  tenantId: number,
  bounds: ActorDimensionBounds | null,
  rows: T[]
): Promise<T[]> {
  if (!bounds || rows.length === 0) return rows;
  const allowed = await prisma.user.findMany({
    where: { AND: [scopedAssignableUsers(tenantId, bounds), { id: { in: rows.map((r) => r.id) } }] },
    select: { id: true }
  });
  const ids = new Set(allowed.map((r) => r.id));
  return rows.filter((r) => ids.has(r.id));
}

type ScopePatch = {
  branch_codes?: string[];
  warehouse_ids?: number[];
  cash_desk_ids?: number[];
  payment_methods?: string[];
  territory_ids?: number[];
  trade_direction_ids?: number[];
  supervisee_user_ids?: number[];
};

function normCode(s: string): string {
  return s.trim().toLocaleUpperCase("en-US");
}

/** Ko‘rinmaydigan bog‘lanishlar saqlanadi. Yangi, o‘zida yo‘q bog‘lanish rad etiladi. */
export async function retainHiddenScopeOnPatch(
  tenantId: number,
  userId: number,
  body: ScopePatch,
  bounds: ActorDimensionBounds | null
): Promise<string | null> {
  if (!bounds) return null;
  if (body.cash_desk_ids) {
    const cur = (
      await prisma.cashDeskUserLink.findMany({
        where: { user_id: userId, cash_desk: { tenant_id: tenantId } },
        select: { cash_desk_id: true }
      })
    ).map((r) => r.cash_desk_id);
    const hidden = cur.filter((id) => !bounds.cashDeskIds.has(id));
    const illegal = body.cash_desk_ids.filter((id) => !bounds.cashDeskIds.has(id) && !hidden.includes(id));
    if (illegal.length > 0) return "Чужую кассу прикрепить нельзя.";
    body.cash_desk_ids = [...new Set([...body.cash_desk_ids.filter((id) => bounds.cashDeskIds.has(id)), ...hidden])];
  }
  if (body.warehouse_ids) {
    const cur = (
      await prisma.warehouseUserLink.findMany({
        where: { user_id: userId, warehouse: { tenant_id: tenantId } },
        select: { warehouse_id: true }
      })
    ).map((r) => r.warehouse_id);
    const hidden = cur.filter((id) => !bounds.warehouseIds.has(id));
    const illegal = body.warehouse_ids.filter((id) => !bounds.warehouseIds.has(id) && !hidden.includes(id));
    if (illegal.length > 0) return "Чужой склад прикрепить нельзя.";
    body.warehouse_ids = [...new Set([...body.warehouse_ids.filter((id) => bounds.warehouseIds.has(id)), ...hidden])];
  }
  if (body.trade_direction_ids) {
    const cur = (
      await prisma.userTradeDirectionLink.findMany({
        where: { user_id: userId, tenant_id: tenantId },
        select: { trade_direction_id: true }
      })
    ).map((r) => r.trade_direction_id);
    const hidden = cur.filter((id) => !bounds.tradeDirectionIds.has(id));
    const illegal = body.trade_direction_ids.filter((id) => !bounds.tradeDirectionIds.has(id) && !hidden.includes(id));
    if (illegal.length > 0) return "Чужое направление прикрепить нельзя.";
    body.trade_direction_ids = [...new Set([...body.trade_direction_ids.filter((id) => bounds.tradeDirectionIds.has(id)), ...hidden])];
  }
  if (body.territory_ids) {
    const cur = (
      await prisma.territoryUserLink.findMany({
        where: { user_id: userId, territory: { tenant_id: tenantId } },
        select: { territory_id: true }
      })
    ).map((r) => r.territory_id);
    const hidden = cur.filter((id) => !bounds.territoryIds.has(id));
    const illegal = body.territory_ids.filter((id) => !bounds.territoryIds.has(id) && !hidden.includes(id));
    if (illegal.length > 0) return "Чужую территорию прикрепить нельзя.";
    body.territory_ids = [...new Set([...body.territory_ids.filter((id) => bounds.territoryIds.has(id)), ...hidden])];
  }
  if (body.branch_codes) {
    const cur = (
      await prisma.userBranchLink.findMany({
        where: { user_id: userId, tenant_id: tenantId },
        select: { branch_code: true }
      })
    ).map((r) => r.branch_code);
    const hidden = cur.filter((code) => !bounds.branchCodes.has(normCode(code)));
    const illegal = body.branch_codes.filter((code) => !bounds.branchCodes.has(normCode(code)) && !hidden.some((h) => normCode(h) === normCode(code)));
    if (illegal.length > 0) return "Чужой филиал прикрепить нельзя.";
    body.branch_codes = [...new Set([...body.branch_codes.filter((code) => bounds.branchCodes.has(normCode(code))), ...hidden])];
  }
  if (body.payment_methods) {
    const cur = (
      await prisma.userPaymentMethodLink.findMany({
        where: { user_id: userId, tenant_id: tenantId },
        select: { payment_method: true }
      })
    ).map((r) => r.payment_method);
    const hidden = cur.filter((m) => !bounds.paymentMethods.has(m));
    const illegal = body.payment_methods.filter((m) => !bounds.paymentMethods.has(m) && !hidden.includes(m));
    if (illegal.length > 0) return "Чужой способ оплаты прикрепить нельзя.";
    body.payment_methods = [...new Set([...body.payment_methods.filter((m) => bounds.paymentMethods.has(m)), ...hidden])];
  }
  if (body.supervisee_user_ids) {
    const allowed = await keepUsersInsideBounds(
      tenantId,
      bounds,
      body.supervisee_user_ids.map((id) => ({ id }))
    );
    const allowedIds = new Set(allowed.map((r) => r.id));
    const illegal = body.supervisee_user_ids.filter((id) => !allowedIds.has(id));
    if (illegal.length > 0) return "Чужого сотрудника прикрепить нельзя.";
  }
  return null;
}

export function maskScopeForActor<T extends {
  branches: string[];
  warehouses: number[];
  cash_desks: number[];
  payment_methods: string[];
  territories: number[];
  trade_directions: number[];
}>(bounds: ActorDimensionBounds | null, scope: T): T {
  if (!bounds) return scope;
  return {
    ...scope,
    branches: scope.branches.filter((c) => bounds.branchCodes.has(normCode(c))),
    warehouses: scope.warehouses.filter((id) => bounds.warehouseIds.has(id)),
    cash_desks: scope.cash_desks.filter((id) => bounds.cashDeskIds.has(id)),
    payment_methods: scope.payment_methods.filter((m) => bounds.paymentMethods.has(m)),
    territories: scope.territories.filter((id) => bounds.territoryIds.has(id)),
    trade_directions: scope.trade_directions.filter((id) => bounds.tradeDirectionIds.has(id))
  };
}

export function dimensionKeyAllowed(
  type: string,
  key: string,
  bounds: ActorDimensionBounds | null
): boolean {
  if (!bounds) return true;
  if (type === "cash_desks") return bounds.cashDeskIds.has(Number(key));
  if (type === "warehouses") return bounds.warehouseIds.has(Number(key));
  if (type === "trade_directions") return bounds.tradeDirectionIds.has(Number(key));
  if (type === "branches") return bounds.branchCodes.has(norm(key));
  if (type === "payment_methods") return bounds.paymentMethods.has(key.trim());
  if (type === "operations") return bounds.grantableKeys.has(key.trim());
  return false;
}
