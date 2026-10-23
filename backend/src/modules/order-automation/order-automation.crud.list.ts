import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { softVoidListFilter } from "../../lib/soft-void";
import { mapAutoConfirmRuleRow, mapRestrictionRuleRow } from "./order-automation.mappers";
import type { AutoConfirmRuleRow, RestrictionRuleRow } from "./order-automation.types";
export type ListQuery = {
  page?: number;
  limit?: number;
  is_active?: boolean;
  archive?: boolean;
  search?: string;
  agent_user_id?: number;
  agent_user_ids?: number[];
  warehouse_id?: number;
  warehouse_ids?: number[];
  trade_direction_ref?: string;
  payment_method_ref?: string;
  zone?: string;
  region?: string;
  city?: string;
  execution_type?: string;
  request_type_ref?: string;
};

function csvParts(raw?: string): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
}

export function buildListWhere(tenantId: number, q: ListQuery): Prisma.OrderRestrictionRuleWhereInput {
  const where: Prisma.OrderRestrictionRuleWhereInput = {
    tenant_id: tenantId,
    ...softVoidListFilter(q.archive)
  };
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
  const agentIds = [...new Set([...(q.agent_user_ids ?? []), ...(q.agent_user_id ? [q.agent_user_id] : [])])].filter(
    (id) => id > 0
  );
  if (agentIds.length === 1) and.push({ scope_agent_user_ids: { has: agentIds[0] } });
  else if (agentIds.length > 1) {
    and.push({ OR: agentIds.map((id) => ({ scope_agent_user_ids: { has: id } })) });
  }
  const warehouseIds = [...new Set([...(q.warehouse_ids ?? []), ...(q.warehouse_id ? [q.warehouse_id] : [])])].filter(
    (id) => id > 0
  );
  if (warehouseIds.length === 1) and.push({ scope_warehouse_ids: { has: warehouseIds[0] } });
  else if (warehouseIds.length > 1) {
    and.push({ OR: warehouseIds.map((id) => ({ scope_warehouse_ids: { has: id } })) });
  }
  const tradeDirs = csvParts(q.trade_direction_ref);
  if (tradeDirs.length > 0) {
    and.push({
      OR: tradeDirs.flatMap((td) => [{ trade_direction_ref: td }, { scope_trade_direction_refs: { has: td } }])
    });
  }
  const payMethods = csvParts(q.payment_method_ref);
  if (payMethods.length === 1) and.push({ payment_method_ref: payMethods[0] });
  else if (payMethods.length > 1) and.push({ payment_method_ref: { in: payMethods } });
  const zones = csvParts(q.zone);
  if (zones.length === 1) and.push({ scope_zones: { has: zones[0] } });
  else if (zones.length > 1) and.push({ OR: zones.map((z) => ({ scope_zones: { has: z } })) });
  const regions = csvParts(q.region);
  if (regions.length === 1) and.push({ scope_regions: { has: regions[0] } });
  else if (regions.length > 1) and.push({ OR: regions.map((z) => ({ scope_regions: { has: z } })) });
  const cities = csvParts(q.city);
  if (cities.length === 1) and.push({ scope_cities: { has: cities[0] } });
  else if (cities.length > 1) and.push({ OR: cities.map((z) => ({ scope_cities: { has: z } })) });
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
  const execTypes = csvParts(q.execution_type);
  if (execTypes.length === 1) and.push({ execution_type: execTypes[0] });
  else if (execTypes.length > 1) and.push({ execution_type: { in: execTypes } });
  const requestTypes = csvParts(q.request_type_ref);
  if (requestTypes.length === 1) and.push({ request_type_refs: { has: requestTypes[0] } });
  else if (requestTypes.length > 1) {
    and.push({ OR: requestTypes.map((t) => ({ request_type_refs: { has: t } })) });
  }
  const where: Prisma.OrderAutoConfirmRuleWhereInput = {
    tenant_id: tenantId,
    ...softVoidListFilter(q.archive),
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
