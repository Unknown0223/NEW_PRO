import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };

import type { BonusRuleRow } from "./bonus-rules.types";
import { fetchBonusRuleFull } from "./bonus-rules.mappers";

export async function softDeactivateBonusRule(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<BonusRuleRow> {
  const existing = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  await prisma.bonusRule.update({
    where: { id },
    data: { is_active: false }
  });
  const full = await fetchBonusRuleFull(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: id,
    action: "soft_delete",
    payload: { is_active: false, name: full.name }
  });
  return full;
}

export async function setBonusRuleActive(
  tenantId: number,
  id: number,
  is_active: boolean,
  actorUserId: number | null = null
): Promise<BonusRuleRow> {
  const existing = await prisma.bonusRule.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  await prisma.bonusRule.update({
    where: { id },
    data: { is_active }
  });
  const full = await fetchBonusRuleFull(tenantId, id);
  if (!full) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.bonus_rule,
    entityId: id,
    action: "patch.active",
    payload: { is_active }
  });
  return full;
}
