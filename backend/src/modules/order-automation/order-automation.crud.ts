import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  fetchAutoConfirmRuleFull,
  fetchRestrictionRuleFull,
  mapAutoConfirmRuleRow,
  mapRestrictionRuleRow,
  normalizeExecutionType,
  normalizePositiveIds,
  normalizeSourceChannels,
  normalizeStringArray,
  parseExecutionTime,
  scopeScalarsFromInput
} from "./order-automation.mappers";
import type {
  AutoConfirmRuleInput,
  AutoConfirmRuleRow,
  RestrictionRuleInput,
  RestrictionRuleRow
} from "./order-automation.types";
import {
  normalizeScopeWarehouseIds,
  resolveAllowedCurrencyCode,
  validateAutoConfirmInput,
  validateRestrictionInput,
  validateRuleAmounts
} from "./order-automation.validate";

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

function buildListWhere(tenantId: number, q: ListQuery): Prisma.OrderRestrictionRuleWhereInput {
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

export async function createRestrictionRule(
  tenantId: number,
  input: RestrictionRuleInput,
  actorUserId: number | null
): Promise<RestrictionRuleRow> {
  validateRestrictionInput(input);
  const currency_code = await resolveAllowedCurrencyCode(tenantId, input.currency_code);
  const scope_warehouse_ids = await normalizeScopeWarehouseIds(tenantId, input.scope_warehouse_ids);
  const row = await prisma.orderRestrictionRule.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      is_active: input.is_active ?? true,
      comment: input.comment?.trim() ?? "",
      ...scopeScalarsFromInput({ ...input, currency_code, scope_warehouse_ids }),
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapRestrictionRuleRow(tenantId, row);
}

export async function updateRestrictionRule(
  tenantId: number,
  id: number,
  input: Partial<RestrictionRuleInput>,
  actorUserId: number | null
): Promise<RestrictionRuleRow> {
  const existing = await fetchRestrictionRuleFull(tenantId, id);
  if (!existing) throw new Error("NOT_FOUND");
  if (input.name !== undefined && !input.name.trim()) throw new Error("VALIDATION");
  validateRuleAmounts(
    input.amount_from ?? (existing.amount_from != null ? Number(existing.amount_from) : null),
    input.amount_to ?? (existing.amount_to != null ? Number(existing.amount_to) : null)
  );
  const currencyPatch =
    input.currency_code !== undefined
      ? { currency_code: await resolveAllowedCurrencyCode(tenantId, input.currency_code) }
      : {};
  const row = await prisma.orderRestrictionRule.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.comment !== undefined ? { comment: input.comment?.trim() ?? "" } : {}),
      ...(input.scope_agent_user_ids !== undefined
        ? { scope_agent_user_ids: normalizePositiveIds(input.scope_agent_user_ids) }
        : {}),
      ...(input.scope_warehouse_ids !== undefined
        ? { scope_warehouse_ids: await normalizeScopeWarehouseIds(tenantId, input.scope_warehouse_ids) }
        : {}),
      ...(input.scope_territory_refs !== undefined
        ? { scope_territory_refs: normalizeStringArray(input.scope_territory_refs) }
        : {}),
      ...(input.scope_zones !== undefined ? { scope_zones: normalizeStringArray(input.scope_zones) } : {}),
      ...(input.scope_regions !== undefined
        ? { scope_regions: normalizeStringArray(input.scope_regions) }
        : {}),
      ...(input.scope_cities !== undefined ? { scope_cities: normalizeStringArray(input.scope_cities) } : {}),
      ...(input.payment_method_ref !== undefined
        ? { payment_method_ref: input.payment_method_ref?.trim() || null }
        : {}),
      ...(input.scope_trade_direction_refs !== undefined || input.trade_direction_ref !== undefined
        ? (() => {
            const tradeRefs = normalizeStringArray(
              input.scope_trade_direction_refs ??
                (input.trade_direction_ref?.trim() ? [input.trade_direction_ref.trim()] : [])
            );
            return {
              scope_trade_direction_refs: tradeRefs,
              trade_direction_ref: tradeRefs[0] ?? null
            };
          })()
        : {}),
      ...(input.consignment_mode !== undefined
        ? { consignment_mode: input.consignment_mode }
        : {}),
      ...currencyPatch,
      ...(input.amount_from !== undefined ? { amount_from: input.amount_from } : {}),
      ...(input.amount_to !== undefined ? { amount_to: input.amount_to } : {}),
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapRestrictionRuleRow(tenantId, row);
}

