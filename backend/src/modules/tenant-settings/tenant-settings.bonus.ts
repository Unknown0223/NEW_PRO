import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  bonusPolicyToJson,
  mergeBonusStackPatch,
  parseBonusStackPolicy,
  type BonusStackJson,
  type BonusStackPolicy
} from "../orders/bonus-stack-policy";
import { asRecord } from "./tenant-settings.shared";

export async function getTenantBonusStack(tenantId: number): Promise<BonusStackJson> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const policy = parseBonusStackPolicy(row?.settings);
  return bonusPolicyToJson(policy);
}

export async function updateTenantBonusStack(
  tenantId: number,
  patch: Partial<{
    mode: unknown;
    max_units: unknown;
    forbid_apply_all_eligible: unknown;
  }>,
  actorUserId: number | null = null
): Promise<{ policy: BonusStackPolicy; json: BonusStackJson }> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const current = parseBonusStackPolicy(row?.settings);
  const policy = mergeBonusStackPatch(current, patch);
  const nextSettings = {
    ...asRecord(row?.settings),
    bonus_stack: bonusPolicyToJson(policy)
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.tenant_settings,
    entityId: tenantId,
    action: "patch.bonus_stack",
    payload: { patch, bonus_stack: bonusPolicyToJson(policy) }
  });

  return { policy, json: bonusPolicyToJson(policy) };
}
