import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import type { BonusRuleRow, CreateBonusRuleInput } from "./bonus-rules.types";
import { fetchBonusRuleFull, parseOptionalDate } from "./bonus-rules.mappers";
import {
  clauseCreateData,
  isGiftBonusType,
  primaryRewardClause,
  synthesizePrimaryClauseFromFlat,
  validateClausesForGiftBonus
} from "./bonus-rules.clauses";
import {
  normalizeConditions,
  ruleScalarsFromInput,
  validateAutoBonusProductScope,
  validateForType,
  validatePrerequisiteRuleIds
} from "./bonus-rules.validate";

export async function createBonusRule(
  tenantId: number,
  input: CreateBonusRuleInput,
  actorUserId: number | null = null
): Promise<BonusRuleRow> {
  const gift = isGiftBonusType(input.type, input.discount_pct);

  let clauses = input.clauses;
  if (gift) {
    if (!clauses || clauses.length === 0) {
      clauses = [synthesizePrimaryClauseFromFlat(input)];
    }
    clauses = validateClausesForGiftBonus(input.type, clauses, input.discount_pct);
  } else {
    clauses = [];
  }

  const primary = gift && clauses.length > 0 ? primaryRewardClause(clauses) : null;
  const flatForScalars: CreateBonusRuleInput = primary
    ? {
        ...input,
        priority: primary.priority ?? input.priority,
        client_category: primary.client_category,
        payment_type: primary.payment_type,
        client_type: primary.client_type,
        sales_channel: primary.sales_channel,
        price_type: primary.price_type,
        product_ids: primary.product_ids,
        bonus_product_ids: primary.bonus_product_ids,
        product_category_ids: primary.product_category_ids,
        scope_restrict_assortment: primary.scope_restrict_assortment,
        scope_restrict_category: primary.scope_restrict_category,
        target_all_clients: primary.target_all_clients,
        selected_client_ids: primary.selected_client_ids,
        in_blocks: primary.in_blocks,
        once_per_client: primary.once_per_client,
        one_plus_one_gift: primary.one_plus_one_gift,
        buy_qty: primary.buy_qty,
        free_qty: primary.free_qty,
        min_sum: primary.min_sum,
        sum_threshold_scope: primary.sum_threshold_scope,
        scope_branch_codes: primary.scope_branch_codes,
        scope_agent_user_ids: primary.scope_agent_user_ids,
        scope_trade_direction_ids: primary.scope_trade_direction_ids,
        conditions: primary.conditions,
        // Bonus gift: связанный o‘rniga clauses
        prerequisite_rule_ids: gift ? [] : input.prerequisite_rule_ids
      }
    : input;

  const conditions = normalizeConditions(flatForScalars.type, flatForScalars);
  const buyForVal =
    conditions && conditions.length > 0 ? Math.floor(conditions[0]!.step_qty) : (flatForScalars.buy_qty ?? null);
  const freeForVal =
    conditions && conditions.length > 0 ? Math.floor(conditions[0]!.bonus_qty) : (flatForScalars.free_qty ?? null);

  if (!gift) {
    validateForType(
      flatForScalars.type,
      {
        buy_qty: buyForVal,
        free_qty: freeForVal,
        min_sum: flatForScalars.min_sum,
        discount_pct: flatForScalars.discount_pct
      },
      conditions,
      Boolean(flatForScalars.one_plus_one_gift)
    );
    validateAutoBonusProductScope(
      flatForScalars.type,
      flatForScalars.is_manual ?? false,
      flatForScalars.product_ids ?? [],
      flatForScalars.product_category_ids ?? [],
      flatForScalars.scope_restrict_assortment,
      flatForScalars.scope_restrict_category
    );
  }

  const valid_from = parseOptionalDate(flatForScalars.valid_from ?? null);
  const valid_to = parseOptionalDate(flatForScalars.valid_to ?? null);

  const scalars = ruleScalarsFromInput(
    tenantId,
    flatForScalars,
    valid_from,
    valid_to,
    buyForVal,
    freeForVal
  );
  if (gift) {
    scalars.prerequisite_rule_ids = [];
  }

  if (!gift) {
    await validatePrerequisiteRuleIds(tenantId, null, scalars.prerequisite_rule_ids);
  }

  const created = await prisma.$transaction(async (tx) => {
    const rule = await tx.bonusRule.create({
      data: scalars
    });

    if (gift && clauses && clauses.length > 0) {
      for (let i = 0; i < clauses.length; i++) {
        const c = clauses[i]!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).bonusRuleClause.create({
          data: clauseCreateData(rule.id, c, i)
        });
      }
    } else if (conditions && conditions.length > 0) {
      await tx.bonusRuleCondition.createMany({
        data: conditions.map((c, i) => ({
          bonus_rule_id: rule.id,
          min_qty: c.min_qty ?? null,
          max_qty: c.max_qty ?? null,
          step_qty: c.step_qty,
          bonus_qty: c.bonus_qty,
          max_bonus_qty: c.max_bonus_qty ?? null,
          sort_order: c.sort_order ?? i
        }))
      });
    }
    return rule.id;
  });

  const full = await fetchBonusRuleFull(tenantId, created);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: full.id,
    action: "create",
    payload: { name: full.name, type: full.type, is_active: full.is_active }
  });
  return full;
}
