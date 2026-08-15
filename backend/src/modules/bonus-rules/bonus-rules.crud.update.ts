import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type {
  BonusConditionInput,
  BonusRuleClauseInput,
  BonusRuleRow,
  CreateBonusRuleInput,
  UpdateBonusRuleInput
} from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";
import {
  fetchBonusRuleFull,
  mapBonusRuleFull,
  normalizeScopeBranchCodes,
  normalizeScopePositiveIds,
  parseOptionalDate
} from "./bonus-rules.mappers";
import { bonusRuleHasBeenUsed } from "./bonus-rules.usage";
import {
  clauseCreateData,
  isGiftBonusType,
  primaryRewardClause,
  synthesizePrimaryClauseFromFlat,
  validateClausesForGiftBonus
} from "./bonus-rules.clauses";
import {
  normalizeConditions,
  validateAutoBonusProductScope,
  validateConditions,
  validateForType,
  validatePrerequisiteRuleIds
} from "./bonus-rules.validate";

/** Flat gift update primary clause maydonlariga tegsa — clauses orqali yoziladi. */
const GIFT_FLAT_CLAUSE_KEYS = new Set<keyof UpdateBonusRuleInput>([
  "in_blocks",
  "once_per_client",
  "one_plus_one_gift",
  "product_ids",
  "bonus_product_ids",
  "product_category_ids",
  "scope_restrict_assortment",
  "scope_restrict_category",
  "target_all_clients",
  "selected_client_ids",
  "buy_qty",
  "free_qty",
  "min_sum",
  "sum_threshold_scope",
  "conditions",
  "priority",
  "client_category",
  "payment_type",
  "client_type",
  "sales_channel",
  "price_type",
  "scope_branch_codes",
  "scope_agent_user_ids",
  "scope_trade_direction_ids"
]);

