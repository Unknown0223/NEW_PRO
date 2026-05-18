import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type {
  BonusConditionInput,
  BonusRuleRow,
  CreateBonusRuleInput,
  UpdateBonusRuleInput
} from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";
import {
  fetchBonusRuleFull,
  normalizeScopeBranchCodes,
  normalizeScopePositiveIds,
  parseOptionalDate
} from "./bonus-rules.mappers";
import {
  normalizeConditions,
  validateAutoBonusProductScope,
  validateConditions,
  validateForType,
  validatePrerequisiteRuleIds
} from "./bonus-rules.validate";

export async function updateBonusRule(
  tenantId: number,
  id: number,
  input: UpdateBonusRuleInput,
  actorUserId: number | null = null
): Promise<BonusRuleRow> {
  const existing = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId },
    include: bonusRuleInclude
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const type = input.type ?? existing.type;
  const merged: CreateBonusRuleInput = {
    name: (input.name ?? existing.name).trim(),
    type,
    buy_qty: input.buy_qty !== undefined ? input.buy_qty : existing.buy_qty,
    free_qty: input.free_qty !== undefined ? input.free_qty : existing.free_qty,
    min_sum: input.min_sum !== undefined ? input.min_sum : existing.min_sum != null ? Number(existing.min_sum) : null,
    discount_pct:
      input.discount_pct !== undefined
        ? input.discount_pct
        : existing.discount_pct != null
          ? Number(existing.discount_pct)
          : null,
    priority: input.priority ?? existing.priority,
    is_active: input.is_active ?? existing.is_active,
    valid_from:
      input.valid_from !== undefined ? input.valid_from : existing.valid_from ? existing.valid_from.toISOString() : null,
    valid_to: input.valid_to !== undefined ? input.valid_to : existing.valid_to ? existing.valid_to.toISOString() : null,
    client_category:
      input.client_category !== undefined ? input.client_category : existing.client_category,
    payment_type: input.payment_type !== undefined ? input.payment_type : existing.payment_type,
    client_type: input.client_type !== undefined ? input.client_type : existing.client_type,
    sales_channel: input.sales_channel !== undefined ? input.sales_channel : existing.sales_channel,
    price_type: input.price_type !== undefined ? input.price_type : existing.price_type,
    product_ids: input.product_ids ?? [...existing.product_ids],
    bonus_product_ids: input.bonus_product_ids ?? [...existing.bonus_product_ids],
    product_category_ids: input.product_category_ids ?? [...existing.product_category_ids],
    target_all_clients: input.target_all_clients ?? existing.target_all_clients,
    selected_client_ids:
      input.target_all_clients === true
        ? []
        : input.selected_client_ids !== undefined
          ? input.selected_client_ids
          : [...existing.selected_client_ids],
    is_manual: input.is_manual ?? existing.is_manual,
    in_blocks: input.in_blocks ?? existing.in_blocks,
    once_per_client: input.once_per_client ?? existing.once_per_client,
    one_plus_one_gift: input.one_plus_one_gift ?? existing.one_plus_one_gift,
    prerequisite_rule_ids:
      input.prerequisite_rule_ids !== undefined
        ? input.prerequisite_rule_ids
        : [...existing.prerequisite_rule_ids],
    scope_branch_codes:
      input.scope_branch_codes !== undefined
        ? normalizeScopeBranchCodes(input.scope_branch_codes)
        : normalizeScopeBranchCodes(existing.scope_branch_codes ?? []),
    scope_agent_user_ids:
      input.scope_agent_user_ids !== undefined
        ? normalizeScopePositiveIds(input.scope_agent_user_ids)
        : normalizeScopePositiveIds(existing.scope_agent_user_ids ?? []),
    scope_trade_direction_ids:
      input.scope_trade_direction_ids !== undefined
        ? normalizeScopePositiveIds(input.scope_trade_direction_ids)
        : normalizeScopePositiveIds(existing.scope_trade_direction_ids ?? []),
    sum_threshold_scope:
      type !== "sum" && type !== "qty"
        ? "order"
        : input.sum_threshold_scope !== undefined
          ? input.sum_threshold_scope === "calendar_month"
            ? "calendar_month"
            : "order"
          : existing.sum_threshold_scope === "calendar_month"
            ? "calendar_month"
            : "order"
  };

  let nextConditions: BonusConditionInput[] | undefined;
  if (input.conditions !== undefined) {
    nextConditions = input.conditions;
  } else if (type === "qty") {
    nextConditions = existing.conditions.map((c) => ({
      min_qty: c.min_qty != null ? Number(c.min_qty) : null,
      max_qty: c.max_qty != null ? Number(c.max_qty) : null,
      step_qty: Number(c.step_qty),
      bonus_qty: Number(c.bonus_qty),
      max_bonus_qty: c.max_bonus_qty != null ? Number(c.max_bonus_qty) : null,
      sort_order: c.sort_order
    }));
  } else {
    nextConditions = [];
  }

  const normalized = normalizeConditions(type, { ...merged, conditions: nextConditions });
  const buyForVal =
    normalized && normalized.length > 0
      ? Math.floor(normalized[0].step_qty)
      : (merged.buy_qty ?? null);
  const freeForVal =
    normalized && normalized.length > 0
      ? Math.floor(normalized[0].bonus_qty)
      : (merged.free_qty ?? null);

  validateForType(
    type,
    { buy_qty: buyForVal, free_qty: freeForVal, min_sum: merged.min_sum, discount_pct: merged.discount_pct },
    normalized,
    Boolean(merged.one_plus_one_gift)
  );

  /** Jadvaldan faqat bog‘langan qoidalarni saqlash — assortimentni o‘zgartirmaydi; qoidani to‘ldirish shart emas. */
  const inputKeys = Object.keys(input) as (keyof UpdateBonusRuleInput)[];
  const onlyPrerequisiteRuleIdsUpdate =
    inputKeys.length > 0 && inputKeys.every((k) => k === "prerequisite_rule_ids");
  if (!onlyPrerequisiteRuleIdsUpdate) {
    validateAutoBonusProductScope(
      type,
      merged.is_manual ?? false,
      merged.product_ids ?? [],
      merged.product_category_ids ?? []
    );
  }

  if (input.prerequisite_rule_ids !== undefined) {
    await validatePrerequisiteRuleIds(tenantId, id, merged.prerequisite_rule_ids);
  }

  let valid_from: Date | null | undefined = undefined;
  let valid_to: Date | null | undefined = undefined;
  if (input.valid_from !== undefined) {
    valid_from = parseOptionalDate(input.valid_from);
  }
  if (input.valid_to !== undefined) {
    valid_to = parseOptionalDate(input.valid_to);
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = merged.name;
  if (input.type !== undefined) data.type = merged.type;
  if (input.buy_qty !== undefined || input.conditions !== undefined || input.one_plus_one_gift !== undefined) {
    data.buy_qty = buyForVal;
    data.free_qty = freeForVal;
  }
  if (input.min_sum !== undefined) data.min_sum = merged.min_sum;
  if (input.discount_pct !== undefined) data.discount_pct = merged.discount_pct;
  if (input.priority !== undefined) data.priority = merged.priority;
  if (input.is_active !== undefined) data.is_active = merged.is_active;
  if (valid_from !== undefined) data.valid_from = valid_from;
  if (valid_to !== undefined) data.valid_to = valid_to;

  if (input.client_category !== undefined) data.client_category = merged.client_category?.trim() || null;
  if (input.payment_type !== undefined) data.payment_type = merged.payment_type?.trim() || null;
  if (input.client_type !== undefined) data.client_type = merged.client_type?.trim() || null;
  if (input.sales_channel !== undefined) data.sales_channel = merged.sales_channel?.trim() || null;
  if (input.price_type !== undefined) data.price_type = merged.price_type?.trim() || null;
  if (input.product_ids !== undefined) data.product_ids = merged.product_ids;
  if (input.bonus_product_ids !== undefined) data.bonus_product_ids = merged.bonus_product_ids;
  if (input.product_category_ids !== undefined) data.product_category_ids = merged.product_category_ids;
  if (input.target_all_clients !== undefined) {
    data.target_all_clients = merged.target_all_clients;
    if (merged.target_all_clients) {
      data.selected_client_ids = [];
    }
  }
  if (input.selected_client_ids !== undefined) data.selected_client_ids = merged.selected_client_ids;
  if (input.is_manual !== undefined) data.is_manual = merged.is_manual;
  if (input.in_blocks !== undefined) data.in_blocks = merged.in_blocks;
  if (input.once_per_client !== undefined) data.once_per_client = merged.once_per_client;
  if (input.one_plus_one_gift !== undefined) data.one_plus_one_gift = merged.one_plus_one_gift;
  if (input.prerequisite_rule_ids !== undefined) {
    data.prerequisite_rule_ids = [...new Set((merged.prerequisite_rule_ids ?? []).filter((n) => n > 0))].slice(0, 200);
  }
  if (input.sum_threshold_scope !== undefined || input.type !== undefined) {
    data.sum_threshold_scope = merged.sum_threshold_scope;
  }
  if (input.scope_branch_codes !== undefined) data.scope_branch_codes = merged.scope_branch_codes;
  if (input.scope_agent_user_ids !== undefined) data.scope_agent_user_ids = merged.scope_agent_user_ids;
  if (input.scope_trade_direction_ids !== undefined) {
    data.scope_trade_direction_ids = merged.scope_trade_direction_ids;
  }

  await prisma.$transaction(async (tx) => {
    if (input.type !== undefined && type !== "qty") {
      await tx.bonusRuleCondition.deleteMany({ where: { bonus_rule_id: id } });
    }
    if (Object.keys(data).length > 0) {
      await tx.bonusRule.update({ where: { id }, data });
    }
    if (input.conditions !== undefined && type === "qty") {
      let toWrite = normalized ?? [];
      if (toWrite.length === 0) {
        if (merged.buy_qty != null && merged.free_qty != null) {
          toWrite = [{ step_qty: merged.buy_qty, bonus_qty: merged.free_qty, sort_order: 0 }];
        } else {
          throw new Error("VALIDATION");
        }
      }
      validateConditions(toWrite);
      await tx.bonusRuleCondition.deleteMany({ where: { bonus_rule_id: id } });
      await tx.bonusRuleCondition.createMany({
        data: toWrite.map((c, i) => ({
          bonus_rule_id: id,
          min_qty: c.min_qty ?? null,
          max_qty: c.max_qty ?? null,
          step_qty: c.step_qty,
          bonus_qty: c.bonus_qty,
          max_bonus_qty: c.max_bonus_qty ?? null,
          sort_order: c.sort_order ?? i
        }))
      });
      await tx.bonusRule.update({
        where: { id },
        data: { buy_qty: buyForVal, free_qty: freeForVal }
      });
    }
  });

  const full = await fetchBonusRuleFull(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: id,
    action: "update",
    payload: { changed_keys: Object.keys(input) }
  });
  return full;
}
