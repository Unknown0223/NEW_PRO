import type { BonusRule, BonusRuleCondition, BonusRuleClause } from "@prisma/client";
import { prisma } from "../../config/database";

type ClauseWithConditions = BonusRuleClause & { conditions: BonusRuleCondition[] };
type RuleWithRelations = BonusRule & {
  conditions: BonusRuleCondition[];
  clauses?: ClauseWithConditions[];
};

import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";
import { mapClauseRow } from "./bonus-rules.clauses";
import { bonusRuleHasBeenUsed } from "./bonus-rules.usage";

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
export function bonusRuleConditionSummary(r: RuleWithRelations): string {
  const type = r.type;
  const clauses = r.clauses ?? [];
  if (clauses.length > 1) {
    return `${clauses.length} усл.`;
  }
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

export function mapBonusRuleFull(r: RuleWithRelations): BonusRuleRow {
  const clauses = (r.clauses ?? []).map(mapClauseRow);
  const primary =
    clauses.find((c) => c.grants_reward) ??
    [...clauses].sort((a, b) => a.sort_order - b.sort_order)[0] ??
    null;

  // Rule-level maydonlar: birlamchi reward clause dan denormalize (engine/legacy).
  const product_ids = primary ? primary.product_ids : [...r.product_ids];
  const bonus_product_ids = primary ? primary.bonus_product_ids : [...r.bonus_product_ids];
  const product_category_ids = primary ? primary.product_category_ids : [...r.product_category_ids];
  // Primary reward conditions; bo‘sh bo‘lsa — faqat clause_id=null legacy qatorlar (gate mixed emas).
  const conditions =
    primary != null
      ? primary.conditions
      : (r.conditions ?? [])
          .filter((c) => (c as { clause_id?: number | null }).clause_id == null)
          .map(mapCondition);

  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    type: r.type,
    buy_qty: primary?.buy_qty ?? r.buy_qty,
    free_qty: primary?.free_qty ?? r.free_qty,
    min_sum:
      primary?.min_sum != null
        ? primary.min_sum
        : r.min_sum != null
          ? Number(r.min_sum)
          : null,
    sum_threshold_scope:
      (primary?.sum_threshold_scope ?? r.sum_threshold_scope) === "calendar_month"
        ? "calendar_month"
        : "order",
    discount_pct: r.discount_pct != null ? Number(r.discount_pct) : null,
    priority: primary?.priority ?? r.priority,
    is_active: r.is_active,
    valid_from: r.valid_from ? r.valid_from.toISOString() : null,
    valid_to: r.valid_to ? r.valid_to.toISOString() : null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    client_category: primary?.client_category ?? r.client_category,
    payment_type: primary?.payment_type ?? r.payment_type,
    client_type: primary?.client_type ?? r.client_type,
    sales_channel: primary?.sales_channel ?? r.sales_channel,
    price_type: primary?.price_type ?? r.price_type,
    product_ids,
    bonus_product_ids,
    product_category_ids,
    scope_restrict_assortment:
      primary?.scope_restrict_assortment ?? r.scope_restrict_assortment ?? false,
    scope_restrict_category: primary?.scope_restrict_category ?? r.scope_restrict_category ?? false,
    target_all_clients: primary?.target_all_clients ?? r.target_all_clients,
    selected_client_ids: primary
      ? [...primary.selected_client_ids]
      : [...r.selected_client_ids],
    is_manual: r.is_manual,
    in_blocks: primary?.in_blocks ?? r.in_blocks,
    once_per_client: primary?.once_per_client ?? r.once_per_client,
    one_plus_one_gift: primary?.one_plus_one_gift ?? r.one_plus_one_gift,
    prerequisite_rule_ids: [...(r.prerequisite_rule_ids ?? [])],
    scope_branch_codes: normalizeScopeBranchCodes(
      primary?.scope_branch_codes ?? r.scope_branch_codes ?? []
    ),
    scope_agent_user_ids: normalizeScopePositiveIds(
      primary?.scope_agent_user_ids ?? r.scope_agent_user_ids ?? []
    ),
    scope_trade_direction_ids: normalizeScopePositiveIds(
      primary?.scope_trade_direction_ids ?? r.scope_trade_direction_ids ?? []
    ),
    conditions,
    clauses
  };
}

export async function fetchBonusRuleFull(tenantId: number, id: number): Promise<BonusRuleRow | null> {
  const r = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId },
    include: bonusRuleInclude
  });
  if (!r) return null;
  const row = mapBonusRuleFull(r as RuleWithRelations);
  row.has_been_used = await bonusRuleHasBeenUsed(tenantId, id);
  return row;
}

export function parseOptionalDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("BAD_DATE");
  }
  return d;
}