function clauseRowToInput(c: BonusRuleRow["clauses"][number]): BonusRuleClauseInput {
  return {
    sort_order: c.sort_order,
    grants_reward: c.grants_reward,
    priority: c.priority,
    client_category: c.client_category,
    payment_type: c.payment_type,
    client_type: c.client_type,
    sales_channel: c.sales_channel,
    price_type: c.price_type,
    product_ids: [...c.product_ids],
    bonus_product_ids: [...c.bonus_product_ids],
    product_category_ids: [...c.product_category_ids],
    scope_restrict_assortment: c.scope_restrict_assortment,
    scope_restrict_category: c.scope_restrict_category,
    target_all_clients: c.target_all_clients,
    selected_client_ids: [...c.selected_client_ids],
    in_blocks: c.in_blocks,
    once_per_client: c.once_per_client,
    one_plus_one_gift: c.one_plus_one_gift,
    buy_qty: c.buy_qty,
    free_qty: c.free_qty,
    min_sum: c.min_sum,
    sum_threshold_scope:
      c.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
    scope_branch_codes: [...c.scope_branch_codes],
    scope_agent_user_ids: [...c.scope_agent_user_ids],
    scope_trade_direction_ids: [...c.scope_trade_direction_ids],
    conditions: c.conditions.map((cond) => ({
      min_qty: cond.min_qty,
      max_qty: cond.max_qty,
      step_qty: cond.step_qty,
      bonus_qty: cond.bonus_qty,
      max_bonus_qty: cond.max_bonus_qty,
      sort_order: cond.sort_order
    }))
  };
}

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

  const locked = await bonusRuleHasBeenUsed(tenantId, id);
  if (locked) {
    const allowed = new Set([
      "is_active",
      "valid_to",
      "scope_branch_codes",
      "scope_agent_user_ids",
      "scope_trade_direction_ids",
      "target_all_clients",
      "selected_client_ids"
    ]);
    const keys = Object.keys(input) as (keyof UpdateBonusRuleInput)[];
    if (keys.some((k) => !allowed.has(k))) {
      throw new Error("RULE_LOCKED");
    }
  }

  const type = input.type ?? existing.type;
  const gift = isGiftBonusType(
    type,
    input.discount_pct !== undefined
      ? input.discount_pct
      : existing.discount_pct != null
        ? Number(existing.discount_pct)
        : null
  );

  // Flat gift update: mapper primary clause dan o‘qiydi — flat maydonlarni clauses ga aylantiramiz.
  if (gift && input.clauses === undefined) {
    const existingFull = mapBonusRuleFull(existing as Parameters<typeof mapBonusRuleFull>[0]);
    if ((existingFull.clauses?.length ?? 0) > 0) {
      const flatTouches = (Object.keys(input) as (keyof UpdateBonusRuleInput)[]).some((k) =>
        GIFT_FLAT_CLAUSE_KEYS.has(k)
      );
      if (flatTouches) {
        const primarySynth = synthesizePrimaryClauseFromFlat({
          type,
          priority: input.priority ?? existingFull.priority,
          client_category:
            input.client_category !== undefined ? input.client_category : existingFull.client_category,
          payment_type:
            input.payment_type !== undefined ? input.payment_type : existingFull.payment_type,
          client_type: input.client_type !== undefined ? input.client_type : existingFull.client_type,
          sales_channel:
            input.sales_channel !== undefined ? input.sales_channel : existingFull.sales_channel,
          price_type: input.price_type !== undefined ? input.price_type : existingFull.price_type,
          product_ids: input.product_ids ?? existingFull.product_ids,
          bonus_product_ids: input.bonus_product_ids ?? existingFull.bonus_product_ids,
          product_category_ids: input.product_category_ids ?? existingFull.product_category_ids,
          scope_restrict_assortment:
            input.scope_restrict_assortment ?? existingFull.scope_restrict_assortment,
          scope_restrict_category:
            input.scope_restrict_category ?? existingFull.scope_restrict_category,
          target_all_clients: input.target_all_clients ?? existingFull.target_all_clients,
          selected_client_ids: input.selected_client_ids ?? existingFull.selected_client_ids,
          in_blocks: input.in_blocks ?? existingFull.in_blocks,
          once_per_client: input.once_per_client ?? existingFull.once_per_client,
          one_plus_one_gift: input.one_plus_one_gift ?? existingFull.one_plus_one_gift,
          buy_qty: input.buy_qty !== undefined ? input.buy_qty : existingFull.buy_qty,
          free_qty: input.free_qty !== undefined ? input.free_qty : existingFull.free_qty,
          min_sum:
            input.min_sum !== undefined
              ? input.min_sum
              : existingFull.min_sum,
          sum_threshold_scope:
            input.sum_threshold_scope !== undefined
              ? input.sum_threshold_scope === "calendar_month"
                ? "calendar_month"
                : "order"
              : existingFull.sum_threshold_scope === "calendar_month"
                ? "calendar_month"
                : "order",
          scope_branch_codes: input.scope_branch_codes ?? existingFull.scope_branch_codes,
          scope_agent_user_ids: input.scope_agent_user_ids ?? existingFull.scope_agent_user_ids,
          scope_trade_direction_ids:
            input.scope_trade_direction_ids ?? existingFull.scope_trade_direction_ids,
          conditions:
            input.conditions ??
            existingFull.conditions.map((c) => ({
              min_qty: c.min_qty,
              max_qty: c.max_qty,
              step_qty: c.step_qty,
              bonus_qty: c.bonus_qty,
              max_bonus_qty: c.max_bonus_qty,
              sort_order: c.sort_order
            }))
        });
        const gateInputs = existingFull.clauses
          .filter((c) => !c.grants_reward)
          .map(clauseRowToInput);
        input = { ...input, clauses: [primarySynth, ...gateInputs] };
      }
    }
  }

  // Ichki shartlar: to‘liq almashtirish
  if (input.clauses !== undefined && gift) {
    const clauses = validateClausesForGiftBonus(
      type,
      input.clauses,
      input.discount_pct !== undefined
        ? input.discount_pct
        : existing.discount_pct != null
          ? Number(existing.discount_pct)
          : null
    );
    const primary = primaryRewardClause(clauses);
    const valid_from =
      input.valid_from !== undefined ? parseOptionalDate(input.valid_from) : undefined;
    const valid_to =
      input.valid_to !== undefined ? parseOptionalDate(input.valid_to) : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.bonusRuleCondition.deleteMany({ where: { bonus_rule_id: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).bonusRuleClause.deleteMany({ where: { bonus_rule_id: id } });

      for (let i = 0; i < clauses.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).bonusRuleClause.create({
          data: clauseCreateData(id, clauses[i]!, i)
        });
      }

      const conds = primary.conditions;
      const buyForVal =
        conds && conds.length > 0
          ? Math.floor(conds[0]!.step_qty)
          : (primary.buy_qty ?? null);
      const freeForVal =
        conds && conds.length > 0
          ? Math.floor(conds[0]!.bonus_qty)
          : (primary.free_qty ?? null);

      await tx.bonusRule.update({
        where: { id },
        data: {
          name: input.name !== undefined ? input.name.trim() : undefined,
          type: input.type !== undefined ? type : undefined,
          is_active: input.is_active,
          ...(valid_from !== undefined ? { valid_from } : {}),
          ...(valid_to !== undefined ? { valid_to } : {}),
          prerequisite_rule_ids: [],
          priority: primary.priority ?? 0,
          client_category: primary.client_category?.trim() || null,
          payment_type: primary.payment_type?.trim() || null,
          client_type: primary.client_type?.trim() || null,
          sales_channel: primary.sales_channel?.trim() || null,
          price_type: primary.price_type?.trim() || null,
          product_ids: primary.product_ids ?? [],
          bonus_product_ids: primary.bonus_product_ids ?? [],
          product_category_ids: primary.product_category_ids ?? [],
          scope_restrict_assortment: primary.scope_restrict_assortment ?? false,
          scope_restrict_category: primary.scope_restrict_category ?? false,
          target_all_clients: primary.target_all_clients ?? true,
          selected_client_ids:
            primary.target_all_clients === false ? (primary.selected_client_ids ?? []) : [],
          in_blocks: primary.in_blocks ?? true,
          once_per_client: primary.once_per_client ?? false,
          one_plus_one_gift: primary.one_plus_one_gift ?? false,
          buy_qty: buyForVal,
          free_qty: freeForVal,
          min_sum: primary.min_sum ?? null,
          sum_threshold_scope:
            primary.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order",
          scope_branch_codes: normalizeScopeBranchCodes(primary.scope_branch_codes ?? []),
          scope_agent_user_ids: normalizeScopePositiveIds(primary.scope_agent_user_ids ?? []),
          scope_trade_direction_ids: normalizeScopePositiveIds(
            primary.scope_trade_direction_ids ?? []
          )
        }
      });
    });

    const full = await fetchBonusRuleFull(tenantId, id);
    if (!full) throw new Error("NOT_FOUND");
    if (locked) full.has_been_used = true;
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.bonus_rule,
      entityId: id,
      action: "update",
      payload: { changed_keys: Object.keys(input), locked, clauses: true }
    });
    return full;
  }

  // Gift bonus: flat update da связанный yozilmasin
  if (gift && input.prerequisite_rule_ids !== undefined) {
    input = { ...input, prerequisite_rule_ids: [] };
  }
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
    bonus_product_ids:
      type === "discount" ||
      (type === "sum" &&
        (input.discount_pct ?? existing.discount_pct) != null &&
        Number(input.discount_pct ?? existing.discount_pct) > 0)
        ? []
        : (input.bonus_product_ids ?? [...existing.bonus_product_ids]),
    product_category_ids: input.product_category_ids ?? [...existing.product_category_ids],
    scope_restrict_assortment:
      input.scope_restrict_assortment ?? existing.scope_restrict_assortment ?? false,
    scope_restrict_category: input.scope_restrict_category ?? existing.scope_restrict_category ?? false,
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
      merged.product_category_ids ?? [],
      merged.scope_restrict_assortment,
      merged.scope_restrict_category
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
  if (input.scope_restrict_assortment !== undefined) {
    data.scope_restrict_assortment = merged.scope_restrict_assortment;
  }
  if (input.scope_restrict_category !== undefined) {
    data.scope_restrict_category = merged.scope_restrict_category;
  }
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
  if (locked) {
    full.has_been_used = true;
  }
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: id,
    action: "update",
    payload: { changed_keys: Object.keys(input), locked }
  });
  return full;
}

