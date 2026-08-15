import { prisma } from "../../config/database";
import {
  bonusRuleInclude,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import {
  activeRuleWhere,
  ruleMatchesProduct
} from "../orders/order-bonus-context.match-gifts";
import type { ProductLite } from "../orders/order-bonus-context.fetch";
import { rewardRuleViews } from "../orders/order-bonus-clauses";

function ruleActiveAt(rule: BonusRuleRow, at: Date): boolean {
  if (!rule.is_active) return false;
  if (rule.valid_from && new Date(rule.valid_from) > at) return false;
  if (rule.valid_to && new Date(rule.valid_to) < at) return false;
  return true;
}

export async function loadActiveQtyBonusRules(tenantId: number, at: Date): Promise<BonusRuleRow[]> {
  const rows = await prisma.bonusRule.findMany({
    where: activeRuleWhere(tenantId, "qty", at),
    include: bonusRuleInclude,
    orderBy: { priority: "desc" }
  });
  return rows.map(mapBonusRuleFull).filter((r) => ruleActiveAt(r, at));
}

/** Mos qoida: reward clause view (multi-shart) yoki host. */
export function findQtyRuleForProduct(
  rules: BonusRuleRow[],
  product: ProductLite
): BonusRuleRow | null {
  for (const rule of rules) {
    if (!rule.is_manual) {
      for (const view of rewardRuleViews(rule)) {
        if (ruleMatchesProduct(view, product)) return view;
      }
    }
  }
  for (const rule of rules) {
    for (const view of rewardRuleViews(rule)) {
      if (ruleMatchesProduct(view, product)) return view;
    }
  }
  return null;
}

export function ruleQtyLabel(rule: BonusRuleRow): string {
  const c = rule.conditions[0];
  const step = c?.step_qty ?? rule.buy_qty ?? 0;
  const bonus = c?.bonus_qty ?? rule.free_qty ?? 0;
  const blocks = rule.in_blocks ? "блок" : "порог";
  return `${step}+${bonus} (${blocks})`;
}
