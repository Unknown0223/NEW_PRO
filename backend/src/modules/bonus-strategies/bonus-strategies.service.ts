import type { BonusStrategy, BonusStrategyMember, BonusRule } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  normalizeScopeBranchCodes,
  normalizeScopePositiveIds
} from "../bonus-rules/bonus-rules.mappers";
import {
  normalizeMaxSelect,
  validateBonusStrategyMembers
} from "./bonus-strategy-policy";

function strategyAuditPayload(row: BonusStrategyRow) {
  return {
    name: row.name,
    is_active: row.is_active,
    max_select: row.max_select,
    member_ids: row.members.map((m) => m.bonus_rule_id),
    scope_branch_codes: row.scope_branch_codes,
    scope_agent_user_ids: row.scope_agent_user_ids,
    scope_trade_direction_ids: row.scope_trade_direction_ids
  };
}

export type BonusStrategyMemberRow = {
  bonus_rule_id: number;
  sort_order: number;
  rule_name?: string;
  rule_type?: string;
  rule_is_active?: boolean;
};

export type BonusStrategyRow = {
  id: number;
  tenant_id: number;
  name: string;
  is_active: boolean;
  max_select: number;
  scope_branch_codes: string[];
  scope_agent_user_ids: number[];
  scope_trade_direction_ids: number[];
  created_at: string;
  updated_at: string;
  members: BonusStrategyMemberRow[];
};

export type BonusStrategyInput = {
  name: string;
  is_active?: boolean;
  max_select?: number;
  scope_branch_codes?: string[];
  scope_agent_user_ids?: number[];
  scope_trade_direction_ids?: number[];
  members: { bonus_rule_id: number; sort_order?: number }[];
};

type MemberWithRule = BonusStrategyMember & {
  bonus_rule?: Pick<BonusRule, "id" | "name" | "type" | "is_active"> | null;
};

type StrategyFull = BonusStrategy & { members: MemberWithRule[] };

function mapMember(m: MemberWithRule): BonusStrategyMemberRow {
  return {
    bonus_rule_id: m.bonus_rule_id,
    sort_order: m.sort_order,
    rule_name: m.bonus_rule?.name,
    rule_type: m.bonus_rule?.type,
    rule_is_active: m.bonus_rule?.is_active
  };
}

export function mapBonusStrategy(r: StrategyFull): BonusStrategyRow {
  const members = [...(r.members ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.bonus_rule_id - b.bonus_rule_id)
    .map(mapMember);
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    is_active: r.is_active,
    max_select: r.max_select,
    scope_branch_codes: [...(r.scope_branch_codes ?? [])],
    scope_agent_user_ids: [...(r.scope_agent_user_ids ?? [])],
    scope_trade_direction_ids: [...(r.scope_trade_direction_ids ?? [])],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    members
  };
}

const strategyInclude = {
  members: {
    orderBy: { sort_order: "asc" as const },
    include: {
      bonus_rule: { select: { id: true, name: true, type: true, is_active: true } }
    }
  }
} as const;

async function assertMembersValid(
  tenantId: number,
  members: { bonus_rule_id: number; sort_order?: number }[],
  excludeStrategyId?: number
): Promise<{ rule_ids: number[]; max_select_cap: number }> {
  const ids = [...new Set(members.map((m) => m.bonus_rule_id).filter((id) => id > 0))];
  if (ids.length < 2) throw new Error("STRATEGY_MIN_MEMBERS");

  const rules = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: ids }, is_active: true },
    select: { id: true }
  });
  if (rules.length !== ids.length) throw new Error("STRATEGY_BAD_RULE");

  const clash = await prisma.bonusStrategyMember.findMany({
    where: {
      bonus_rule_id: { in: ids },
      ...(excludeStrategyId != null ? { strategy_id: { not: excludeStrategyId } } : {}),
      strategy: { tenant_id: tenantId, is_active: true }
    },
    select: { bonus_rule_id: true, strategy_id: true }
  });
  if (clash.length > 0) throw new Error("STRATEGY_RULE_ALREADY_LINKED");

  return { rule_ids: ids, max_select_cap: ids.length - 1 };
}

export async function listBonusStrategies(
  tenantId: number,
  opts?: { active?: boolean }
): Promise<BonusStrategyRow[]> {
  const rows = await prisma.bonusStrategy.findMany({
    where: {
      tenant_id: tenantId,
      ...(opts?.active === true ? { is_active: true } : {}),
      ...(opts?.active === false ? { is_active: false } : {})
    },
    include: strategyInclude,
    orderBy: [{ updated_at: "desc" }, { id: "desc" }]
  });
  return rows.map((r) => mapBonusStrategy(r as StrategyFull));
}

export async function getBonusStrategy(
  tenantId: number,
  id: number
): Promise<BonusStrategyRow | null> {
  const r = await prisma.bonusStrategy.findFirst({
    where: { id, tenant_id: tenantId },
    include: strategyInclude
  });
  return r ? mapBonusStrategy(r as StrategyFull) : null;
}

