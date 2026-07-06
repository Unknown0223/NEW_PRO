import type { Prisma } from "@prisma/client";
import {
  buildBonusRuleApplySnapshot,
  type AppliedBonusRuleSnapshot
} from "../bonus-rules/bonus-rules.snapshot";
import { mapBonusRuleFull } from "../bonus-rules/bonus-rules.mappers";
import { bonusRuleInclude } from "../bonus-rules/bonus-rules.types";

/** Qo‘llangan qoidalar uchun zakaz snapshot (tahrirdan keyin ham tarix). */
export async function buildAppliedBonusRulesSnapshotForOrder(
  tx: Prisma.TransactionClient,
  tenantId: number,
  ruleIds: readonly number[]
): Promise<AppliedBonusRuleSnapshot[]> {
  const uniq = [...new Set(ruleIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniq.length === 0) return [];

  const rows = await tx.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: uniq } },
    include: bonusRuleInclude
  });
  const byId = new Map(rows.map((r) => [r.id, buildBonusRuleApplySnapshot(mapBonusRuleFull(r))]));
  return uniq.map((id) => byId.get(id)).filter((s): s is AppliedBonusRuleSnapshot => s != null);
}
