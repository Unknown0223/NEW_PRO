import type { OrderAutoConfirmRule, OrderRestrictionRule } from "@prisma/client";
import type { OrderRuleContext, SourceChannel } from "./order-automation.types";
import { normalizeConsignmentMode, normalizeSourceChannels } from "./order-automation.mappers";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function matchesStringScope(ruleValues: string[], ctxValue: string | null): boolean {
  if (!ruleValues.length) return true;
  const v = norm(ctxValue);
  if (!v) return false;
  return ruleValues.some((r) => norm(r) === v);
}

function matchesStringListScope(ruleValues: string[], ctxValues: string[]): boolean {
  if (!ruleValues.length) return true;
  if (!ctxValues.length) return false;
  const set = new Set(ctxValues.map((c) => norm(c)));
  return ruleValues.some((r) => set.has(norm(r)));
}

function matchesIdScope(ruleIds: number[], ctxId: number | null): boolean {
  if (!ruleIds.length) return true;
  if (ctxId == null) return false;
  return ruleIds.includes(ctxId);
}

function matchesAmount(
  rule: Pick<OrderRestrictionRule, "currency_code" | "amount_from" | "amount_to">,
  ctx: OrderRuleContext
): boolean {
  const cur = norm(rule.currency_code);
  const ctxCur = norm(ctx.currency_code);
  if (cur && ctxCur && cur !== ctxCur) return false;
  const total = ctx.total_sum;
  const from = rule.amount_from != null ? Number(rule.amount_from) : null;
  const to = rule.amount_to != null ? Number(rule.amount_to) : null;
  if (from == null && to == null) return true;
  if (from != null && total < from) return false;
  if (to != null && total > to) return false;
  return true;
}

function matchesConsignment(
  mode: string,
  isConsignment: boolean
): boolean {
  const m = normalizeConsignmentMode(mode);
  if (m === "all") return true;
  if (m === "yes") return isConsignment;
  return !isConsignment;
}

function tradeDirectionRefsFromRule(
  rule: Pick<OrderRestrictionRule, "scope_trade_direction_refs" | "trade_direction_ref">
): string[] {
  const scoped = rule.scope_trade_direction_refs ?? [];
  if (scoped.length) return scoped;
  const legacy = rule.trade_direction_ref?.trim();
  return legacy ? [legacy] : [];
}

function matchesTradeDirection(
  rule: Pick<OrderRestrictionRule, "scope_trade_direction_refs" | "trade_direction_ref">,
  ctxDir: string | null
): boolean {
  return matchesStringScope(tradeDirectionRefsFromRule(rule), ctxDir);
}

function matchesPayment(ruleRef: string | null, ctxRef: string | null): boolean {
  if (!ruleRef?.trim()) return true;
  return norm(ruleRef) === norm(ctxRef);
}

/** Umumiy scope (restriction va auto-confirm uchun). */
export function ruleMatchesOrderContext(
  rule: Pick<
    OrderRestrictionRule,
    | "is_active"
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
  >,
  ctx: OrderRuleContext
): boolean {
  if (!rule.is_active) return false;
  if (!matchesAmount(rule, ctx)) return false;
  if (!matchesIdScope(rule.scope_agent_user_ids, ctx.agent_id)) return false;
  if (!matchesIdScope(rule.scope_warehouse_ids, ctx.warehouse_id)) return false;
  if (!matchesStringListScope(rule.scope_territory_refs, ctx.client_territory_refs)) return false;
  if (!matchesStringScope(rule.scope_zones, ctx.client_zone)) return false;
  if (!matchesStringScope(rule.scope_regions, ctx.client_region)) return false;
  if (!matchesStringScope(rule.scope_cities, ctx.client_city)) return false;
  if (!matchesPayment(rule.payment_method_ref, ctx.payment_method_ref)) return false;
  if (!matchesTradeDirection(rule, ctx.agent_trade_direction)) return false;
  if (!matchesConsignment(rule.consignment_mode, ctx.is_consignment)) return false;
  return true;
}

export function autoConfirmRuleMatchesContext(
  rule: OrderAutoConfirmRule,
  ctx: OrderRuleContext
): boolean {
  if (!ruleMatchesOrderContext(rule, ctx)) return false;
  if (rule.request_type_refs.length) {
    const rt = norm(ctx.request_type_ref);
    if (!rt) return false;
    if (!rule.request_type_refs.some((r) => norm(r) === rt)) return false;
  }
  const channels = normalizeSourceChannels(rule.source_channels);
  if (channels.length && !channels.includes(ctx.creation_channel)) return false;
  return true;
}

/** Keyingi ish kuni (dush–juma). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d;
}

export function computeAutoConfirmRunAt(
  rule: Pick<OrderAutoConfirmRule, "execution_type" | "execution_time" | "n_value">,
  orderCreatedAt: Date
): Date {
  const type = rule.execution_type;
  if (type === "instant") return new Date();
  if (type === "business_days_n") {
    const n = rule.n_value != null && rule.n_value > 0 ? rule.n_value : 1;
    return addBusinessDays(orderCreatedAt, n);
  }
  const exec = rule.execution_time;
  const run = new Date(orderCreatedAt.getTime());
  if (exec) {
    run.setHours(exec.getHours(), exec.getMinutes(), exec.getSeconds(), 0);
  } else {
    run.setHours(7, 0, 0, 0);
  }
  if (run.getTime() <= orderCreatedAt.getTime()) {
    run.setDate(run.getDate() + 1);
  }
  return run;
}

export function buildOrderRuleContextFromParts(parts: {
  tenant_id: number;
  total_sum: number;
  currency_code?: string;
  warehouse_id: number | null;
  agent_id: number | null;
  agent_trade_direction: string | null;
  payment_method_ref: string | null;
  request_type_ref: string | null;
  is_consignment: boolean;
  order_type: string;
  creation_channel?: SourceChannel;
  client_region: string | null;
  client_city: string | null;
  client_zone: string | null;
  client_territory_refs?: string[];
}): OrderRuleContext {
  const territoryRefs = [...(parts.client_territory_refs ?? [])];
  if (parts.client_region?.trim()) territoryRefs.push(parts.client_region.trim());
  if (parts.client_city?.trim()) territoryRefs.push(parts.client_city.trim());
  return {
    tenant_id: parts.tenant_id,
    total_sum: parts.total_sum,
    currency_code: parts.currency_code?.trim() || "UZS",
    warehouse_id: parts.warehouse_id,
    agent_id: parts.agent_id,
    agent_trade_direction: parts.agent_trade_direction,
    payment_method_ref: parts.payment_method_ref,
    request_type_ref: parts.request_type_ref,
    is_consignment: parts.is_consignment,
    order_type: parts.order_type,
    creation_channel: parts.creation_channel ?? "web",
    client_region: parts.client_region,
    client_city: parts.client_city,
    client_zone: parts.client_zone,
    client_territory_refs: territoryRefs
  };
}
