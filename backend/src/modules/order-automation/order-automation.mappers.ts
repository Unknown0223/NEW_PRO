import type {
  OrderAutoConfirmRule,
  OrderRestrictionRule,
  Prisma
} from "@prisma/client";
import { prisma } from "../../config/database";
import type {
  AutoConfirmRuleDb,
  AutoConfirmRuleRow,
  AutoConfirmExecutionType,
  ConsignmentMode,
  RestrictionRuleDb,
  RestrictionRuleRow,
  SourceChannel
} from "./order-automation.types";
import {
  autoConfirmRuleInclude,
  restrictionRuleInclude
} from "./order-automation.types";
import { isWarehouseEligibleForAutomationScope } from "./order-automation.warehouse-scope";

export function formatRuleDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatExecutionTime(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseExecutionTime(raw: string | null | undefined): Date | null {
  const t = raw?.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (!m) return null;
  const d = new Date();
  d.setUTCHours(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0, 0);
  return d;
}

export function tradeDirectionRefsFromDb(
  r: Pick<OrderRestrictionRule, "scope_trade_direction_refs" | "trade_direction_ref">
): string[] {
  const scoped = normalizeStringArray(r.scope_trade_direction_refs);
  if (scoped.length) return scoped;
  const legacy = r.trade_direction_ref?.trim();
  return legacy ? [legacy] : [];
}

export function normalizeStringArray(vals: readonly string[] | undefined): string[] {
  const out = new Set<string>();
  for (const v of vals ?? []) {
    const t = String(v).trim();
    if (t) out.add(t);
  }
  return [...out];
}

export function normalizePositiveIds(ids: readonly number[] | undefined): number[] {
  return [...new Set((ids ?? []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

export function normalizeConsignmentMode(v: string | undefined): ConsignmentMode {
  if (v === "yes" || v === "no") return v;
  return "all";
}

export function normalizeExecutionType(v: string | undefined): AutoConfirmExecutionType {
  if (v === "exact_time" || v === "business_days_n") return v;
  return "instant";
}

export function normalizeSourceChannels(channels: readonly string[] | undefined): SourceChannel[] {
  const out: SourceChannel[] = [];
  for (const c of channels ?? []) {
    if (c === "web" || c === "mobile") out.push(c);
  }
  return [...new Set(out)];
}

async function resolveWarehouseNames(tenantId: number, ids: number[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.warehouse.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, name: true, is_active: true }
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const names: string[] = [];
  for (const id of ids) {
    const w = byId.get(id);
    if (!w || !isWarehouseEligibleForAutomationScope(w)) continue;
    names.push(w.name.trim() || `#${id}`);
  }
  return names;
}

async function resolveAgentLabels(
  tenantId: number,
  agentIds: number[]
): Promise<{ agent_user_ids: number[]; agent_id: number | null; agent_name: string | null }> {
  if (agentIds.length === 0) {
    return { agent_user_ids: [], agent_id: null, agent_name: null };
  }
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: agentIds } },
    select: { id: true, name: true }
  });
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  const names = agentIds.map((id) => byId.get(id) ?? `#${id}`);
  return {
    agent_user_ids: [...agentIds],
    agent_id: agentIds.length === 1 ? agentIds[0]! : null,
    agent_name: names.length ? names.join(", ") : null
  };
}

function baseScopeFromRule(r: OrderRestrictionRule | OrderAutoConfirmRule) {
  return {
    currency_code: r.currency_code,
    amount_from: r.amount_from != null ? Number(r.amount_from) : null,
    amount_to: r.amount_to != null ? Number(r.amount_to) : null,
    warehouse_ids: [...r.scope_warehouse_ids],
    payment_method_ref: r.payment_method_ref,
    trade_direction_ref: r.trade_direction_ref,
    trade_direction_refs: tradeDirectionRefsFromDb(r),
    territory_refs: [...r.scope_territory_refs],
    zones: [...r.scope_zones],
    regions: [...r.scope_regions],
    cities: [...r.scope_cities],
    consignment_mode: normalizeConsignmentMode(r.consignment_mode),
    comment: r.comment,
    is_active: r.is_active,
    created_at: formatRuleDateTime(r.created_at),
    updated_at: formatRuleDateTime(r.updated_at),
    created_by: null as string | null,
    updated_by: null as string | null
  };
}

export async function mapRestrictionRuleRow(
  tenantId: number,
  r: RestrictionRuleDb
): Promise<RestrictionRuleRow> {
  const agent = await resolveAgentLabels(tenantId, r.scope_agent_user_ids);
  const warehouse_names = await resolveWarehouseNames(tenantId, r.scope_warehouse_ids);
  return {
    id: r.id,
    name: r.name,
    ...baseScopeFromRule(r),
    ...agent,
    warehouse_names,
    created_by: r.created_by?.name ?? null,
    updated_by: r.updated_by?.name ?? null
  };
}

export async function mapAutoConfirmRuleRow(
  tenantId: number,
  r: AutoConfirmRuleDb
): Promise<AutoConfirmRuleRow> {
  const base = await mapRestrictionRuleRow(tenantId, r as RestrictionRuleDb);
  return {
    ...base,
    request_type_refs: [...r.request_type_refs],
    source_channels: normalizeSourceChannels(r.source_channels),
    execution_type: normalizeExecutionType(r.execution_type),
    execution_time: formatExecutionTime(r.execution_time),
    n_value: r.n_value
  };
}

export function scopeScalarsFromInput(
  input: {
    scope_agent_user_ids?: number[];
    scope_warehouse_ids?: number[];
    scope_territory_refs?: string[];
    scope_zones?: string[];
    scope_regions?: string[];
    scope_cities?: string[];
    payment_method_ref?: string | null;
    trade_direction_ref?: string | null;
    scope_trade_direction_refs?: string[];
    consignment_mode?: ConsignmentMode;
    currency_code?: string;
    amount_from?: number | null;
    amount_to?: number | null;
  }
): Pick<
  Prisma.OrderRestrictionRuleCreateInput,
  | "currency_code"
  | "amount_from"
  | "amount_to"
  | "scope_agent_user_ids"
  | "scope_warehouse_ids"
  | "scope_territory_refs"
  | "scope_zones"
  | "scope_regions"
  | "scope_cities"
  | "payment_method_ref"
  | "trade_direction_ref"
  | "scope_trade_direction_refs"
  | "consignment_mode"
> {
  const tradeRefs = normalizeStringArray(
    input.scope_trade_direction_refs ??
      (input.trade_direction_ref?.trim() ? [input.trade_direction_ref.trim()] : [])
  );
  return {
    currency_code: (input.currency_code?.trim() || "UZS").slice(0, 8),
    amount_from: input.amount_from != null ? input.amount_from : null,
    amount_to: input.amount_to != null ? input.amount_to : null,
    scope_agent_user_ids: normalizePositiveIds(input.scope_agent_user_ids),
    scope_warehouse_ids: normalizePositiveIds(input.scope_warehouse_ids),
    scope_territory_refs: normalizeStringArray(input.scope_territory_refs),
    scope_zones: normalizeStringArray(input.scope_zones),
    scope_regions: normalizeStringArray(input.scope_regions),
    scope_cities: normalizeStringArray(input.scope_cities),
    payment_method_ref: input.payment_method_ref?.trim() || null,
    scope_trade_direction_refs: tradeRefs,
    trade_direction_ref: tradeRefs[0] ?? null,
    consignment_mode: normalizeConsignmentMode(input.consignment_mode)
  };
}

export async function fetchRestrictionRuleFull(
  tenantId: number,
  id: number
): Promise<RestrictionRuleDb | null> {
  return prisma.orderRestrictionRule.findFirst({
    where: { tenant_id: tenantId, id },
    include: restrictionRuleInclude
  });
}

export async function fetchAutoConfirmRuleFull(
  tenantId: number,
  id: number
): Promise<AutoConfirmRuleDb | null> {
  return prisma.orderAutoConfirmRule.findFirst({
    where: { tenant_id: tenantId, id },
    include: autoConfirmRuleInclude
  });
}