/** Buyurtma scope (filial/agent/klient) — ishlatilgan qoidalarda ham yangilanadi. */
export async function updateBonusRuleOrderScope(
  tenantId: number,
  id: number,
  input: Pick<
    UpdateBonusRuleInput,
    | "scope_branch_codes"
    | "scope_agent_user_ids"
    | "scope_trade_direction_ids"
    | "target_all_clients"
    | "selected_client_ids"
  >,
  actorUserId: number | null = null
): Promise<BonusRuleRow> {
  const existing = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId },
    include: bonusRuleInclude
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const targetAll =
    input.target_all_clients !== undefined ? input.target_all_clients : existing.target_all_clients;
  const data: Record<string, unknown> = {};
  if (input.scope_branch_codes !== undefined) {
    data.scope_branch_codes = normalizeScopeBranchCodes(input.scope_branch_codes);
  }
  if (input.scope_agent_user_ids !== undefined) {
    data.scope_agent_user_ids = normalizeScopePositiveIds(input.scope_agent_user_ids);
  }
  if (input.scope_trade_direction_ids !== undefined) {
    data.scope_trade_direction_ids = normalizeScopePositiveIds(input.scope_trade_direction_ids);
  }
  if (input.target_all_clients !== undefined) {
    data.target_all_clients = targetAll;
    if (targetAll) {
      data.selected_client_ids = [];
    }
  }
  if (input.selected_client_ids !== undefined && !targetAll) {
    data.selected_client_ids = normalizeScopePositiveIds(input.selected_client_ids);
  }

  if (Object.keys(data).length === 0) {
    throw new Error("VALIDATION");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bonusRule.update({ where: { id }, data });
    // Mapper primary clause dan scope o‘qiydi — barcha clause larni sinxron yangilaymiz.
    const clauseData: Record<string, unknown> = {};
    if (data.scope_branch_codes !== undefined) {
      clauseData.scope_branch_codes = data.scope_branch_codes;
    }
    if (data.scope_agent_user_ids !== undefined) {
      clauseData.scope_agent_user_ids = data.scope_agent_user_ids;
    }
    if (data.scope_trade_direction_ids !== undefined) {
      clauseData.scope_trade_direction_ids = data.scope_trade_direction_ids;
    }
    if (data.target_all_clients !== undefined) {
      clauseData.target_all_clients = data.target_all_clients;
    }
    if (data.selected_client_ids !== undefined) {
      clauseData.selected_client_ids = data.selected_client_ids;
    }
    if (Object.keys(clauseData).length > 0) {
      await (tx as any).bonusRuleClause.updateMany({
        where: { bonus_rule_id: id },
        data: clauseData
      });
    }
  });

  const full = await fetchBonusRuleFull(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  const locked = await bonusRuleHasBeenUsed(tenantId, id);
  if (locked) {
    full.has_been_used = true;
  }
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: id,
    action: "update_order_scope",
    payload: { changed_keys: Object.keys(input), locked }
  });
  return full;
}
