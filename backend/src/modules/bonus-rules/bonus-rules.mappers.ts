import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";

export function normalizeScopeBranchCodes(codes: readonly string[] | undefined): string[] {
  const out = new Set<string>();
  for (const c of codes ?? []) {
    const t = String(c).trim();
    if (t) out.add(t);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "ru"));
}

export function normalizeScopePositiveIds(ids: readonly number[] | undefined): number[] {
  return [...new Set((ids ?? []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

function mapCondition(c: BonusRuleCondition): BonusConditionRow {
  return {
    id: c.id,
    min_qty: c.min_qty != null ? Number(c.min_qty) : null,
    max_qty: c.max_qty != null ? Number(c.max_qty) : null,
    step_qty: Number(c.step_qty),
    bonus_qty: Number(c.bonus_qty),
    max_bonus_qty: c.max_bonus_qty != null ? Number(c.max_bonus_qty) : null,
    sort_order: c.sort_order
  };
}

/** Jadval / hover uchun: bonus nomisiz, faqat shart (miqdor qadam, min summa, %). */
export function bonusRuleConditionSummary(r: RuleWithConditions): string {
  const type = r.type;
  if (type === "qty" && r.conditions?.length) {
    const scopeHint = (r.sum_threshold_scope ?? "order") === "calendar_month" ? " (мес.)" : "";
    return (
      r.conditions
        .map((c) => {
          const minQty = c.min_qty != null ? Number(c.min_qty) : null;
          const maxQty = c.max_qty != null ? Number(c.max_qty) : null;
          const range =
            minQty != null || maxQty != null ? `${minQty ?? "—"}…${maxQty ?? "—"}: ` : "";
          const step = Number(c.step_qty);
          const bonus = Number(c.bonus_qty);
          const maxB = c.max_bonus_qty != null ? Number(c.max_bonus_qty) : null;
          return `${range}кажд. ${step}→+${bonus}${maxB != null ? ` (≤${maxB})` : ""}`;
        })
        .join("; ") + scopeHint
    );
  }
  if (type === "qty") {
    const scopeHint = (r.sum_threshold_scope ?? "order") === "calendar_month" ? " (мес.)" : "";
    return `${r.buy_qty ?? "—"} + ${r.free_qty ?? "—"} бонус${scopeHint}`;
  }
  if (type === "sum") {
    const scope = r.sum_threshold_scope ?? "order";
    const scopeHint = scope === "calendar_month" ? " (мес.)" : "";
    return `мин. ${r.min_sum != null ? Number(r.min_sum) : "—"}${scopeHint}`;
  }
  if (type === "discount") {
    return `${r.discount_pct != null ? Number(r.discount_pct) : "—"}%`;
  }
  return type;
}

export function mapBonusRuleFull(r: RuleWithConditions): BonusRuleRow {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    type: r.type,
    buy_qty: r.buy_qty,
    free_qty: r.free_qty,
    min_sum: r.min_sum != null ? Number(r.min_sum) : null,
    sum_threshold_scope: r.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    discount_pct: r.discount_pct != null ? Number(r.discount_pct) : null,
    priority: r.priority,
    is_active: r.is_active,
    valid_from: r.valid_from ? r.valid_from.toISOString() : null,
    valid_to: r.valid_to ? r.valid_to.toISOString() : null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    client_category: r.client_category,
    payment_type: r.payment_type,
    client_type: r.client_type,
    sales_channel: r.sales_channel,
    price_type: r.price_type,
    product_ids: [...r.product_ids],
    bonus_product_ids: [...r.bonus_product_ids],
    product_category_ids: [...r.product_category_ids],
    target_all_clients: r.target_all_clients,
    selected_client_ids: [...r.selected_client_ids],
    is_manual: r.is_manual,
    in_blocks: r.in_blocks,
    once_per_client: r.once_per_client,
    one_plus_one_gift: r.one_plus_one_gift,
    prerequisite_rule_ids: [...(r.prerequisite_rule_ids ?? [])],
    scope_branch_codes: normalizeScopeBranchCodes(r.scope_branch_codes ?? []),
    scope_agent_user_ids: normalizeScopePositiveIds(r.scope_agent_user_ids ?? []),
    scope_trade_direction_ids: normalizeScopePositiveIds(r.scope_trade_direction_ids ?? []),
    conditions: r.conditions.map(mapCondition)
  };
}

export async function fetchBonusRuleFull(tenantId: number, id: number): Promise<BonusRuleRow | null> {
  const r = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId },
    include: bonusRuleInclude
  });
  return r ? mapBonusRuleFull(r) : null;
}

export function parseOptionalDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("BAD_DATE");
  }
  return d;
}
