import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type { BonusRuleRow, CreateBonusRuleInput } from "./bonus-rules.types";
import { fetchBonusRuleFull, parseOptionalDate } from "./bonus-rules.mappers";
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
  const conditions = normalizeConditions(input.type, input);
  const buyForVal =
    conditions && conditions.length > 0 ? Math.floor(conditions[0].step_qty) : (input.buy_qty ?? null);
  const freeForVal =
    conditions && conditions.length > 0 ? Math.floor(conditions[0].bonus_qty) : (input.free_qty ?? null);

  validateForType(
    input.type,
    { buy_qty: buyForVal, free_qty: freeForVal, min_sum: input.min_sum, discount_pct: input.discount_pct },
    conditions,
    Boolean(input.one_plus_one_gift)
  );

  const valid_from = parseOptionalDate(input.valid_from ?? null);
  const valid_to = parseOptionalDate(input.valid_to ?? null);

  const scalars = ruleScalarsFromInput(tenantId, input, valid_from, valid_to, buyForVal, freeForVal);
  validateAutoBonusProductScope(
    scalars.type,
    scalars.is_manual,
    scalars.product_ids,
    scalars.product_category_ids,
    scalars.scope_restrict_assortment,
    scalars.scope_restrict_category
  );

  await validatePrerequisiteRuleIds(tenantId, null, scalars.prerequisite_rule_ids);

  const created = await prisma.$transaction(async (tx) => {
    const rule = await tx.bonusRule.create({
      data: scalars
    });
    if (conditions && conditions.length > 0) {
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