export async function deleteRestrictionRule(tenantId: number, id: number): Promise<void> {
  const r = await prisma.orderRestrictionRule.deleteMany({ where: { tenant_id: tenantId, id } });
  if (r.count === 0) throw new Error("NOT_FOUND");
}

export async function duplicateRestrictionRule(
  tenantId: number,
  id: number,
  actorUserId: number | null
): Promise<RestrictionRuleRow> {
  const src = await fetchRestrictionRuleFull(tenantId, id);
  if (!src) throw new Error("NOT_FOUND");
  const scope_warehouse_ids = await normalizeScopeWarehouseIds(tenantId, src.scope_warehouse_ids);
  const row = await prisma.orderRestrictionRule.create({
    data: {
      tenant_id: tenantId,
      name: `${src.name} (копия)`,
      is_active: src.is_active,
      comment: src.comment,
      currency_code: src.currency_code,
      amount_from: src.amount_from,
      amount_to: src.amount_to,
      scope_agent_user_ids: [...src.scope_agent_user_ids],
      scope_warehouse_ids,
      scope_territory_refs: [...src.scope_territory_refs],
      scope_zones: [...src.scope_zones],
      scope_regions: [...src.scope_regions],
      scope_cities: [...src.scope_cities],
      payment_method_ref: src.payment_method_ref,
      trade_direction_ref: src.trade_direction_ref,
      scope_trade_direction_refs: [...src.scope_trade_direction_refs],
      consignment_mode: src.consignment_mode,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapRestrictionRuleRow(tenantId, row);
}

export async function createAutoConfirmRule(
  tenantId: number,
  input: AutoConfirmRuleInput,
  actorUserId: number | null
): Promise<AutoConfirmRuleRow> {
  validateAutoConfirmInput(input);
  const currency_code = await resolveAllowedCurrencyCode(tenantId, input.currency_code);
  const scope_warehouse_ids = await normalizeScopeWarehouseIds(tenantId, input.scope_warehouse_ids);
  const row = await prisma.orderAutoConfirmRule.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      is_active: input.is_active ?? true,
      comment: input.comment?.trim() ?? "",
      ...scopeScalarsFromInput({ ...input, currency_code, scope_warehouse_ids }),
      request_type_refs: normalizeStringArray(input.request_type_refs),
      source_channels: normalizeSourceChannels(input.source_channels),
      execution_type: normalizeExecutionType(input.execution_type),
      execution_time: parseExecutionTime(input.execution_time),
      n_value: input.n_value ?? null,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapAutoConfirmRuleRow(tenantId, row);
}

export async function updateAutoConfirmRule(
  tenantId: number,
  id: number,
  input: Partial<AutoConfirmRuleInput>,
  actorUserId: number | null
): Promise<AutoConfirmRuleRow> {
  const existing = await fetchAutoConfirmRuleFull(tenantId, id);
  if (!existing) throw new Error("NOT_FOUND");
  const currencyPatch =
    input.currency_code !== undefined
      ? { currency_code: await resolveAllowedCurrencyCode(tenantId, input.currency_code) }
      : {};
  const row = await prisma.orderAutoConfirmRule.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.comment !== undefined ? { comment: input.comment?.trim() ?? "" } : {}),
      ...(input.scope_agent_user_ids !== undefined
        ? { scope_agent_user_ids: normalizePositiveIds(input.scope_agent_user_ids) }
        : {}),
      ...(input.scope_warehouse_ids !== undefined
        ? { scope_warehouse_ids: await normalizeScopeWarehouseIds(tenantId, input.scope_warehouse_ids) }
        : {}),
      ...(input.scope_territory_refs !== undefined
        ? { scope_territory_refs: normalizeStringArray(input.scope_territory_refs) }
        : {}),
      ...(input.scope_zones !== undefined ? { scope_zones: normalizeStringArray(input.scope_zones) } : {}),
      ...(input.scope_regions !== undefined
        ? { scope_regions: normalizeStringArray(input.scope_regions) }
        : {}),
      ...(input.scope_cities !== undefined ? { scope_cities: normalizeStringArray(input.scope_cities) } : {}),
      ...(input.payment_method_ref !== undefined
        ? { payment_method_ref: input.payment_method_ref?.trim() || null }
        : {}),
      ...(input.scope_trade_direction_refs !== undefined || input.trade_direction_ref !== undefined
        ? (() => {
            const tradeRefs = normalizeStringArray(
              input.scope_trade_direction_refs ??
                (input.trade_direction_ref?.trim() ? [input.trade_direction_ref.trim()] : [])
            );
            return {
              scope_trade_direction_refs: tradeRefs,
              trade_direction_ref: tradeRefs[0] ?? null
            };
          })()
        : {}),
      ...(input.consignment_mode !== undefined ? { consignment_mode: input.consignment_mode } : {}),
      ...currencyPatch,
      ...(input.amount_from !== undefined ? { amount_from: input.amount_from } : {}),
      ...(input.amount_to !== undefined ? { amount_to: input.amount_to } : {}),
      ...(input.request_type_refs !== undefined
        ? { request_type_refs: normalizeStringArray(input.request_type_refs) }
        : {}),
      ...(input.source_channels !== undefined
        ? { source_channels: normalizeSourceChannels(input.source_channels) }
        : {}),
      ...(input.execution_type !== undefined
        ? { execution_type: normalizeExecutionType(input.execution_type) }
        : {}),
      ...(input.execution_time !== undefined
        ? { execution_time: parseExecutionTime(input.execution_time) }
        : {}),
      ...(input.n_value !== undefined ? { n_value: input.n_value } : {}),
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapAutoConfirmRuleRow(tenantId, row);
}

export async function deleteAutoConfirmRule(tenantId: number, id: number): Promise<void> {
  const r = await prisma.orderAutoConfirmRule.deleteMany({ where: { tenant_id: tenantId, id } });
  if (r.count === 0) throw new Error("NOT_FOUND");
}

export async function duplicateAutoConfirmRule(
  tenantId: number,
  id: number,
  actorUserId: number | null
): Promise<AutoConfirmRuleRow> {
  const src = await fetchAutoConfirmRuleFull(tenantId, id);
  if (!src) throw new Error("NOT_FOUND");
  const scope_warehouse_ids = await normalizeScopeWarehouseIds(tenantId, src.scope_warehouse_ids);
  const row = await prisma.orderAutoConfirmRule.create({
    data: {
      tenant_id: tenantId,
      name: `${src.name} (копия)`,
      is_active: src.is_active,
      comment: src.comment,
      currency_code: src.currency_code,
      amount_from: src.amount_from,
      amount_to: src.amount_to,
      scope_agent_user_ids: [...src.scope_agent_user_ids],
      scope_warehouse_ids,
      scope_territory_refs: [...src.scope_territory_refs],
      scope_zones: [...src.scope_zones],
      scope_regions: [...src.scope_regions],
      scope_cities: [...src.scope_cities],
      payment_method_ref: src.payment_method_ref,
      trade_direction_ref: src.trade_direction_ref,
      scope_trade_direction_refs: [...src.scope_trade_direction_refs],
      consignment_mode: src.consignment_mode,
      request_type_refs: [...src.request_type_refs],
      source_channels: [...src.source_channels],
      execution_type: src.execution_type,
      execution_time: src.execution_time,
      n_value: src.n_value,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId
    },
    include: { created_by: { select: { id: true, name: true } }, updated_by: { select: { id: true, name: true } } }
  });
  return mapAutoConfirmRuleRow(tenantId, row);
}
