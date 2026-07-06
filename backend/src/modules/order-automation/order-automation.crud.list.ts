import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { mapAutoConfirmRuleRow, mapRestrictionRuleRow } from "./order-automation.mappers";
import type { AutoConfirmRuleRow, RestrictionRuleRow } from "./order-automation.types";
export type ListQuery = {
  page?: number;
  limit?: number;
  is_active?: boolean;
  search?: string;
  agent_user_id?: number;
  warehouse_id?: number;
  trade_direction_ref?: string;
  payment_method_ref?: string;
  zone?: string;
  region?: string;
  city?: string;
  execution_type?: string;
  request_type_ref?: string;
};

export function buildListWhere(tenantId: number, q: ListQuery): Prisma.OrderRestrictionRuleWhereInput {
  const where: Prisma.OrderRestrictionRuleWhereInput = { tenant_id: tenantId };
  if (q.is_active === true) where.is_active = true;
  if (q.is_active === false) where.is_active = false;
  const and: Prisma.OrderRestrictionRuleWhereInput[] = [];
  const search = q.search?.trim();
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } }
      ]
    });
  }
  if (q.agent_user_id && q.agent_user_id > 0) {
    and.push({ scope_agent_user_ids: { has: q.agent_user_id } });
  }
  if (q.warehouse_id && q.warehouse_id > 0) {
    and.push({ scope_warehouse_ids: { has: q.warehouse_id } });
  }
  if (q.trade_direction_ref?.trim()) {
    const td = q.trade_direction_ref.trim();
    and.push({
      OR: [{ trade_direction_ref: td }, { scope_trade_direction_refs: { has: td } }]
    });
  }
  if (q.payment_method_ref?.trim()) {
    and.push({ payment_method_ref: q.payment_method_ref.trim() });
  }
  if (q.zone?.trim()) and.push({ scope_zones: { has: q.zone.trim() } });
  if (q.region?.trim()) and.push({ scope_regions: { has: q.region.trim() } });
  if (q.city?.trim()) and.push({ scope_cities: { has: q.city.trim() } });
  if (and.length) where.AND = and;
  return where;
}

export async function listRestrictionRules(
  tenantId: number,
  q: ListQuery
): Promise<{ data: RestrictionRuleRow[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(500, Math.max(1, q.limit ?? 50));
  const where = buildListWhere(tenantId, q);
  const [rows, total] = await Promise.all([
    prisma.orderRestrictionRule.findMany({
      where,
      include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } },
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.orderRestrictionRule.count({ where })
  ]);
  const data = await Promise.all(rows.map((r) => mapRestrictionRuleRow(tenantId, r)));
  return { data, total, page, limit };
}

export async function listAutoConfirmRules(
  tenantId: number,
  q: ListQuery
): Promise<{ data: AutoConfirmRuleRow[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(500, Math.max(1, q.limit ?? 50));
  const base = buildListWhere(tenantId, q) as Prisma.OrderAutoConfirmRuleWhereInput;
  const and: Prisma.OrderAutoConfirmRuleWhereInput[] = Array.isArray(base.AND)
    ? [...base.AND]
    : base.AND
      ? [base.AND]
      : [];
  if (q.execution_type?.trim()) and.push({ execution_type: q.execution_type.trim() });
  if (q.request_type_ref?.trim()) {
    and.push({ request_type_refs: { has: q.request_type_ref.trim() } });
  }
  const where: Prisma.OrderAutoConfirmRuleWhereInput = {
    tenant_id: tenantId,
    is_active: base.is_active,
    AND: and.length ? and : undefined
  };
  const [rows, total] = await Promise.all([
    prisma.orderAutoConfirmRule.findMany({
      where,
      include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } },
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.orderAutoConfirmRule.count({ where })
  ]);
  const data = await Promise.all(rows.map((r) => mapAutoConfirmRuleRow(tenantId, r)));
  return { data, total, page, limit };
}
