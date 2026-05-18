import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";
import { fetchBonusRuleFull } from "./bonus-rules.mappers";

/** Shart qatorlari ichidan sotib olingan miqdorga mos birinchi qator (sort_order bo‘yicha). */
export function pickMatchingCondition(
  rows: BonusConditionRow[],
  purchasedQty: number
): BonusConditionRow | null {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  for (const c of sorted) {
    const minOk = c.min_qty == null || purchasedQty >= c.min_qty;
    const maxOk = c.max_qty == null || purchasedQty <= c.max_qty;
    if (minOk && maxOk) return c;
  }
  return null;
}

export function computeQtyBonus(
  purchasedQty: number,
  cond: { step_qty: number; bonus_qty: number; max_bonus_qty: number | null },
  inBlocks: boolean
): number {
  if (inBlocks) {
    let raw = Math.floor(purchasedQty / cond.step_qty) * cond.bonus_qty;
    if (cond.max_bonus_qty != null) raw = Math.min(raw, cond.max_bonus_qty);
    return raw;
  }
  if (purchasedQty < cond.step_qty) return 0;
  let b = cond.bonus_qty;
  if (cond.max_bonus_qty != null) b = Math.min(b, cond.max_bonus_qty);
  return b;
}

export type QtyPreviewResult = {
  purchased_qty: number;
  rule_id: number;
  rule_name: string;
  type: string;
  in_blocks: boolean;
  applied_condition: BonusConditionRow | null;
  bonus_qty: number;
  matched: boolean;
};

/**
 * Zakaz / preview uchun: qoidaga ko‘ra sotib olingan miqdordan bonus dona soni.
 * `previewQtyBonus` bilan bir xil shart tanlash mantiq.
 */
export function computeQtyBonusForRuleRow(rule: BonusRuleRow, purchasedQty: number): number {
  if (rule.type !== "qty") return 0;
  let conditions = rule.conditions;
  if (conditions.length === 0 && rule.buy_qty != null && rule.free_qty != null) {
    conditions = [
      {
        id: 0,
        min_qty: null,
        max_qty: null,
        step_qty: rule.buy_qty,
        bonus_qty: rule.free_qty,
        max_bonus_qty: null,
        sort_order: 0
      }
    ];
  }
  if (conditions.length === 0) return 0;
  const matched = pickMatchingCondition(conditions, purchasedQty);
  if (!matched) return 0;
  return computeQtyBonus(purchasedQty, matched, rule.in_blocks);
}

export async function previewQtyBonus(
  tenantId: number,
  ruleId: number,
  purchasedQty: number
): Promise<QtyPreviewResult | { error: "NOT_FOUND" | "WRONG_TYPE" | "NO_CONDITIONS" }> {
  const row = await fetchBonusRuleFull(tenantId, ruleId);
  if (!row) return { error: "NOT_FOUND" };
  if (row.type !== "qty") return { error: "WRONG_TYPE" };

  let conditions = row.conditions;
  if (conditions.length === 0 && row.buy_qty != null && row.free_qty != null) {
    conditions = [
      {
        id: 0,
        min_qty: null,
        max_qty: null,
        step_qty: row.buy_qty,
        bonus_qty: row.free_qty,
        max_bonus_qty: null,
        sort_order: 0
      }
    ];
  }
  if (conditions.length === 0) return { error: "NO_CONDITIONS" };

  const matched = pickMatchingCondition(conditions, purchasedQty);
  if (!matched) {
    return {
      purchased_qty: purchasedQty,
      rule_id: row.id,
      rule_name: row.name,
      type: row.type,
      in_blocks: row.in_blocks,
      applied_condition: null,
      bonus_qty: 0,
      matched: false
    };
  }

  const bonus_qty = computeQtyBonus(purchasedQty, matched, row.in_blocks);
  return {
    purchased_qty: purchasedQty,
    rule_id: row.id,
    rule_name: row.name,
    type: row.type,
    in_blocks: row.in_blocks,
    applied_condition: matched,
    bonus_qty,
    matched: true
  };
}

export { fetchBonusRuleFull };
