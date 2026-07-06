import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type { BonusConditionInput, CreateBonusRuleInput } from "./bonus-rules.types";
import { normalizeScopeBranchCodes, normalizeScopePositiveIds } from "./bonus-rules.mappers";

export function validateConditions(conditions: BonusConditionInput[]) {
  for (const c of conditions) {
    if (c.step_qty <= 0 || c.bonus_qty < 0) {
      throw new Error("VALIDATION");
    }
    const min = c.min_qty ?? null;
    const max = c.max_qty ?? null;
    if (min != null && max != null && min > max) {
      throw new Error("VALIDATION");
    }
  }
}

export function validateForType(
  type: string,
  m: {
    buy_qty?: number | null;
    free_qty?: number | null;
    min_sum?: number | null;
    discount_pct?: number | null;
  },
  conditions: BonusConditionInput[] | undefined,
  onePlusOne: boolean
) {
  if (type === "qty") {
    const hasRows = conditions && conditions.length > 0;
    if (hasRows) {
      validateConditions(conditions!);
    } else if (onePlusOne) {
      // 1+1 — shartlar bo‘sh bo‘lishi mumkin (create da avtomatik to‘ldiriladi)
    } else if (m.buy_qty == null || m.buy_qty < 1 || m.free_qty == null || m.free_qty < 0) {
      throw new Error("VALIDATION");
    }
  }
  if (type === "sum") {
    if (m.min_sum == null || m.min_sum < 0) {
      throw new Error("VALIDATION");
    }
  }
  if (type === "discount") {
    if (m.discount_pct == null || m.discount_pct < 0 || m.discount_pct > 100) {
      throw new Error("VALIDATION");
    }
  }
}

/** Avtomatik qty / sum / discount: assortiment yoki kategoriya (kamida bittasi) majburiy — butun zakazga qo‘llanadigan «bo‘sh» qoidalarni oldini olish. */
export function ruleNeedsOrderContextScalars(rule: {
  payment_type: string | null;
  client_type: string | null;
  sales_channel: string | null;
  price_type: string | null;
}): boolean {
  const nonempty = (s: string | null | undefined) => s != null && String(s).trim() !== "";
  return (
    nonempty(rule.payment_type) ||
    nonempty(rule.client_type) ||
    nonempty(rule.sales_channel) ||
    nonempty(rule.price_type)
  );
}

export async function validatePrerequisiteRuleIds(
  tenantId: number,
  hostId: number | null,
  rawIds: number[] | undefined
): Promise<void> {
  const uniq = [...new Set((rawIds ?? []).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (hostId != null && uniq.includes(hostId)) {
    throw new Error("VALIDATION");
  }
  if (uniq.length === 0) return;

  const rows = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: uniq } },
    select: {
      id: true,
      is_manual: true,
      payment_type: true,
      client_type: true,
      sales_channel: true,
      price_type: true
    }
  });
  if (rows.length !== uniq.length) {
    throw new Error("VALIDATION");
  }
  for (const r of rows) {
    if (r.is_manual) throw new Error("VALIDATION");
    if (ruleNeedsOrderContextScalars(r)) throw new Error("VALIDATION");
  }

  const all = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, prerequisite_rule_ids: true }
  });
  const adj = new Map<number, number[]>();
  for (const r of all) {
    if (hostId != null && r.id === hostId) continue;
    adj.set(r.id, [...r.prerequisite_rule_ids]);
  }
  const virtualHost = hostId ?? 0;
  adj.set(virtualHost, uniq);
  if (hostId != null) {
    adj.set(hostId, uniq);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  function dfs(u: number): boolean {
    if (visiting.has(u)) return true;
    if (visited.has(u)) return false;
    visiting.add(u);
    for (const v of adj.get(u) ?? []) {
      if (dfs(v)) return true;
    }
    visiting.delete(u);
    visited.add(u);
    return false;
  }
  if (dfs(virtualHost)) {
    throw new Error("VALIDATION");
  }
}

