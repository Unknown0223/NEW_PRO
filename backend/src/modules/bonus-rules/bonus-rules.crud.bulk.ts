import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { setBonusRuleActive } from "./bonus-rules.crud.lifecycle";
import { updateBonusRule, updateBonusRuleOrderScope } from "./bonus-rules.crud.update";
import type { UpdateBonusRuleInput } from "./bonus-rules.types";

export type BulkBonusRulePatch = Pick<
  UpdateBonusRuleInput,
  | "is_active"
  | "is_manual"
  | "valid_to"
  | "scope_branch_codes"
  | "scope_agent_user_ids"
  | "scope_trade_direction_ids"
  | "target_all_clients"
  | "selected_client_ids"
> & {
  /** Har bir qoida uchun `valid_to` ni shuncha kunga uzaytirish (mavjud sana yoki hozirgi vaqtdan). */
  extend_days?: number;
};

function normalizeIds(ruleIds: number[]): number[] {
  return [...new Set(ruleIds.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x) && x > 0))].slice(
    0,
    500
  );
}

function scopeOnlyKeys(patch: BulkBonusRulePatch): boolean {
  const scopeKeys = new Set([
    "scope_branch_codes",
    "scope_agent_user_ids",
    "scope_trade_direction_ids",
    "target_all_clients",
    "selected_client_ids"
  ]);
  const keys = Object.keys(patch).filter((k) => k !== "extend_days");
  return keys.length > 0 && keys.every((k) => scopeKeys.has(k));
}

export async function bulkPatchBonusRules(
  tenantId: number,
  ruleIds: number[],
  patch: BulkBonusRulePatch,
  actorUserId: number | null = null
): Promise<{ updated: number; failed: Array<{ id: number; error: string }> }> {
  const ids = normalizeIds(ruleIds);
  if (ids.length === 0) {
    return { updated: 0, failed: [] };
  }

  const { extend_days, ...rest } = patch;
  const hasExtend = extend_days != null && extend_days > 0;
  const patchKeys = Object.keys(rest);
  if (patchKeys.length === 0 && !hasExtend) {
    return { updated: 0, failed: [] };
  }

  let updated = 0;
  const failed: Array<{ id: number; error: string }> = [];

  const useScopeOnly = scopeOnlyKeys(patch) && !hasExtend && rest.is_active === undefined && rest.is_manual === undefined;

  for (const id of ids) {
    try {
      if (useScopeOnly) {
        await updateBonusRuleOrderScope(tenantId, id, rest, actorUserId);
      } else if (
        patchKeys.length === 1 &&
        patchKeys[0] === "is_active" &&
        rest.is_active !== undefined &&
        !hasExtend
      ) {
        await setBonusRuleActive(tenantId, id, rest.is_active, actorUserId);
      } else {
        const input: UpdateBonusRuleInput = { ...rest };
        if (hasExtend) {
          const existing = await prisma.bonusRule.findFirst({
            where: { id, tenant_id: tenantId },
            select: { valid_to: true }
          });
          const base =
            existing?.valid_to && existing.valid_to.getTime() > Date.now() ? existing.valid_to : new Date();
          const next = new Date(base);
          next.setDate(next.getDate() + extend_days!);
          input.valid_to = next.toISOString();
        }
        await updateBonusRule(tenantId, id, input, actorUserId);
      }
      updated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      failed.push({ id, error: msg });
    }
  }

  if (updated > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.bonus_rule,
      entityId: 0,
      action: "bulk_patch",
      payload: { rule_ids: ids, patch, updated, failed_count: failed.length }
    });
  }

  return { updated, failed };
}