export async function createBonusStrategy(
  tenantId: number,
  input: BonusStrategyInput,
  actorUserId: number | null = null
): Promise<BonusStrategyRow> {
  const name = input.name.trim();
  if (!name) throw new Error("VALIDATION");
  const { rule_ids } = await assertMembersValid(tenantId, input.members);
  const maxSelect = normalizeMaxSelect(input.max_select, rule_ids.length);
  const err = validateBonusStrategyMembers(rule_ids.length, maxSelect);
  if (err) throw new Error(err);

  const sortedMembers = [...input.members]
    .filter((m) => rule_ids.includes(m.bonus_rule_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seen = new Set<number>();
  const uniqueMembers = sortedMembers.filter((m) => {
    if (seen.has(m.bonus_rule_id)) return false;
    seen.add(m.bonus_rule_id);
    return true;
  });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.bonusStrategy.create({
      data: {
        tenant_id: tenantId,
        name,
        is_active: input.is_active ?? true,
        max_select: maxSelect,
        scope_branch_codes: normalizeScopeBranchCodes(input.scope_branch_codes ?? []),
        scope_agent_user_ids: normalizeScopePositiveIds(input.scope_agent_user_ids ?? []),
        scope_trade_direction_ids: normalizeScopePositiveIds(input.scope_trade_direction_ids ?? []),
        members: {
          create: uniqueMembers.map((m, i) => ({
            bonus_rule_id: m.bonus_rule_id,
            sort_order: m.sort_order ?? i
          }))
        }
      }
    });
    return row.id;
  });

  const full = await getBonusStrategy(tenantId, created);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_strategy,
    entityId: full.id,
    action: "create",
    payload: strategyAuditPayload(full)
  });
  return full;
}

export async function updateBonusStrategy(
  tenantId: number,
  id: number,
  input: Partial<BonusStrategyInput>,
  actorUserId: number | null = null
): Promise<BonusStrategyRow> {
  const existing = await prisma.bonusStrategy.findFirst({
    where: { id, tenant_id: tenantId },
    include: { members: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  let memberPayload = input.members;
  if (memberPayload === undefined) {
    memberPayload = existing.members.map((m) => ({
      bonus_rule_id: m.bonus_rule_id,
      sort_order: m.sort_order
    }));
  }

  const { rule_ids } = await assertMembersValid(tenantId, memberPayload, id);
  const maxSelect = normalizeMaxSelect(
    input.max_select !== undefined ? input.max_select : existing.max_select,
    rule_ids.length
  );
  const err = validateBonusStrategyMembers(rule_ids.length, maxSelect);
  if (err) throw new Error(err);

  const sortedMembers = [...memberPayload]
    .filter((m) => rule_ids.includes(m.bonus_rule_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seen = new Set<number>();
  const uniqueMembers = sortedMembers.filter((m) => {
    if (seen.has(m.bonus_rule_id)) return false;
    seen.add(m.bonus_rule_id);
    return true;
  });

  await prisma.$transaction(async (tx) => {
    await tx.bonusStrategyMember.deleteMany({ where: { strategy_id: id } });
    await tx.bonusStrategy.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
        max_select: maxSelect,
        ...(input.scope_branch_codes !== undefined
          ? { scope_branch_codes: normalizeScopeBranchCodes(input.scope_branch_codes) }
          : {}),
        ...(input.scope_agent_user_ids !== undefined
          ? { scope_agent_user_ids: normalizeScopePositiveIds(input.scope_agent_user_ids) }
          : {}),
        ...(input.scope_trade_direction_ids !== undefined
          ? {
              scope_trade_direction_ids: normalizeScopePositiveIds(input.scope_trade_direction_ids)
            }
          : {}),
        members: {
          create: uniqueMembers.map((m, i) => ({
            bonus_rule_id: m.bonus_rule_id,
            sort_order: m.sort_order ?? i
          }))
        }
      }
    });
  });

  const full = await getBonusStrategy(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_strategy,
    entityId: full.id,
    action: "update",
    payload: strategyAuditPayload(full)
  });
  return full;
}

export async function setBonusStrategyActive(
  tenantId: number,
  id: number,
  isActive: boolean,
  actorUserId: number | null = null
): Promise<BonusStrategyRow> {
  const existing = await prisma.bonusStrategy.findFirst({
    where: { id, tenant_id: tenantId },
    include: { members: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (isActive) {
    const { rule_ids } = await assertMembersValid(
      tenantId,
      existing.members.map((m) => ({ bonus_rule_id: m.bonus_rule_id, sort_order: m.sort_order })),
      id
    );
    const err = validateBonusStrategyMembers(rule_ids.length, existing.max_select);
    if (err) throw new Error(err);
  }
  await prisma.bonusStrategy.update({ where: { id }, data: { is_active: isActive } });
  const full = await getBonusStrategy(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_strategy,
    entityId: full.id,
    action: "patch.active",
    payload: { name: full.name, is_active: full.is_active }
  });
  return full;
}

export async function deleteBonusStrategy(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await prisma.bonusStrategy.findFirst({
    where: { id, tenant_id: tenantId },
    include: strategyInclude
  });
  if (!existing) throw new Error("NOT_FOUND");
  const snapshot = mapBonusStrategy(existing as StrategyFull);
  await prisma.bonusStrategy.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_strategy,
    entityId: id,
    action: "delete",
    payload: strategyAuditPayload(snapshot)
  });
}

/** Zakaz engine uchun: aktiv strategiyalar + a'zolar. */
export async function loadActiveBonusStrategiesForOrder(
  tenantId: number
): Promise<
  Array<{
    id: number;
    name: string;
    max_select: number;
    rule_ids: number[];
    scope_branch_codes: string[];
    scope_agent_user_ids: number[];
    scope_trade_direction_ids: number[];
  }>
> {
  const rows = await prisma.bonusStrategy.findMany({
    where: { tenant_id: tenantId, is_active: true },
    include: {
      members: { orderBy: { sort_order: "asc" }, select: { bonus_rule_id: true } }
    }
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    max_select: r.max_select,
    rule_ids: r.members.map((m) => m.bonus_rule_id),
    scope_branch_codes: r.scope_branch_codes ?? [],
    scope_agent_user_ids: r.scope_agent_user_ids ?? [],
    scope_trade_direction_ids: r.scope_trade_direction_ids ?? []
  }));
}