export function validateAutoBonusProductScope(
  type: string,
  isManual: boolean,
  productIds: readonly number[],
  categoryIds: readonly number[],
  scopeRestrictAssortment?: boolean,
  scopeRestrictCategory?: boolean
): void {
  if (isManual) return;
  if (type !== "qty" && type !== "sum" && type !== "discount") return;
  if (scopeRestrictAssortment || scopeRestrictCategory) {
    if (scopeRestrictAssortment && productIds.length === 0) {
      throw new Error("PRODUCT_SCOPE_REQUIRED");
    }
    if (scopeRestrictCategory && categoryIds.length === 0 && productIds.length === 0) {
      throw new Error("PRODUCT_SCOPE_REQUIRED");
    }
    return;
  }
  if (productIds.length > 0 || categoryIds.length > 0) return;
  throw new Error("PRODUCT_SCOPE_REQUIRED");
}

export function normalizeConditions(
  type: string,
  input: CreateBonusRuleInput
): BonusConditionInput[] | undefined {
  if (type !== "qty") return undefined;

  if (input.one_plus_one_gift && (!input.conditions || input.conditions.length === 0)) {
    return [{ step_qty: 1, bonus_qty: 1, sort_order: 0 }];
  }
  if (input.conditions && input.conditions.length > 0) {
    return input.conditions;
  }
  if (input.buy_qty != null && input.free_qty != null) {
    return [
      {
        step_qty: input.buy_qty,
        bonus_qty: input.free_qty,
        sort_order: 0
      }
    ];
  }
  return undefined;
}

export function ruleScalarsFromInput(
  tenantId: number,
  input: CreateBonusRuleInput,
  valid_from: Date | null,
  valid_to: Date | null,
  buyQty: number | null,
  freeQty: number | null
) {
  const allClients = input.target_all_clients ?? true;
  return {
    tenant_id: tenantId,
    name: input.name.trim(),
    type: input.type,
    buy_qty: buyQty,
    free_qty: freeQty,
    min_sum: input.min_sum ?? null,
    sum_threshold_scope:
      input.type === "sum" || input.type === "qty"
        ? input.sum_threshold_scope === "calendar_month"
          ? "calendar_month"
          : "order"
        : "order",
    discount_pct: input.discount_pct ?? null,
    priority: input.priority ?? 0,
    is_active: input.is_active ?? true,
    valid_from,
    valid_to,
    client_category: input.client_category?.trim() || null,
    payment_type: input.payment_type?.trim() || null,
    client_type: input.client_type?.trim() || null,
    sales_channel: input.sales_channel?.trim() || null,
    price_type: input.price_type?.trim() || null,
    product_ids: input.product_ids ?? [],
    bonus_product_ids:
      input.type === "discount" ||
      (input.type === "sum" && input.discount_pct != null && Number(input.discount_pct) > 0)
        ? []
        : (input.bonus_product_ids ?? []),
    product_category_ids: input.product_category_ids ?? [],
    scope_restrict_assortment: input.scope_restrict_assortment ?? false,
    scope_restrict_category: input.scope_restrict_category ?? false,
    target_all_clients: allClients,
    selected_client_ids: allClients ? [] : (input.selected_client_ids ?? []),
    is_manual: input.is_manual ?? false,
    in_blocks: input.in_blocks ?? true,
    once_per_client: input.once_per_client ?? false,
    one_plus_one_gift: input.one_plus_one_gift ?? false,
    prerequisite_rule_ids: [...new Set((input.prerequisite_rule_ids ?? []).filter((n) => n > 0))].slice(0, 200),
    scope_branch_codes: normalizeScopeBranchCodes(input.scope_branch_codes ?? []),
    scope_agent_user_ids: normalizeScopePositiveIds(input.scope_agent_user_ids ?? []),
    scope_trade_direction_ids: normalizeScopePositiveIds(input.scope_trade_direction_ids ?? [])
  };
}
